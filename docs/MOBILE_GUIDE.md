# EZoom Android and iOS guide

EZoom uses Capacitor to package the React classroom UI as native Android and iOS applications. The bundled UI connects to an HTTPS EZoom service for accounts and live classroom events. It does not load the hosted website as the app's main screen.

## Requirements

### Android

- Node.js 22 or later
- Android Studio with a current Android SDK
- Java 21 (required by Capacitor 8)

### iOS

- Xcode 26 or later on macOS, or a hosted macOS GitHub Actions runner
- An Apple Developer account for device signing and App Store distribution

The iOS project can be generated and updated on Windows, but it must be compiled, signed, and archived on macOS. The repository includes a manual GitHub Actions workflow for people without a Mac.

## Project layout

- `capacitor.config.ts` – native app identity
- `android/` – Android Studio project
- `ios/` – Xcode project
- `public/ezoom-logo.png` – EZoom brand artwork

The native application identifier is `com.ezoom.education` and the display name is **EZoom**.
The iOS app icon and launch image use the EZoom teal monitor design rather than Capacitor placeholders.

Apple setup (15 October 2026): App ID `com.ezoom.education` is registered under team `B7W9JEQ9XA`. The [EZoom App Store Connect record](https://appstoreconnect.apple.com/apps/6822637486/distribution) exists with SKU `EZOOM-IOS-001`. Build 1.0 (1) is testing in the `EZoom Internal Testers` group, which includes `ejoetso@ymail.com`. The Xcode project uses automatic signing with that team ID. Build 1.0 (2), which adds Sign in with Apple, is not distributed until its App ID capability and new archive are verified.

Google Cloud setup (14 October 2026): project `ezoom-mobile-backend` (number `960852938301`) was created under `joe.tso@gmail.com`, but no billing account was linked and no Cloud Run service was deployed. Paid Render hosting was considered but not selected. For iPhone testing, the EZoom server on this PC is exposed through Tailscale Funnel at `https://laptop-iahsqh9b.tail29118b.ts.net`. HTTPS health, licence-status, privacy-page, and WebSocket checks passed on 14 October 2026. The PC, Tailscale service, Funnel, and EZoom server must remain running for the app to work; this is a testing setup, not a durable cloud deployment. Tailscale's free Personal plan is for non-commercial use; arrange an appropriate hosted service before commercial distribution.

## Synchronise the web application

Run this after changing the React application or native configuration:

```bash
npm run mobile:sync
```

The command builds EZoom and synchronises Capacitor configuration and web assets into both native projects.

## Android development

Open Android Studio:

```bash
npm run mobile:android
```

Select an emulator or connected device and run the `app` configuration. The Android manifest already declares internet, camera, microphone, and audio permissions. Android asks the user for camera and microphone access when EZoom first needs them.

Build a debug APK from the command line:

```bash
cd android
./gradlew assembleDebug
```

On Windows use `gradlew.bat assembleDebug`. The APK is written under `android/app/build/outputs/apk/debug/`.

For Google Play distribution, create a private signing key, configure the release signing settings outside source control, and generate an Android App Bundle with `bundleRelease`.

## iOS development

On a Mac, synchronise and open Xcode:

```bash
npm run mobile:sync
npm run mobile:ios
```

In Xcode:

1. Select the **App** target.
2. Choose your Apple development team.
3. Confirm the bundle identifier `com.ezoom.education` is available to your account.
4. Select an iPhone simulator or connected device.
5. Enable **Sign in with Apple** for the `com.ezoom.education` App ID in Apple Developer Certificates, Identifiers & Profiles before signing Build 2.
6. Run the app and approve camera and microphone access.

The project contains the required `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` entries. Use **Product → Archive** for TestFlight or App Store submission.

## Use another server

The native app no longer defaults to the historical EZoom Cloud Run URL. As checked on 14 October 2026, that URL serves website HTML for `/api/health` and `/api/license/status`, so it is **not a working API for this release**. Deploy the updated EZoom server to a durable HTTPS host and set `VITE_EZOOM_API_URL` before synchronising:

```bash
VITE_EZOOM_API_URL=https://your-ezoom.example.com npm run mobile:sync
```

In PowerShell:

```powershell
$env:VITE_EZOOM_API_URL = "https://your-ezoom.example.com"
npm run mobile:sync
```

Use HTTPS. The Android project rejects cleartext traffic, and iOS restricts insecure network and media access.

Run `npm run ios:check` after syncing. This verifies the native source settings and calls the configured API endpoints; it must pass before making a release archive. It fails when the server URL is missing or does not serve the required API. It does not replace a signed build or device test.

The `ios/App/ci_scripts/ci_post_clone.sh` script prepares web assets and checks the API in Xcode Cloud. Configure `VITE_EZOOM_API_URL` as a workflow environment variable. Xcode Cloud currently shows "Get started in Xcode" for this Apple team. Its first workflow must be configured from Xcode on a Mac; no cloud build is available from App Store Connect yet. Do not add a build to the internal testing group until the HTTPS backend passes preflight and an iPhone device test succeeds.

### Hosted macOS build without a personal Mac

The manual `.github/workflows/ios-testflight.yml` workflow uses a GitHub-hosted macOS runner, Xcode, and Apple cloud signing. It is not active until the source is safely committed to the EZoom GitHub repository and the following repository settings are configured:

1. Set Actions variable `EZOOM_API_URL` to the verified HTTPS EZoom API URL. The workflow fails preflight if the API is absent or returns website HTML.
2. Create a dedicated App Store Connect **team API key** with sufficient cloud-signing access. Store its key ID, issuer ID, and base64-encoded private `.p8` key as Actions secrets `EZOOM_ASC_KEY_ID`, `EZOOM_ASC_ISSUER_ID`, and `EZOOM_ASC_KEY_BASE64`. Never commit the private key or echo it in logs. Team keys can access all apps under their assigned role, so review the role carefully.
3. Run **EZoom iOS TestFlight** manually in GitHub Actions. It builds and checks the app, archives it, and uploads through Xcode. Confirm the processed build appears in App Store Connect before adding it to the internal group.

The workflow and export settings are prepared but have not been run or validated on a macOS runner. A passing GitHub job is not a substitute for testing camera, microphone, audio, screen sharing, and room joining on a real iPhone.

The server permits API requests from Capacitor's local origin. Ensure the same backend is used by the web and native apps so room codes and accounts work across devices. Registered accounts are saved under `LICENSE_DATA_DIR`; production deployments need a durable, backed-up volume. Ephemeral container storage will lose accounts on restart.

## Account flow

For the iOS release, educators select **Continue with Apple**. Apple may provide a private relay email. The server verifies Apple's identity token, creates the educator account on first sign-in, and allows 60-minute sessions without an installation activation key. The Apple account can be deleted in the iOS app after reauthentication. iOS builds must set `VITE_EZOOM_IOS=1`; the TestFlight workflow does this automatically. The backend must include `/api/educator/apple/challenge` and `/api/educator/apple` before distributing the build. Web and Android keep the existing licence-key and email/password flow.

For web and Android:

1. On the educator portal, choose **Create account**.
2. Enter a name, email, and password of at least 12 characters, then confirm it.
3. After registration, create a classroom. Self-registered users have a 60-minute session limit.
4. To remove an account, sign in, choose **Delete account**, enter the current password, and confirm. The server deletes the account record and revokes sign-in sessions.

Students do not need an account; they join with a session code, name, email, and the on-screen security challenge.

## Media testing checklist

Test on physical Android and iOS devices before release:

1. Educator sign-in and room creation
2. QR/session-code student entry
3. Camera preview and camera on/off state
4. Educator microphone and student playback
5. Waiting-room approval
6. Chat, Q&A, polls, and whiteboard synchronisation
7. App backgrounding and reconnection
8. A complete 60-minute trial meeting

Mobile operating systems and embedded browsers may restrict screen capture differently from desktop browsers. Verify screen sharing on every supported OS version and provide the whiteboard/resource workflow when device-level capture is unavailable.

## Release notes

- Do not store administrator credentials or licence keys in the app bundle.
- Keep the cloud server, public privacy notice (`/privacy.html`), support contact, and in-app account deletion available before store submission. Review the notice against the final production data flows and provide its live URL in App Store Connect.
- Apple review still requires hands-on tests on current iPhone/iPad hardware, accurate App Privacy answers, screenshots, and a reviewer demo account. Registration, 60-minute expiry, camera/microphone prompts, WebSocket reconnection, screen sharing, AI consent, and deletion all need testing.
- Verify Apple Guideline 4.2 (minimum functionality) against the final native app. Bundling the UI reduces dependence on a website wrapper, but does not guarantee acceptance.
- App Store and Google Play signing credentials must remain private and outside Git.
- Update version numbers in the native projects for each store release.

For deployment, education licensing, or collaboration, email **eozoe2025@gmail.com**.

Copyright © 2026 Ejoe Tso. All rights reserved.
