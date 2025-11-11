# Realtime STT Migration Plan

## Objetivo
Implementar transcrição em tempo real usando a OpenAI Realtime API (`intent=transcription`) para eliminar o limite de 25 MB por turno, reduzir latência e destravar feedback parcial enquanto preservamos o fluxo push-to-talk do Voice Agent.

## Estado Atual Resumido
- **Captura**: `MediaRecorder` (`audio/webm;codecs=opus`) gera um blob único ao soltar a tecla. (`client/src/hooks/usePushToTalkRecorder.ts`)
- **Envio**: Blob convertido em base64 e enviado como único `AUDIO_CHUNK` via `useVoiceWebSocket`. (`client/src/hooks/useVoiceWebSocket.ts`)
- **Servidor**: `VoiceSession.handleAudioChunk` converte o chunk em arquivo temporário e chama `transcribeAudio` (Whisper/4o). (`server/voice/session.ts`, `server/voice/stt.ts`)
- **Limite**: API de transcrição REST aceita só arquivos `< 25 MB`; resto da pipeline trava em áudios longos.

## Restrições e Compatibilidades

| Configuração atual (`VoiceAgentSettings`) | Suporte Realtime | Observações |
| --- | --- | --- |
| `sttModel` = `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` / `whisper-1` | ✅ | Declarados na doc do Realtime. |
| `sttModel` = `gpt-4o-transcribe-diarize` | ❌ | Realtime ainda não expõe diarization. Precisamos bloquear ou fazer fallback para REST. |
| `sttResponseFormat` (`json`, `text`, `verbose_json`, `diarized_json`) | Parcial | Realtime retorna texto bruto nos eventos `delta/completed`. Precisamos registrar essa limitação e ajustar UI/analytics. |
| `sttTimestampGranularity` | ❌ | Parâmetro indisponível no Realtime; remover/ignorar quando o modo realtime estiver ativo. |
| `sttTemperature` | ❌ | Não há `temperature` para o STT. Manter apenas para modo REST. |
| `sttPrompt` / `sttLanguage` | ✅ | Mapear para `audio.input.transcription.prompt` e `language`. |
| `sttVAD` (inexistente hoje) | ➖ | Realtime oferece `server_vad` e `semantic_vad`; manter push-to-talk manual inicialmente e evoluir depois. |
| Logprobs/Confidence | ✅ | `include: ["item.input_audio_transcription.logprobs"]` permite replicar nossa métrica atual. |

### Implicações
- Precisamos de **validador de configurações** para impedir combinação “Realtime + diarize/timestamp”.
- UI deve informar que diarização e timestamps só funcionam no modo “processamento completo”.
- `VoiceSession` deve aceitar transcripts vindos diretamente do cliente (texto final + metadados) sem reprocessar áudio.

## Fases do Projeto

### 1. Validação e Flags
1. Introduzir um feature flag (`enableRealtimeStt`) nas settings do usuário/produto.
2. Criar helper no backend que, dadas as settings e o modo ativo, normaliza parâmetros e faz fallback seguro.
3. Adicionar alertas na UI quando o usuário escolher opções incompatíveis com Realtime.

### 2. Endpoint de Sessão Realtime
1. Novo handler HTTP (`POST /api/realtime/stt-session`) protegido por auth.
2. Server chama `POST /v1/realtime/transcription_sessions` com:
   ```json
   {
     "model": "<sttModel suportado>",
     "input_audio_format": "pcm16",
     "audio": {
       "input": {
         "format": {"type": "audio/pcm", "rate": 24000},
         "transcription": {"model": "...", "prompt": "...", "language": "..."},
         "turn_detection": null
       }
     },
     "include": ["item.input_audio_transcription.logprobs"]
   }
   ```
3. Responder ao cliente com o `client_secret`, `session_id` e a configuração efetiva.
4. Logar session-id ↔ user-id para auditoria.

#### Detalhamento da API interna
- **Request** (cliente → nosso backend):
  ```http
  POST /api/realtime/stt-session
  Authorization: Bearer <access token>
  Content-Type: application/json

  {
    "settingsId": "<opcional>",
    "mode": "push_to_talk" | "continuous"
  }
  ```
- **Response**:
  ```json
  {
    "session": {
      "id": "session_123",
      "expiresAt": 1736000000,
      "model": "gpt-4o-transcribe",
      "language": "pt"
    },
    "clientSecret": "rtm_xxx",
    "wsUrl": "wss://api.openai.com/v1/realtime?intent=transcription",
    "effectiveConfig": {
      "prompt": "...",
      "logProbs": true,
      "turnDetection": null
    }
  }
  ```
- **Checagens**:
  - Verificar quota e limites de taxa (ex: 5 sessões simultâneas por usuário).
  - Substituir modelos incompatíveis (ex: `gpt-4o-transcribe-diarize` → rejeitar com 400).
  - Persistir registro mínimo (`session_id`, `user_id`, `sttModel`, `createdAt`).

### 3. Captura de Áudio PCM no Frontend
1. Substituir `MediaRecorder` por um pipeline baseado em `AudioWorklet` ou `MediaStreamTrackProcessor`:
   - Captura `Float32Array`, converte para `Int16` (PCM), reamostra para 24 kHz.
   - Emite buffers pequenos (10–40 ms) para reduzir latência.
2. Atualizar `usePushToTalkRecorder` para expor o mesmo estado (`isActive`, `inputLevel`), mas produzir eventos `onAudioChunk(Int16Array)` em vez de `Blob`.
3. Manter fallback para o fluxo atual até o rollout completo.

#### Plano detalhado (frontend)
- **Camada base (`audio/pcm`)**
  - Criar utilitário `createPcmStream({ sampleRateTarget: 24000 })` que recebe `MediaStream`, instancia `AudioWorkletNode` e entrega `Float32Array`.
  - Reamostragem: usar `AudioWorklet` para evitar custo no main thread; fallback para `OfflineAudioContext` se Worklet indisponível.
  - Conversão: `Float32 → Int16` (multiplicar por 0x7fff e clamp) e `ArrayBuffer` pronto para base64.
- **Hook `useRealtimeRecorder`**
  - Estados: `isReady`, `isRecording`, `inputLevel`, erros.
  - API: `start()` / `stop()` / `flush()`; emite `onChunk(base64Audio, { sequenceId, timestamp })`.
  - Mantém lógica de “pressionou barra de espaço” através de `usePushToTalkKeyboard`.
  - Continua exibindo níveis de áudio usando `AnalyserNode`.
- **Hook `useRealtimeTranscriber`**
  - Recebe `clientSecret`, abre WebSocket com cabeçalho `Authorization: Bearer <clientSecret>`.
  - Envia `input_audio_buffer.append` por chunk (ex: 320 bytes ≈ 10 ms). Se estiver usando push-to-talk manual, chamar `input_audio_buffer.commit` no `stop()`.
  - Eventos suportados:
    - `conversation.item.input_audio_transcription.delta`: `setCurrentTranscript`.
    - `...completed`: `enqueueTranscript({ text, itemId, logProbs })`.
    - `input_audio_buffer.committed`: atualizar estado interno para saber qual turno foi finalizado.
  - Propaga `connectionState` e `lastError` para a UI.
- **Bridge com `useVoiceAgent`**
  - Quando um transcript final chega, chamar `handleTranscriptFromRealtime(text, metadata)` que reutiliza `updateSpeechAnalytics`.
  - Em caso de fallback (token expirado, WS fechado), o hook devolve erro e `useVoiceAgent` volta para o fluxo REST automaticamente.

### 4. WebSocket Cliente → OpenAI
1. Criar hook `useRealtimeTranscriber`:
   - Abre `wss://api.openai.com/v1/realtime?intent=transcription` com o token efêmero.
   - Envia `input_audio_buffer.append` para cada chunk PCM (base64).
   - Opcionalmente envia `input_audio_buffer.commit` ao soltar a tecla.
2. Ouvir eventos:
   - `conversation.item.input_audio_transcription.delta` → atualizar `currentTranscript`.
   - `…completed` → enviar transcript final para `VoiceSession` (via nosso WS atual) preservando analytics.
3. Propagar erros/estado de conexão para a UI.

### 5. Integração com `VoiceSession`
1. Adicionar novo tipo de mensagem no WebSocket interno (`CLIENT_TRANSCRIPT`).
2. Pular `transcribeAudio` quando receber um transcript já pronto.
3. Atualizar `audioBuffer`/cancelamento para lidar com múltiplos turns concorrentes (usar `item_id` do Realtime como chave).
4. Garantir que `updateConfidence`, RAG e streaming LLM/TTS continuem iguais.

### 6. Observabilidade e Rollout
1. Métricas: sessões criadas, duração média, erros de socket, latência turn-start → transcript-final.
2. Ferramenta de diagnóstico (ex: comando `npm run dev:realtime-stt`) com mocks locais.
3. Rollout: feature flag → beta → GA. Manter fallback REST enquanto Realtime estiver marcado como experimental.

## Testes Recomendados
- **Unit**: validação de settings + helpers de conversão PCM.
- **Integration**: simular sessão Realtime usando fixtures WebSocket (Mock Service Worker).
- **E2E Manual**: cenários curtos (<10 s) e longos (>60 s) verificando latência, interrupção e cancelamento.

## Checklist de Entregáveis
- [ ] Schema atualizado com flag de Realtime e validações.
- [ ] Endpoint `/api/realtime/stt-session`.
- [ ] Hook de captura PCM + hook Realtime.
- [ ] Ajustes no `VoiceSession` + novos tipos de mensagem.
- [ ] Documentação de uso e fallback.
- [ ] Dashboards/alertas básicos.

Este plano será nosso guia; cada fase acima vira um sub-ticket/tarefa conforme avançarmos.
