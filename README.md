# REST Express + React Boilerplate

Stack moderno, escalável e KISS: Express + React + SQLite (dev) + Drizzle ORM.

## Stack

- **Backend**: Express + TypeScript + Drizzle ORM + SQLite (dev)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Auth**: Passport Local + express-session + bcrypt
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

## Produção no Replit

No Autoscale, o app roda stateless (sem SQLite em arquivo).
Migre para Postgres antes do deploy.
