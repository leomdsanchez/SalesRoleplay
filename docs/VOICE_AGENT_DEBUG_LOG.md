# Voice Agent Debug Log

Documento vivo para acompanhar o diagnóstico do fluxo de chat por voz.

## 2025-11-01

### Observações Atuais
- WebSocket inicial falhou com URL inválida (`wss://localhost:undefined`), mas fallback conectou em ambiente Replit.
- `TRANSCRIPT` é recebido com `isFinal=true`, o que limpa `streamingText` no frontend.
- Nenhum pacote `AGENT_TEXT` chegou com `isComplete=true`; apenas chunks parciais e `isSentence=true`.
- Ao iniciar nova gravação, `streamingText` é limpo (por causa do transcript anterior), então a última resposta do assistente desaparece da UI.
- Erros recorrentes de Speech-to-Text (`network`) e player de áudio (`MEDIA_ELEMENT_ERROR: Empty src attribute`).

### Pendências Técnicas
- Investigar no backend por que o servidor não envia `AGENT_TEXT` final com `isComplete=true`.

### Investigação (Backend)
- `streamLLMResponse` emite um chunk final com `{ text: "", isComplete: true }`.
- `voice/session.ts` só envia `AGENT_TEXT` quando `chunk.text` é truthy, portanto descarta o chunk final vazio.
- Resultado: o cliente nunca recebe `isComplete=true`.

### Ajustes Recentes (23:14 UTC)
- Frontend agora usa flags `DEBUG_VOICE_AGENT` e `DEBUG_VOICE_WS` (default `false`) para controlar logs verbosos que surgiram no debug.
- Logs críticos continuam via `console.error`, mas ruído de diagnóstico pode ser reativado conforme necessário.

### Erros Paralelos Observados
| Erro | Impacto | Severidade | Observações |
| --- | --- | --- | --- |
| `Speech recognition error: network` (Web Speech API) | Perde transcrição local em tempo real, mas transcript final do servidor chega. | Alta | Ocorre em cada sessão; provável limitação do ambiente Replit/HTTPS. Investigar STT local ou fallback. |
| `MEDIA_ELEMENT_ERROR: Empty src attribute` (AudioPlayer) | UI registra erro antes de carregar áudio; áudio subsequente toca normalmente. | Média | Indica tentativa de tocar antes de setar `src`. Revisar `useAudioPlayer` para evitar play imediato sem fonte. |
| WebSocket fallback para `wss://…replit.dev/ws/voice` | Conexão funciona após fallback. | Baixa | Primeiro attempt falha apenas quando URL local inválida é tentada; pode ser ignorado em produção configurando URL corretamente. |

### Logs STT (23:38 UTC)
- Ao habilitar `useSpeechRecognition`, vemos sequência: `Enabling recognition` → `Calling start()` → `Started listening` e imediatamente `Error event { error: "network" }`, seguido de `Stopped listening`.
- O hook tenta reiniciar (porque `enabled` continua `true`), repetindo o ciclo com novo erro `network` até o usuário soltar o push-to-talk.
- Interpretação: Web Speech API interrompe imediatamente a captura no ambiente atual; não recebemos `interimResults`, confirmando que a legenda em tempo real não aparece por falta de suporte/permite.

### Situação Atual do STT
- Frontend depende da Web Speech API para transcrição em tempo real; quando falha com `error: "network"`, nenhum fallback entrega legendas parciais.
- Backend usa `transcribeAudio()` com `openai.audio.transcriptions.create` (modelo `gpt-4o-transcribe`), enviando o blob completo após a gravação. Não há streaming incremental vindo do provedor.
- Consequência: apenas o transcript final (via WebSocket) chega estável; legendas durante a fala exigem viabilizar um STT com streaming oficial ou outra alternativa.

### Referência de Streaming (Doc Oficial)
- Exemplo fornecido para `gpt-4o-mini-transcribe` mostra `stream: true` com eventos `transcript.text.delta` emitidos pelo endpoint – confirma suporte a streaming.
- Exemplo `whisper-1` com `verbose_json`+`timestamp_granularities` devolve metadados completos, mas documentação não afirma streaming; precisamos testar na prática antes de assumir.
