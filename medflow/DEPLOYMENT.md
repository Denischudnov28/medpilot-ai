# MEDFLOW deployment notes

## Required environment

- `DATABASE_URL`: PostgreSQL connection string. Prefer the Render internal connection string when the web service and database are in the same region.
- `MEDFLOW_TOKEN_SECRET`: a cryptographically random secret, at least 32 random bytes. Generate it with `openssl rand -hex 48`. Never commit it to Git.
- Existing MedPilot AI settings (`OPENAI_API_KEY`, `OPENAI_MODEL`) remain separate.

The API creates its initial MEDFLOW tables and indexes on startup. The standalone reference schema is in `schema.sql`.

## Subscription foundation

- A `medflow_subscriptions` row is created for every existing and new account with the `free` plan by default.
- `GET /api/medflow/billing/status` returns the server-authoritative plan and entitlement state for the authenticated account.
- A Pro entitlement is recognized only for `trialing` or `active` subscriptions whose billing period has not expired.
- The browser cannot activate or modify a subscription. Only a future verified payment-provider webhook may update subscription state.
- No payment provider, checkout, paid feature gate, or automatic charge is enabled in this release.

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


## Payment preparation (no live payments)

- The payment-order ledger records provider, RUB amount in kopecks, idempotency key, provider payment reference, a 30-day access period, and payment state.
- Supported provider identifiers are reserved for manual bank transfer, YooKassa, and Sberbank acquiring. This is database preparation only; no checkout endpoint, card transfer monitoring, provider credentials, recurring charge, or webhook is enabled.
- Creating or receiving a pending order never grants Pro. Pro can only be enabled after a server-side verification of a successful payment, matching provider payment ID, amount, currency, and order metadata.
- Manual transfer to a personal bank card cannot be reliably confirmed by a browser redirect or a user-uploaded receipt. It would require a trusted bank statement/API reconciliation process or explicit administrator review; never trust the client as proof of payment.
- Do not store card numbers, CVV, banking passwords, or raw bank credentials. Keep provider secrets in Render environment variables, never in Git or browser code.
- The proposed 499 RUB / 30 days price is provisional. Live payments remain disabled until the merchant's legal/tax eligibility, provider contract, receipt/fiscalization flow, privacy terms, and cancellation/refund process are reviewed.
- For a future YooKassa integration, acknowledge webhooks only after checking the current payment object server-side and matching it to the pending order; YooKassa documents webhook delivery and authenticity checks at https://yookassa.ru/developers/using-api/webhooks.

### Pending payment-order API

- Authenticated POST /api/medflow/billing/orders creates a server-priced 30-day RUB order (default 499 RUB; optional server env MEDFLOW_PRO_PRICE_KOPECKS, in kopecks).
- Authenticated GET /api/medflow/billing/orders/:id returns only the requesting user's order.
- These endpoints are order tracking only: no payment link, card details, bank transfer confirmation, webhook, or Pro activation is enabled.
- getProPriceKopecks validates the server-side price; isMatchingSuccessfulPayment requires successful status and exact order/provider/amount/currency match before a future verified-payment handler can consider activation.
- Unit tests cover invalid prices and mismatched payment confirmations. A pending order must never be treated as paid.
