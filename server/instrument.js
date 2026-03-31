// server/instrument.js
const Sentry = require("@sentry/node");
const log = require("./utils/logger");

const dsn = process.env.SENTRY_DSN;
const isPlaceholder = !dsn || dsn === "YOUR_SENTRY_DSN_HERE" || dsn.includes("YOUR_");

if (dsn && !isPlaceholder) {
  Sentry.init({
    dsn: dsn,
    // Performance Monitoring
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
  log.success("SENTRY", "Sentry initialized successfully.");
} else {
  log.warn("SENTRY", "SENTRY_DSN is missing or invalid. Error tracking is disabled.");
}
