# Voice Agent Backend + React App

Stack moderno, escalável e KISS: Express + React + SQLite (dev) + Drizzle ORM + OpenAI Voice Agent (chained architecture).

## Stack

- **Backend**: Express + TypeScript + Drizzle ORM + SQLite (dev) + WebSocket
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + Web Audio API
- **Auth**: Passport Local + express-session + bcrypt
- **Voice Agent**: OpenAI (Whisper STT + GPT-4o-mini + TTS-1) - Chained Architecture
- **Validation**: Zod
- **Tests**: Vitest + Supertest

## Setup

```bash
npm install
npm run db:push  # criar tabelas SQLite
```

## Scripts

```bash
npm run dev         # dev server (porta 5000)
npm run build       # build para produção
npm run start       # rodar produção
npm test            # rodar testes
npm run test:watch  # testes em watch mode
npm run check       # type check
npm run db:push     # aplicar migrations
```

## Estrutura

```
├── client/          # React app
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── lib/
├── server/          # Express API
│   ├── config/      # env, auth
│   ├── db/          # database connection
│   ├── routes/      # API routes
│   ├── middlewares/ # validation, auth
│   └── storage.ts   # data layer (IStorage)
├── shared/          # código compartilhado
│   └── schema.ts    # Drizzle schemas + Zod
└── tests/           # testes Vitest
```

## API Endpoints

### Auth (`/api/v1/auth`)

- `POST /register` - criar conta (username, password)
- `POST /login` - autenticar
- `POST /logout` - deslogar
- `GET /me` - usuário atual (requer auth)

## Secrets (Replit)

Configure no painel Secrets:

- `OPENAI_API_KEY` - **obrigatório** para voice agent
- `SESSION_SECRET` - chave da sessão (prod)
- `DATABASE_URL` - para migração futura para Postgres

## Migração SQLite → Postgres

O projeto usa interface `IStorage` - trocar implementação:
1. Criar `PgStorage` implementando `IStorage`
2. Atualizar `server/storage.ts` para usar Postgres
3. Ajustar `drizzle.config.ts` para `dialect: "postgresql"`

## Testes

```bash
npm test              # rodar todos os testes
npm run test:watch    # modo watch
```

9 testes cobrem fluxo completo de autenticação:
- Register (sucesso, duplicata, validação)
- Login (sucesso, senha errada, usuário inexistente)
- Me (autenticado, não autenticado)
- Logout

## Voice Agent

### Arquitetura

**Chained Pipeline** (STT → LLM streaming → TTS):
1. **Speech-to-Text**: Whisper API (OpenAI)
2. **LLM Streaming**: GPT-4o-mini com sentence chunking
3. **Text-to-Speech**: tts-1 (otimizado para velocidade)

### Endpoints

- **WebSocket**: `ws://localhost:5000/ws/voice`
  - Client → Server: audio chunks (webm/mp3)
  - Server → Client: transcripts, agent text, audio chunks

### Features

- ✅ Real-time bidirectional communication
- ✅ Sentence-based chunking (reduz latência percebida)
- ✅ Tool calling (function, search, handoff)
- ✅ Conversation history management
- ✅ Audio buffering durante processamento

### Tools Disponíveis

- `search_knowledge_base` - busca na base de conhecimento
- `transfer_to_human` - transfere para agente humano
- `get_user_info` - informações do usuário

### UI Demo

Acesse: `http://localhost:5000/voice`

### Latência Típica

- STT: ~200-400ms (Whisper)
- LLM: streaming (~50ms TTFT, depois contínuo)
- TTS: ~300-500ms por chunk
- **Total percebido**: ~800ms até primeiro áudio

## Produção no Replit

No Autoscale, o app roda stateless (sem SQLite em arquivo).
Migre para Postgres antes do deploy.
