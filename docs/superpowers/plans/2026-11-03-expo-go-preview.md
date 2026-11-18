# Expo Go preview implementation plan

Goal: supply an actual Expo Go QR that supports the existing seeded customer and partner email/password accounts against the hosted test backend.

Design: detect Expo Go with Expo SDK 57's `isRunningInExpoGo`; use the existing Firebase JavaScript auth implementation through a small adapter. Preserve the installed app's native Firebase implementation. Keep interactive sign-in from triggering a second premature state load. Expo Go sessions stay in memory, so closing/reloading requires sign-in again. Google/Apple native sign-in and remote push testing require an installed build.

The user has explicitly requested Expo Go, fast implementation and autonomous development. No new paid service or account is needed.

- [x] Add a regression test exercising real Firebase JS login/token/logout through a local emulator-compatible HTTP boundary, including rejected credentials and auth-state callbacks during interactive login.
- [x] Move native auth intact to auth-device.ts and select it or the Expo Go adapter in auth.native.ts. Explain unsupported provider sign-in with an actionable message.
- [x] Run focused tests, full tests, lint and typecheck. Start Expo CLI in Go mode using the hosted test configuration, obtain a reachable preview URL and create/inspect its QR.
- [x] Verify the manifest and Android/iOS JS bundles. Verify seeded login through the new adapter without printing tokens. Deliver the QR with session lifetime and native-feature limits.

Review focus: installed app auth stays selected outside Expo Go; credentials are never put into a QR, source file or bundle; native imports must remain unevaluated in Expo Go; failed sign-in must not establish a session; customer and professional workspaces must retain backend authorization.

Preview server uses `--no-dev`: SDK 57 development env HMR creates a context for all root `.env*` files, while its transformer parses only standard environment filenames. The existing ignored `.env.demo.local` and `.env.firebase.local` therefore produced a reproducible SyntaxError. Non-development preview avoids that dev-only context without changing or exposing configuration files.

Verification: 303 tests, lint and typecheck passed. Android and iOS non-development preview bundles both returned HTTP 200, and the public tunnel manifest returned HTTP 200. Customer01 and partner01 signed in with this JS adapter and loaded their correct hosted workspaces (HTTP 200). Physical Expo Go acceptance remains to be performed on the user’s phone.
