# Expo Go startup repair — 18 November 2026

The native development request reproduced a HTTP 500 TransformError while parsing `.env.demo.local` as JavaScript. The same problem affected `.env.firebase.local`. Expo 58's virtual development environment module discovers every root `.env*` file, while its transformer only parses the standard `.env`, `.env.local`, development and production variants. This failed before the app could render. A previous non-development preview had avoided the development-only context but did not repair `expo start` itself.

`metro.config.js` now extends `expo/metro-config` and preserves its existing resolver blocklist. An additional root-scoped rule excludes unsupported environment filenames from Metro's graph. It retains all supported environment filenames and normal app source. No local environment files were removed or read into source code, and no native authentication implementation changed.

The local public API configuration was also blank, which made native requests use the emulator-only fallback address. Its `EXPO_PUBLIC_API_URL` now points to the existing `https://anvira-api-staging.onrender.com` API. The previous local configuration was backed up privately. Website builds continue to override this value for their same-origin proxy.

## Start Expo Go

```sh
npm run start:go -- --tunnel
```

The current preview process uses port 8083 and the public Expo tunnel. Its QR and sanitized verification are local ignored artifacts: `evidence/expo-go-fixed-qr.png` and `evidence/expo-go-startup-fix.json`. Preview links expire when the process stops; generate a fresh QR after restarting. Use an Expo Go version supporting SDK 58.

## Verified

- Reproduced the original HTTP 500 before the fix.
- Regression test failed against the default configuration, then passed with the fix.
- iOS and Android development/Hermes bundle requests return HTTP 200 locally and through the public tunnel.
- Both bundles contain the reachable public API origin and exclude the checked private server configuration values.
- Hosted API readiness returns HTTP 200.
- Full suite 339 passed; lint and TypeScript passed.

A first public request timed out while both cold bundles compiled. Local compilation completed, and subsequent public requests both succeeded. Physical-phone screen acceptance is being requested from the user; bundle success alone does not prove native runtime rendering. Expo Go cannot run installed-app Firebase phone verification, Google native sign-in or native push; email sign-in remains available through the existing Expo Go adapter. This repair does not claim real SMS delivery or signed-device acceptance.
