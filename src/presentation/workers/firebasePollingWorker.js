const { safeJson } = require("../../shared/utils/http");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getByPath(source, path) {
  if (!path || !isRecord(source)) {
    return undefined;
  }

  return path
    .split(".")
    .filter(Boolean)
    .reduce((accumulator, key) => {
      if (!isRecord(accumulator) || !(key in accumulator)) {
        return undefined;
      }

      return accumulator[key];
    }, source);
}

function toLowerCsvSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function toCsvList(value) {
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : ["status"];
}

function safeString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function formatSensorValue(value) {
  const normalized = safeString(value);
  return normalized || "-";
}

function buildFirebaseJsonUrl(databaseUrl, sensorPath, authToken) {
  const base = String(databaseUrl || "").replace(/\/+$/, "");
  const cleanPath = String(sensorPath || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (!base) {
    return "";
  }

  const rawUrl = !cleanPath ? `${base}.json` : `${base}/${cleanPath}.json`;
  if (!authToken) {
    return rawUrl;
  }

  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${separator}auth=${encodeURIComponent(authToken)}`;
}

function isAuthPermissionError(statusCode, payload) {
  const message = safeString(payload?.error || payload?.error?.message).toLowerCase();

  return (
    statusCode === 401 ||
    statusCode === 403 ||
    message.includes("permission denied") ||
    message.includes("auth")
  );
}

class FirebasePollingWorker {
  constructor({ env, sendTelegramNotification }) {
    this.env = env;
    this.sendTelegramNotification = sendTelegramNotification;

    this.enabled = env.ENABLE_FIREBASE_POLLING_WORKER;
    this.databaseUrl = env.FIREBASE_DATABASE_URL;
    this.firebaseAuthToken = env.FIREBASE_AUTH_TOKEN;
    this.firebaseApiKey = env.FIREBASE_API_KEY;
    this.firebaseAuthEmail = env.FIREBASE_AUTH_EMAIL;
    this.firebaseAuthPassword = env.FIREBASE_AUTH_PASSWORD;
    this.sensorPath = env.FIREBASE_SENSOR_PATH;
    this.pollIntervalMs = env.FIREBASE_POLL_INTERVAL_MS;
    this.statusFields = toCsvList(
      env.SENSOR_STATUS_FIELDS || env.SENSOR_STATUS_FIELD
    );
    this.dangerStatuses = toLowerCsvSet(
      env.SENSOR_DANGER_STATUS_VALUES || env.SENSOR_BAD_STATUS_VALUES
    );
    this.alertOnMissingData = env.ALERT_ON_MISSING_DATA;
    this.sendResolvedNotification = env.SEND_RESOLVED_NOTIFICATION;
    this.defaultTelegramChatId = env.DEFAULT_TELEGRAM_CHAT_ID;

    this.cachedFirebaseIdToken = env.FIREBASE_AUTH_TOKEN || "";
    this.firebaseTokenExpiresAtMs = this.cachedFirebaseIdToken
      ? Number.MAX_SAFE_INTEGER
      : 0;
    this.firebaseTokenRefreshPromise = null;

    this.isTickRunning = false;
    this.intervalHandle = null;
    this.lastIssueActive = false;
    this.lastIssueSignature = "";
  }

  hasFirebaseEmailPasswordCredentials() {
    return Boolean(
      this.firebaseApiKey && this.firebaseAuthEmail && this.firebaseAuthPassword
    );
  }

  async fetchFirebaseIdTokenFromIdentityToolkit() {
    const signInUrl =
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(this.firebaseApiKey)}`;

    const response = await fetch(signInUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: this.firebaseAuthEmail,
        password: this.firebaseAuthPassword,
        returnSecureToken: true,
      }),
    });

    const payload = await safeJson(response);

    if (!response.ok || !payload?.idToken) {
      const detail =
        payload?.error?.message ||
        payload?.error ||
        `status ${response.status}`;
      throw new Error(`Firebase sign-in failed: ${detail}`);
    }

    const expiresInMs = Math.max(Number(payload.expiresIn || 0) * 1000, 60000);
    this.cachedFirebaseIdToken = payload.idToken;
    this.firebaseTokenExpiresAtMs = Date.now() + expiresInMs - 30000;

    return this.cachedFirebaseIdToken;
  }

  async getFirebaseAuthToken(forceRefresh = false) {
    if (!this.hasFirebaseEmailPasswordCredentials()) {
      return this.firebaseAuthToken;
    }

    const tokenStillValid =
      !forceRefresh &&
      this.cachedFirebaseIdToken &&
      Date.now() < this.firebaseTokenExpiresAtMs;

    if (tokenStillValid) {
      return this.cachedFirebaseIdToken;
    }

    if (!this.firebaseTokenRefreshPromise) {
      this.firebaseTokenRefreshPromise = this.fetchFirebaseIdTokenFromIdentityToolkit()
        .finally(() => {
          this.firebaseTokenRefreshPromise = null;
        });
    }

    return this.firebaseTokenRefreshPromise;
  }

  async performFirebaseRead(authToken) {
    const url = buildFirebaseJsonUrl(this.databaseUrl, this.sensorPath, authToken);
    if (!url) {
      throw new Error("Firebase URL is not configured");
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await safeJson(response);

    return {
      response,
      payload,
    };
  }

  evaluateIssue(sensorData) {
    const reasons = [];

    if ((sensorData === null || sensorData === undefined) && this.alertOnMissingData) {
      reasons.push("sensor-data-missing");
      return {
        hasIssue: true,
        reasons,
      };
    }

    if (!isRecord(sensorData)) {
      return {
        hasIssue: false,
        reasons,
      };
    }

    this.statusFields.forEach((statusField) => {
      const rawStatusValue = getByPath(sensorData, statusField);
      const normalizedStatusValue = safeString(rawStatusValue).toLowerCase();

      if (
        normalizedStatusValue &&
        this.dangerStatuses.has(normalizedStatusValue)
      ) {
        reasons.push(`${statusField}=${safeString(rawStatusValue)}`);
      }
    });

    return {
      hasIssue: reasons.length > 0,
      reasons,
    };
  }

  buildDangerAlertMessage(sensorData) {
    const humidity = formatSensorValue(getByPath(sensorData, "humidity"));
    const temperature = formatSensorValue(getByPath(sensorData, "temperature"));
    const mq135Status = formatSensorValue(getByPath(sensorData, "mq135_status"));
    const mq7Status = formatSensorValue(getByPath(sensorData, "mq7_status"));

    return [
      "Kondisi udara ruangan sedang jelek, silahkan cek ruangan anda",
      `Humandity: ${humidity} %`,
      `Temperature: ${temperature} °c`,
      `MQ135_Status: ${mq135Status}`,
      `MQ7_status: ${mq7Status}`,
    ].join("\n");
  }

  async sendIssueNotification(sensorData) {
    const result = await this.sendTelegramNotification.execute({
      text: this.buildDangerAlertMessage(sensorData),
      telegramChatId: this.defaultTelegramChatId,
    });

    return result;
  }

  async sendResolvedAlert(sensorData) {
    const result = await this.sendTelegramNotification.execute({
      title: "Air Quality Recovered",
      body: `Sensor data at ${this.sensorPath} returned to normal`,
      telegramChatId: this.defaultTelegramChatId,
      eventType: "sensor-recovered",
      userId: "firebase-worker",
      data: {
        source: "firebase-polling-worker",
        sensorPath: this.sensorPath,
        recoveredAt: new Date().toISOString(),
        snapshot: sensorData,
      },
    });

    return result;
  }

  async fetchSensorData() {
    const authToken = await this.getFirebaseAuthToken();
    let { response, payload } = await this.performFirebaseRead(authToken);

    if (
      !response.ok &&
      this.hasFirebaseEmailPasswordCredentials() &&
      isAuthPermissionError(response.status, payload)
    ) {
      const refreshedToken = await this.getFirebaseAuthToken(true);
      const retried = await this.performFirebaseRead(refreshedToken);
      response = retried.response;
      payload = retried.payload;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ||
          payload?.error ||
          `Firebase poll failed with status ${response.status}`
      );
    }

    return payload;
  }

  async tick() {
    if (this.isTickRunning) {
      return;
    }

    this.isTickRunning = true;

    try {
      const sensorData = await this.fetchSensorData();
      const issue = this.evaluateIssue(sensorData);

      if (issue.hasIssue) {
        const signature = issue.reasons.join("|");
        const shouldSend =
          !this.lastIssueSignature || signature !== this.lastIssueSignature;

        this.lastIssueActive = true;
        this.lastIssueSignature = signature;

        if (shouldSend) {
          const result = await this.sendIssueNotification(sensorData);

          console.log(
            `[worker] issue notification sent. telegramSuccess=${result.telegram.success}`
          );
        }

        return;
      }

      if (this.lastIssueActive && this.sendResolvedNotification) {
        const result = await this.sendResolvedAlert(sensorData);

        console.log(
          `[worker] recovered notification sent. telegramSuccess=${result.telegram.success}`
        );
      }

      this.lastIssueActive = false;
      this.lastIssueSignature = "";
    } catch (error) {
      console.error("[worker] firebase polling error:", error.message);

      if (String(error.message).toLowerCase().includes("permission denied")) {
        console.error(
          "[worker] firebase polling stopped because access was denied. Provide FIREBASE_AUTH_TOKEN or configure FIREBASE_API_KEY, FIREBASE_AUTH_EMAIL, and FIREBASE_AUTH_PASSWORD."
        );
        this.stop();
      }
    } finally {
      this.isTickRunning = false;
    }
  }

  start() {
    if (!this.enabled) {
      console.log("[worker] firebase polling worker disabled by env");
      return;
    }

    if (!this.databaseUrl) {
      console.warn("[worker] firebase polling worker skipped: missing FIREBASE_DATABASE_URL");
      return;
    }

    if (!this.firebaseAuthToken && !this.hasFirebaseEmailPasswordCredentials()) {
      console.warn(
        "[worker] Firebase auth is not configured. If Realtime Database rules require auth, provide FIREBASE_AUTH_TOKEN or FIREBASE_API_KEY + FIREBASE_AUTH_EMAIL + FIREBASE_AUTH_PASSWORD."
      );
    }

    if (this.intervalHandle) {
      return;
    }

    console.log(
      `[worker] firebase polling worker started (path=${this.sensorPath}, intervalMs=${this.pollIntervalMs})`
    );

    this.tick();
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.pollIntervalMs);
  }

  stop() {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = null;
  }
}

module.exports = {
  FirebasePollingWorker,
};
