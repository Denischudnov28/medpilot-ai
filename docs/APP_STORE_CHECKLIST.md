# Store Readiness Checklist — MedPilot AI

## Apple App Store
- [ ] Enroll in Apple Developer Program and confirm the legal account holder / entity.
- [ ] Create App Store Connect app record, bundle identifier, signing, and TestFlight groups.
- [ ] Configure auto-renewable subscription products and subscription group.
- [ ] Implement StoreKit purchase, restore, renewal state, grace period, billing retry, and cancellation messaging.
- [ ] Provide privacy policy URL inside the app and in store metadata.
- [ ] Complete App Privacy disclosures and data-retention / deletion workflow.
- [ ] Provide reviewer access and a complete demo mode/account.
- [ ] Supply source/methodology and evidence for medical accuracy claims.
- [ ] Obtain required provenance/approval for any drug dosage calculator before enabling it in the submitted binary.
- [ ] Explain clinical purpose, limitations, and safety measures in Review Notes.
- [ ] Submit real device screenshots and accurate subscription descriptions.

## Google Play
- [ ] Create Play Console developer account and app record.
- [ ] Configure Android package ID, signing, internal/closed testing tracks.
- [ ] Configure Play Billing subscriptions and server-side purchase-token verification.
- [ ] Complete Data safety form, privacy policy, account deletion and data deletion disclosures.
- [ ] Complete health-app declarations and any required medical-app disclosures.
- [ ] Provide tester access and a review-ready build.
- [ ] Test purchase, restore/account transfer, grace period, cancellation and refund states.

## Clinical / regulatory readiness
- [ ] Define intended purpose, intended users, contraindications, and jurisdictions.
- [ ] Determine whether features qualify as medical-device software under applicable laws (including EU MDR where relevant).
- [ ] Appoint qualified clinical reviewers and document sign-off/version history.
- [ ] Verify each calculator formula, units, rounding, edge cases, and reference source.
- [ ] Keep drug-dose calculation features disabled until eligibility and required approvals are confirmed.
- [ ] Add clear warning that the app supports, but does not replace, professional judgement and local protocols.

## Infrastructure and security
- [ ] Separate development, staging, and production environments.
- [ ] Use managed secrets; never commit API keys or signing credentials.
- [ ] Add PostgreSQL migrations, backups, monitoring, and restore tests.
- [ ] Add authentication, role checks, rate limits, audit logging, and account deletion.
- [ ] Verify AI provider configuration, cost controls, prompt-injection defenses, and sensitive-data handling.
- [ ] Add automated unit, integration, and mobile end-to-end tests.
