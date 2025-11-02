# Database Schema Documentation

## Overview
This application uses a single relational database to store all data: user accounts, voice settings, and session data. The system supports both SQLite (development) and PostgreSQL/Neon (production) through Drizzle ORM.

## Database Configuration
- **Development**: SQLite (`data/dev.db`)
- **Production**: PostgreSQL via `DATABASE_URL` environment variable (Neon recommended)
- **All data consolidated**: Users, settings, and sessions in one database for simplicity

## Tables

### users
Stores user account information for authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 unique identifier |
| username | TEXT | NOT NULL, UNIQUE | User's login username |
| password | TEXT | NOT NULL | Bcrypt-hashed password |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `username`

**Relationships:**
- One-to-one with `voice_settings` via `userId`

### voice_settings
Stores user-specific voice agent configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | TEXT | PRIMARY KEY | References users.id |
| settings | TEXT | NOT NULL | JSON string of voice settings |
| updated_at | INTEGER | NOT NULL | Unix timestamp of last update |

**Indexes:**
- PRIMARY KEY on `user_id`

**Relationships:**
- Foreign key to `users.id`

### sessions
Stores user session data for authentication state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| sid | TEXT | PRIMARY KEY | Session ID |
| sess | TEXT | NOT NULL | JSON string of session data |
| expire | INTEGER | NOT NULL | Unix timestamp of expiration |

**Indexes:**
- PRIMARY KEY on `sid`

**Features:**
- Automatic cleanup of expired sessions every 15 minutes
- JSON serialization of session objects

### __drizzle_migrations__ (PostgreSQL only)
Tracks applied database migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| hash | TEXT | NOT NULL | Migration file hash |
| created_at | BIGINT | - | Migration timestamp |

## Data Types and Validation

### User Data
- **id**: Generated using `crypto.randomUUID()`
- **username**: 1-50 characters, alphanumeric + underscores
- **password**: Minimum 8 characters, hashed with bcrypt (10 rounds)

### Voice Settings
- **settings**: JSON object validated against `voiceSettingsSchema` (Zod)
- **updated_at**: Unix timestamp (milliseconds)

Example settings JSON:
```json
{
  "sttModel": "gpt-4o-transcribe",
  "ttsModel": "gpt-4o-mini-tts",
  "voice": "alloy",
  "language": "pt-BR",
  "reasoningEffort": "medium"
}
```

## Migration Strategy
- Use `npm run db:generate` to create migration files after schema changes
- Use `npm run db:migrate` to apply migrations safely (preserves data)
- Use `npm run db:push` for initial setup or forced schema sync (may lose data)

## Session Management
- Stored in separate SQLite database for performance
- Automatic cleanup of expired sessions (15-minute intervals)
- Session TTL: 7 days
- Uses `better-sqlite3-session-store`

## Security Considerations
- Passwords: Bcrypt hashing with salt
- Sessions: Secure cookies, httpOnly, sameSite=lax
- Database URLs: Never committed to code, use environment variables
- User IDs: UUID v4 for unpredictability

## Development Setup
1. For local development: No setup needed, uses SQLite automatically
2. For production: Set `DATABASE_URL` to PostgreSQL connection string
3. Run `npm run db:push` to initialize schema
4. Run `npm run db:migrate` for future updates

## Monitoring
- Check table sizes periodically
- Monitor session cleanup logs
- Validate settings JSON on read/write
