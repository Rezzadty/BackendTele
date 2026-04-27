function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseBoolean(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

const env = {
  PORT: parsePositiveInteger(process.env.PORT, 3000),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID || "",
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || "",
  FIREBASE_AUTH_TOKEN: process.env.FIREBASE_AUTH_TOKEN || "",
  FIREBASE_API_KEY:
    process.env.FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  FIREBASE_AUTH_EMAIL: process.env.FIREBASE_AUTH_EMAIL || "",
  FIREBASE_AUTH_PASSWORD: process.env.FIREBASE_AUTH_PASSWORD || "",
  FIREBASE_SENSOR_PATH: process.env.FIREBASE_SENSOR_PATH || "sensor/latest",
  ENABLE_FIREBASE_POLLING_WORKER: parseBoolean(
    process.env.ENABLE_FIREBASE_POLLING_WORKER,
    true
  ),
  FIREBASE_POLL_INTERVAL_MS: parsePositiveInteger(
    process.env.FIREBASE_POLL_INTERVAL_MS,
    5000
  ),
  SENSOR_STATUS_FIELDS:
    process.env.SENSOR_STATUS_FIELDS || process.env.SENSOR_STATUS_FIELD || "status",
  SENSOR_DANGER_STATUS_VALUES:
    process.env.SENSOR_DANGER_STATUS_VALUES ||
    process.env.SENSOR_BAD_STATUS_VALUES ||
    "warning,danger,error,critical",
  SENSOR_CLEAN_STATUS_VALUES:
    process.env.SENSOR_CLEAN_STATUS_VALUES || "clean",
  SENSOR_STATUS_FIELD: process.env.SENSOR_STATUS_FIELD || "status",
  SENSOR_BAD_STATUS_VALUES:
    process.env.SENSOR_BAD_STATUS_VALUES || "warning,danger,error,critical",
  SENSOR_EVENT_TIMESTAMP_FIELD:
    process.env.SENSOR_EVENT_TIMESTAMP_FIELD || "updatedAt",
  ALERT_ON_MISSING_DATA: parseBoolean(process.env.ALERT_ON_MISSING_DATA, true),
  NOTIFICATION_COOLDOWN_MS: parsePositiveInteger(
    process.env.NOTIFICATION_COOLDOWN_MS,
    120000
  ),
  MAX_ISSUE_NOTIFICATIONS: parsePositiveInteger(
    process.env.MAX_ISSUE_NOTIFICATIONS,
    1
  ),
  SEND_RESOLVED_NOTIFICATION: parseBoolean(
    process.env.SEND_RESOLVED_NOTIFICATION,
    true
  ),
  DEFAULT_TELEGRAM_CHAT_ID:
    process.env.DEFAULT_TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_DEFAULT_CHAT_ID ||
    "",
};

function getRuntimeWarnings() {
  const warnings = [];
  const hasFirebaseToken = Boolean(env.FIREBASE_AUTH_TOKEN);
  const hasFirebaseEmailPasswordAuth = Boolean(
    env.FIREBASE_API_KEY && env.FIREBASE_AUTH_EMAIL && env.FIREBASE_AUTH_PASSWORD
  );
  const hasPartialFirebaseEmailPasswordAuth =
    Boolean(env.FIREBASE_API_KEY) ||
    Boolean(env.FIREBASE_AUTH_EMAIL) ||
    Boolean(env.FIREBASE_AUTH_PASSWORD);

  if (!env.TELEGRAM_BOT_TOKEN) {
    warnings.push(
      "TELEGRAM_BOT_TOKEN is empty. Telegram notification will be skipped."
    );
  }

  if (!env.TELEGRAM_DEFAULT_CHAT_ID) {
    warnings.push(
      "TELEGRAM_DEFAULT_CHAT_ID is empty. Provide telegramChatId in request body or set this env value."
    );
  }

  if (env.ENABLE_FIREBASE_POLLING_WORKER && !env.FIREBASE_DATABASE_URL) {
    warnings.push(
      "FIREBASE_DATABASE_URL is empty. Realtime polling worker will not start."
    );
  }

  if (env.ENABLE_FIREBASE_POLLING_WORKER && !env.FIREBASE_AUTH_TOKEN) {
    if (!hasFirebaseEmailPasswordAuth) {
      warnings.push(
        "Firebase auth is incomplete. Provide FIREBASE_AUTH_TOKEN, or FIREBASE_API_KEY + FIREBASE_AUTH_EMAIL + FIREBASE_AUTH_PASSWORD for automatic token refresh."
      );
    }
  }

  if (
    env.ENABLE_FIREBASE_POLLING_WORKER &&
    !hasFirebaseToken &&
    hasPartialFirebaseEmailPasswordAuth &&
    !hasFirebaseEmailPasswordAuth
  ) {
    warnings.push(
      "Partial Firebase email/password auth config found. Set all of FIREBASE_API_KEY, FIREBASE_AUTH_EMAIL, and FIREBASE_AUTH_PASSWORD."
    );
  }

  if (
    env.ENABLE_FIREBASE_POLLING_WORKER &&
    (!env.TELEGRAM_BOT_TOKEN || !env.DEFAULT_TELEGRAM_CHAT_ID)
  ) {
    warnings.push(
      "Telegram defaults are incomplete. Worker may detect issues but cannot deliver notifications."
    );
  }

  return warnings;
}

module.exports = {
  env,
  getRuntimeWarnings,
};
