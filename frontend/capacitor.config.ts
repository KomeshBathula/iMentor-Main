import type { CapacitorConfig } from '@capacitor/cli';

// ─── Capacitor Configuration ──────────────────────────────────────────────────
// This file controls how Capacitor wraps the React/Vite web app into a
// native Android / iOS shell.
//
// Build mobile app:
//   npm run build:mobile      ← Vite build (relative paths) + cap sync
//   npm run cap:android       ← open Android Studio
//   npm run cap:ios           ← open Xcode (macOS only)
//
// Live-reload during development:
//   Uncomment server.url below, set it to your dev machine's LAN IP:port,
//   run `npm run dev` on your machine, then deploy the debug APK/IPA once.
//   The WebView will load from your live dev server automatically.
// ─────────────────────────────────────────────────────────────────────────────

const config: CapacitorConfig = {
    appId:   'com.imentor.app',
    appName: 'iMentor',
    webDir:  'dist',          // output of `vite build` (relative to this file)

    server: {
        // ── Production ────────────────────────────────────────────────────────
        // Leave these commented out in production — the WebView loads from the
        // bundled dist/ files and calls VITE_BACKEND_URL for API requests.

        // ── Development live-reload ───────────────────────────────────────────
        // Uncomment and set to your LAN IP to live-reload from the Vite dev server.
        // url:       'http://172.180.14.125:3005',
        // cleartext:  true,    // allow HTTP on Android (dev only)

        // iOS: capacitor://localhost  Android: http://localhost
        // Both are considered "secure" by the respective WebViews, so cookies,
        // localStorage, and mic permissions all work correctly.
        androidScheme: 'https',    // serve from https://localhost on Android WebView
    },

    android: {
        // Allow mixed content during development (HTTP images from API responses).
        // Set to false before publishing to Play Store.
        allowMixedContent: true,

        // Target recent Android (API 33 = Android 13 recommended minimum)
        minWebViewVersion: 60,
    },

    ios: {
        // Allow arbitrary loads from HTTPS only; see Info.plist NSAppTransportSecurity
        // for fine-grained control if needed.
        contentInset: 'automatic',
    },

    plugins: {
        SplashScreen: {
            launchShowDuration:   0,        // remove splash immediately
            backgroundColor:      '#121212',
            androidSplashResourceName: 'splash',
            showSpinner:          false,
        },

        StatusBar: {
            // Match the dark VS Code shell background
            style:           'Dark',
            backgroundColor: '#1a1a1a',
        },

        App: {
            // Deep links: imentor://  (configure intent filters in AndroidManifest)
        },
    },
};

export default config;
