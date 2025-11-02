# Voice Chat Mechanics - Documentação Técnica

## Visão Geral

Este documento mapeia a mecânica complexa do sistema de chat por voz, incluindo o fluxo de mensagens, estados de streaming e comportamentos esperados.

## Componentes Principais

### 1. Estados do Chat
- `messages`: Array de mensagens completas (usuário/assistente)
- `currentTranscript`: Texto do usuário sendo transcrito em tempo real
- `streamingText`: Texto do assistente sendo exibido em tempo real

### 2. Fluxo de Mensagens

#### Mensagens do Usuário
1. **Transcrição em tempo real**: `currentTranscript` mostra texto enquanto usuário fala
2. **Finalização**: Quando `isFinal=true`, adiciona ao `messages` e limpa `currentTranscript`
3. **Nova mensagem**: Cada áudio gera uma nova entrada no chat

#### Mensagens do Assistente
1. **Streaming em tempo real**: `streamingText` mostra texto aparecendo palavra por palavra
2. **Frases completas**: `isSentence=true` - texto já está sendo exibido via palavras
3. **Mensagem completa**: `isComplete=true` - move `streamingText` para `messages` e limpa

## Problema Atual Identificado

### Sintomas
- Mensagens do assistente ficam como "última" e crescem indefinidamente
- Texto se acumula em vez de ser substituído por novas respostas
- Comportamento não esperado pelo usuário

### Análise Técnica
- Quando `isComplete=true`, o código adiciona `streamingText` às mensagens
- Mas `streamingText` não é limpo quando nova gravação começa
- Resultado: texto residual permanece e se acumula com novas respostas

## Fluxo Esperado vs Atual

### Fluxo Esperado (Ideal)
```
Usuário fala → Nova mensagem do usuário
Assistente responde → Streaming text aparece
Resposta completa → Move para messages, limpa streaming
Nova pergunta → Cancela resposta anterior, limpa streaming
```

### Fluxo Atual (Problemático)
```
Usuário fala → Nova mensagem do usuário
Assistente responde → Streaming text aparece
Resposta completa → Move para messages (mas streaming não limpa)
Nova pergunta → Streaming anterior permanece + nova resposta acumula
```

## Correção Implementada

### Problema Resolvido
- **Sintoma**: Mensagens do assistente acumulavam indefinidamente no `streamingText`
- **Causa**: `streamingText` não era limpo entre respostas do assistente
- **Solução**: Limpar `streamingText` quando usuário finaliza pergunta (`isFinal=true`)

### Novo Fluxo
```
Usuário começa a falar → streamingText permanece (se assistente estava falando)
Usuário finaliza fala → streamingText é limpo, nova mensagem do usuário adicionada
Assistente começa resposta → streamingText começa vazio
Assistente responde → texto aparece palavra por palavra
Resposta completa → move para messages, limpa streamingText
```

### Código Alterado
```javascript
const onTranscript = useCallback((text: string, isFinal: boolean) => {
  if (isFinal) {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setCurrentTranscript("");
    // Clear streaming text when user finishes speaking
    setStreamingText(""); // ← CORREÇÃO AQUI
  } else {
    setCurrentTranscript(text);
  }
}, []);
```

## Estados de Borda Resolvidos

- ✅ **Nova pergunta durante resposta**: `streamingText` limpo na finalização da pergunta
- ✅ **Múltiplas respostas**: Cada resposta começa com `streamingText` vazio
- ✅ **Interrupção**: Nova pergunta limpa estado anterior
- ✅ **Continuidade visual**: Resposta atual permanece até pergunta ser finalizada

## Testes Validados

1. **Cenário Normal**: ✅ Usuário pergunta → Assistente responde → Nova pergunta
2. **Interrupção**: ✅ Usuário interrompe → streaming limpo na nova pergunta
3. **Sequencial**: ✅ Múltiplas trocas funcionam corretamente

## Mecânicas Avançadas

### 1. Chunking de Sentenças (isSentence Flag)

O sistema distingue entre **palavras** e **sentenças completas**:

- **Palavras (`isSentence=false`)**: Chunks enviados para streaming visual em tempo real
- **Sentenças (`isSentence=true`)**: Sentenças completas que já foram exibidas via palavras
  - Usadas para gerar áudio (TTS)
  - Adicionadas ao histórico de conversação
  - **Importante**: Não adicionar ao `streamingText` novamente (já foi via palavras)

```typescript
// Frontend (useVoiceAgent.ts)
if (isComplete) {
  // Mensagem final - mover para messages
  setMessages((prev) => [...prev, { role: "assistant", content: streamingText }]);
  setStreamingText("");
} else if (isSentence) {
  // Sentença completa - NÃO adicionar (já exibida via palavras)
  console.log("Sentence complete (already displayed)");
} else {
  // Palavra - adicionar ao streaming
  setStreamingText((prev) => prev ? prev + " " + text : text);
}
```

### 2. Cancelamento de Streaming

Quando usuário inicia nova gravação durante resposta do assistente:

1. **Frontend**: Chama `cancelStreaming()` → envia `CANCEL_STREAMING` ao servidor
2. **Frontend**: Chama `clearQueue()` → limpa fila de áudio pendente
3. **Servidor**: Define `shouldCancelStreaming = true` → interrompe loop de streaming LLM
4. **Frontend**: `streamingText` permanece até usuário finalizar nova pergunta (`isFinal=true`)

```typescript
// Frontend (useVoiceAgent.ts)
onRecordingStart: () => {
  cancelStreaming(); // Cancela streaming no servidor
  clearQueueRef.current(); // Limpa fila de áudio
  // NÃO limpa streamingText aqui - persiste até nova resposta
}
```

### 3. Buffering de Áudio no Servidor

O servidor usa buffer para gerenciar múltiplos áudios:

- Se `isProcessing=true`: áudio é adicionado a `audioBuffer[]`
- Após processar: verifica se há áudio no buffer e processa próximo
- Previne perda de mensagens durante processamento

```typescript
// Backend (session.ts)
if (this.isProcessing) {
  this.audioBuffer.push(audioBuffer);
  return;
}
```

### 4. Tool Calls

Durante streaming, o LLM pode invocar ferramentas:

- **Detecção**: `chunk.toolCall` presente no streaming
- **Notificação**: Cliente recebe `TOOL_CALL` com nome e argumentos
- **Execução**: Servidor executa tool e envia resultado de volta
- **Continuação**: Streaming continua após tool call

### 5. Histórico de Conversação

- **Cliente**: Mantém `messages[]` com histórico visual
- **Servidor**: Mantém `conversationHistory[]` para contexto LLM
- **Sincronização**: Ambos atualizam após resposta completa
- **System Prompt**: Injetado apenas na primeira mensagem

## Fluxo Completo Detalhado

### Cliente → Servidor
```
1. Usuário pressiona Space → startRecording()
2. Áudio capturado → Blob gerado
3. Blob convertido para base64 → AUDIO_CHUNK enviado
4. Transcrição local em tempo real → currentTranscript atualizado
5. Usuário solta Space → stopRecording()
```

### Servidor → Cliente
```
1. Recebe AUDIO_CHUNK
2. STT (Speech-to-Text) → gera transcript
3. TRANSCRIPT enviado (isFinal=true)
4. LLM streaming inicia:
   - Palavra → AGENT_TEXT (isSentence=false)
   - Sentença completa → AGENT_TEXT (isSentence=true)
   - TTS gerado para sentença → AGENT_AUDIO enviado
   - Tool call detectado → TOOL_CALL enviado + executado
5. Fim do streaming → AGENT_TEXT (isComplete=true)
```

### Cliente - Atualização de Estado
```
1. TRANSCRIPT recebido:
   - Adiciona mensagem do usuário a messages[]
   - Limpa currentTranscript
   - Limpa streamingText (reset para nova resposta)

2. AGENT_TEXT recebido:
   - isSentence=false → adiciona palavra a streamingText
   - isSentence=true → ignora (já exibido via palavras)
   - isComplete=true → move streamingText para messages[], limpa

3. AGENT_AUDIO recebido:
   - Adiciona à fila de reprodução
   - Reproduz sequencialmente
```

---

*Correção aplicada: streamingText agora é limpo quando usuário finaliza pergunta, garantindo isolamento entre respostas do assistente.*
