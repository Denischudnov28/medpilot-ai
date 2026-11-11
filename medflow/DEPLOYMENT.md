# MEDFLOW deployment notes

## Required environment

- `DATABASE_URL`: PostgreSQL connection string. Prefer the Render internal connection string when the web service and database are in the same region.
- `MEDFLOW_TOKEN_SECRET`: a cryptographically random secret, at least 32 random bytes. Generate it with `openssl rand -hex 48`. Never commit it to Git.
- Existing MedPilot AI settings (`OPENAI_API_KEY`, `OPENAI_MODEL`) remain separate.

The API creates its initial MEDFLOW tables and indexes on startup. The standalone reference schema is in `schema.sql`.

## First release scope

- Email/password registration and login.
- Passwords hashed with Node.js scrypt and per-user random salts.
- Signed, short-lived bearer tokens.
- Patient worklist entries and shift notes scoped to the authenticated account.
- Ownership checks on reads, updates and deletes.
- Rate limiting on API and authentication endpoints.

## Data protection boundary

This is an early product prototype, not a certified electronic health record. Do not enter patient names, dates of birth, record numbers, images, or other directly identifying/sensitive health information. Before any real clinical use, add a documented privacy/security review, backup and recovery procedures, access logging, retention/deletion controls, incident response, and jurisdiction-specific compliance review. The current patient table is intentionally limited to a display code, unit and handoff note, but free-text notes can still contain sensitive information.

## Smoke checks after configuration

1. `GET /api/medflow/status` should return `{"ready":true,"authentication":true,"sync":true}`.
2. Register a test account using `POST /api/medflow/auth/register`.
3. With the returned bearer token, create and list a test patient at `/api/medflow/patients`.
4. Verify a second account cannot read or delete the first account's records.
5. Verify logout clears the browser session token.
