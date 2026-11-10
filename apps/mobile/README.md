# MedPilot AI Mobile App

The mobile client will be built with React Native, Expo, and TypeScript for iOS and Android from one codebase.

## Initial setup target
- Expo SDK current stable at implementation time
- TypeScript strict mode
- Expo Router for navigation
- TanStack Query for server state
- React Hook Form + Zod for validated forms
- SecureStore for device-side tokens
- RevenueCat or an equivalent subscription abstraction, subject to final technical and store-policy review

## Screens in the first implementation milestone
1. Onboarding / intended-use and safety notice
2. Sign in / create account
3. Home dashboard
4. AI clinical assistant
5. Calculator catalogue and calculator detail
6. Clinical protocols and reference pages
7. Favorites and history
8. Premium paywall
9. Profile, privacy, export, and account deletion

## API integration
Use the existing Express service as the initial API. Before production, move routes under /api/v1, add authentication and persistence, and verify all clinical content before exposing it in the native client.

No production credentials, signing certificates, or API keys belong in this directory or in Git.
