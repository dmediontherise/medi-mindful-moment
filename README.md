# Medi Mindful Moment

A responsive, local-first daily affirmation web & desktop application built with JavaScript, Tailwind CSS, Vite, and Electron.

---

## Electron Desktop Application & Screensaver Setup

Medi Mindful Moment delivers a cross-platform desktop screensaver experience for Windows and macOS.

### Desktop Commands
```bash
# Run desktop app in development mode against Vite dev server
npm run electron:dev

# Package native desktop distributables for host platform (Windows NSIS/portable, macOS DMG)
npm run electron:build
```

### Architecture & Idle Screensaver Behavior
- **Idle Detection**: Uses Electron `powerMonitor.getSystemIdleTime()` polling to track system activity.
- **Standalone Ambient Reuse**: Reuses the existing web ambient view at `?ambient=1&mood=<Mood>` loaded on the primary display.
- **Dismissal & Anti-Loop Gate**: Any key press or mouse input dismisses the fullscreen screensaver and records dismissal state to prevent dismiss-then-immediately-reopen loops while system idle time remains above threshold.
- **Settings Persistence**: Persists user settings (`idleThresholdMinutes`, `mood`, `rotationIntervalSeconds`, `openAtLogin`) in `settings.json` under OS `userData`.
- **Launch at Login**: Managed via `app.setLoginItemSettings({ openAtLogin })` (default disabled).
- **Security Scoping**: Enforces `contextIsolation: true`, `nodeIntegration: false`, and exposes minimal IPC APIs via `contextBridge` in `electron/preload.js`.

### Code-Signing Reality & Distribution
- **Windows**: Unsigned `.exe` installers (`NSIS`) and portable executables trigger Microsoft Defender SmartScreen warnings ("Unknown Publisher") on initial execution. Production distribution requires an EV Code Signing Certificate.
- **macOS**: Unsigned `.dmg` installers built on macOS are blocked by Apple Gatekeeper ("App cannot be opened because it is from an unidentified developer"). Official distribution requires an active Apple Developer Program subscription ($99/year), code signing certificates, and Xcode notarization (`xcrun notarytool`). For local testing of unsigned builds, users must right-click the `.app` and select **Open**, or clear quarantine attributes via `xattr -cr /path/to/App.app`. Note that macOS binaries cannot be produced from a Windows build host.

---

## Firebase Google Authentication & Firestore Sync Setup Guide

Follow these step-by-step instructions to set up Google Sign-In and cross-device sync for your environment:

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Enter a project name (e.g., `medi-mindful-moment`) and click **Continue**.
4. (Optional) Disable or enable Google Analytics, then click **Create project**.

### Step 2: Register a Web App
1. In your project dashboard, click the **Web icon** (`</>`) to add an app.
2. Enter an App nickname (e.g., `medi-mindful-web`).
3. Click **Register app**.
4. Copy the `firebaseConfig` keys provided in the code snippet.

### Step 3: Enable Google Authentication
1. In the left sidebar, click **Build** > **Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, select **Google**.
4. Toggle **Enable**. Select a support email for your project and click **Save**.

### Step 4: Configure Authorized Domains
1. In **Authentication**, click the **Settings** tab at the top.
2. Select **Authorized domains**.
3. Verify that `localhost` is listed. Add any custom domain or hosting URL where your application will run.

### Step 5: Create Firestore Database
1. In the left sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Select your location and click **Next**.
4. Choose **Start in production mode** and click **Create**.

### Step 6: Deploy Firestore Security Rules
1. In Firestore, click the **Rules** tab.
2. Replace the editor contents with the rules from the `firestore.rules` file in this repository:
```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. Click **Publish**.

### Step 7: Environment Variables Setup
1. In the project root directory, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your credentials from Step 2:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

---

## Local Development

```bash
# Install dependencies
npm install

# Run web dev server
npm run dev

# Run desktop app in development mode
npm run electron:dev

# Run unit tests
npm test -- --run

# Build web production bundle
npm run build

# Build desktop distributables
npm run electron:build
```
