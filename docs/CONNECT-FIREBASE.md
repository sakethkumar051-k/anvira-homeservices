# Connect this local app to Firebase

Project: `anvira-services`. On 6 October 2026, the local Authentication and Firestore connection checks succeeded and the preview switched to Firebase mode. Matching native configuration files are present. The verified Owner `anviraservicesllp@gmail.com` has active Owner permissions and email/password sign-in configured; use **Owner & professional sign in** with the new app password. The project still needs catalog/company policies and payment setup. Public Firebase identifiers alone do not authorize the API to use Authentication or Firestore.

## Authorize the project account

Use Node 24 and sign in with the account that has access to this project:

```sh
node node_modules/firebase-tools/lib/bin/firebase.js login:add anviraservicesllp@gmail.com --interactive
```

Complete Google's authorization page in a browser on this Mac. It returns automatically to the local CLI and no copied authorization code is needed. If signing in from a different device, add `--no-localhost` and enter the one-time code shown by that separate authorization page into the waiting terminal. The Firebase Console does not display this code. Do not save authorization codes in source files.

The local credential helper reuses that Firebase CLI authorization. It writes a private, ignored credential file under `credentials/` and never prints its contents:

```sh
node scripts/prepare-firebase-credentials.mjs
node --env-file=.env.firebase.local scripts/check-firebase.mjs --dashboard
```

The connection check reads Authentication and Firestore without creating users, bookings or other records. `--dashboard` also checks the indexed queries used after staff sign-in. Deploy `firestore.indexes.json` with `firebase deploy --only firestore:indexes --project anvira-services --account anviraservicesllp@gmail.com`, then wait for the indexes to finish building. All readiness reads must succeed before switching a preview to Firebase. An initialized SDK or a successful document read alone does not confirm dashboard readiness.

## Start after verification

The prepared `.env.firebase.local` selects Firebase authentication and the real payment adapter. It contains the public app configuration and a path to local credentials. It must remain ignored by version control.

After the connection check succeeds, stop the demo API, build the browser client with the same environment, and run the API:

```sh
node --env-file=.env.firebase.local node_modules/expo/bin/cli export --platform web --clear
node --env-file=.env.firebase.local server/index.mjs
```

Open `http://localhost:4000`. Live checkout requires the Razorpay credentials; Google and Email/Password are enabled; phone authentication is disabled and removed from the app. The initial Owner must be a verified Firebase Authentication user provisioned with `scripts/bootstrap-owner.mjs`. See `PRODUCTION.md` for those steps.

These local OAuth credentials are for this Mac only. Deploy the backend with its own Google-managed runtime identity. Native iOS/Android development builds also need ANVIRA's matching Firebase configuration files.

References: [Firebase Admin setup](https://firebase.google.com/docs/admin/setup), [Firebase CLI authorization](https://firebase.google.com/docs/cli), [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/).
