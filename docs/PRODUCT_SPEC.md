# MedPilot AI 1.0 — Product Specification

## Product direction
A bilingual-ready (Russian-first) clinical reference and workflow assistant for healthcare professionals, released for iOS and Android. The product is decision support and education, not a substitute for clinical judgement, local protocols, or a licensed clinician.

## Existing foundation to preserve
- Node.js / Express backend and existing /api/health and /api/chat endpoints.
- Existing Russian-language PWA and clinical content.
- Specialty-aware AI responses.
- Existing calculator catalogue and specialty pages.
- Existing clinical protocol material: sepsis/septic shock, anaphylaxis, and difficult airway.
- Existing server protections (Helmet, JSON body limit, API rate limiting).

## MVP product modules
1. Clinical AI assistant: specialty selection, structured answers, uncertainty disclosure, citations/source links where available, conversation history, report/feedback controls.
2. Clinical calculators: searchable catalogue, favorites, recent calculations, clear units, formula/methodology, input validation, reference ranges, source and version date.
3. Clinical reference library: protocols, checklists, emergency algorithms, source/version history.
4. Medication reference: initially informational monographs and links to authoritative sources. Drug-dose calculators remain disabled until provenance, clinical validation, governance, and jurisdictional review are documented.
5. Account and sync: sign-in, profile, settings, cross-device restore, data export and account deletion.
6. Subscription: free tier and auto-renewing Premium monthly/yearly plans, with one entitlement shared between iOS and Android.
7. Safety and privacy: prominent intended-use statement, warnings, privacy controls, support and adverse-content reporting.

## Proposed technical architecture
- Mobile: React Native + Expo + TypeScript, shared iOS/Android codebase.
- Backend: preserve and incrementally modularize the existing Node.js / Express service.
- Database: PostgreSQL for accounts, entitlements, saved items, history metadata, and content versions.
- Authentication: standards-based managed authentication; no passwords stored in plaintext.
- Subscription: Apple StoreKit and Google Play Billing through a cross-platform subscription layer; server-side entitlement verification and restore flow.
- API: versioned /api/v1 routes, request validation, rate limits, structured logs, health checks.
- Content: clinical content stored with source, owner, review date, version, and change history.

## Monetization
Subscription is the selected model. Proposed monthly/yearly prices are not final and must be localized and tested. The paywall must clearly state price, billing period, renewal behavior, trial terms (if any), cancellation route, and included features. Existing users must retain any previously paid access if applicable.

## Non-goals for the first public release
- Autonomous diagnosis or treatment decisions.
- Unverified medication dose recommendations.
- Claims of regulatory clearance or clinical accuracy without evidence.
- Uploading identifiable patient records by default.

## Release gates
- Clinical content review and named accountable reviewers.
- Security/privacy review, data map, retention/deletion flow.
- Test coverage for calculators and API validation.
- iOS and Android device testing.
- Store subscription sandbox tests, restore/cancel/renewal tests.
- App Store / Google Play metadata, privacy disclosures, support URL, reviewer demo account.
