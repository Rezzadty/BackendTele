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

function safeString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
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

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

class FirebasePollingWorker {
  constructor({ env, sendNotificationWithBackup }) {
    this.env = env;
    this.sendNotificationWithBackup = sendNotificationWithBackup;

    this.enabled = env.ENABLE_FIREBASE_POLLING_WORKER;
    this.databaseUrl = env.FIREBASE_DATABASE_URL;
    this.firebaseAuthToken = env.FIREBASE_AUTH_TOKEN;
    this.sensorPath = env.FIREBASE_SENSOR_PATH;
    this.pollIntervalMs = env.FIREBASE_POLL_INTERVAL_MS;
    this.statusField = env.SENSOR_STATUS_FIELD;
    this.badStatuses = toLowerCsvSet(env.SENSOR_BAD_STATUS_VALUES);
    this.numericField = env.SENSOR_VALUE_FIELD;
    this.numericThreshold = env.SENSOR_VALUE_THRESHOLD;
    this.timestampField = env.SENSOR_EVENT_TIMESTAMP_FIELD;
    this.alertOnMissingData = env.ALERT_ON_MISSING_DATA;
    this.cooldownMs = env.NOTIFICATION_COOLDOWN_MS;
    this.sendResolvedNotification = env.SEND_RESOLVED_NOTIFICATION;
    this.defaultExpoPushToken = env.DEFAULT_EXPO_PUSH_TOKEN;
    this.defaultTelegramChatId = env.DEFAULT_TELEGRAM_CHAT_ID;

    this.isTickRunning = false;
    this.intervalHandle = null;
    this.lastIssueActive = false;
    this.lastIssueSignature = "";
    this.lastNotificationAtMs = 0;
  }

  shouldApplyNumericRule() {
    return Boolean(this.numericField) && Number.isFinite(this.numericThreshold);
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

    const rawStatusValue = getByPath(sensorData, this.statusField);
    const normalizedStatusValue = safeString(rawStatusValue).toLowerCase();

    if (normalizedStatusValue && this.badStatuses.has(normalizedStatusValue)) {
      reasons.push(`${this.statusField}=${safeString(rawStatusValue)}`);
    }

    if (this.shouldApplyNumericRule()) {
      const numericRawValue = getByPath(sensorData, this.numericField);
      const numericValue = Number(numericRawValue);

      if (Number.isFinite(numericValue) && numericValue > this.numericThreshold) {
        reasons.push(
          `${this.numericField}=${numericValue} > ${this.numericThreshold}`
        );
      }
    }

    return {
      hasIssue: reasons.length > 0,
      reasons,
    };
  }

  buildIssueSignature(issue, sensorData) {
    const timestampValue = safeString(getByPath(sensorData, this.timestampField));
    return `${issue.reasons.join("|")}::${timestampValue}`;
  }

  shouldSendIssueNotification(signature, nowMs) {
    if (!this.lastIssueSignature || signature !== this.lastIssueSignature) {
      return true;
    }

    return nowMs - this.lastNotificationAtMs >= this.cooldownMs;
  }

  async sendIssueNotification(issue, sensorData) {
    const result = await this.sendNotificationWithBackup.execute({
      title: "Air Quality Alert",
      body: `Detected issue at ${this.sensorPath}: ${issue.reasons.join(", ")}`,
      expoPushToken: this.defaultExpoPushToken,
      telegramChatId: this.defaultTelegramChatId,
      eventType: "sensor-alert",
      userId: "firebase-worker",
      data: {
        source: "firebase-polling-worker",
        sensorPath: this.sensorPath,
        issueReasons: issue.reasons,
        detectedAt: new Date().toISOString(),
        snapshot: sensorData,
      },
    });

    return result;
  }

  async sendResolvedAlert(sensorData) {
    const result = await this.sendNotificationWithBackup.execute({
      title: "Air Quality Recovered",
      body: `Sensor data at ${this.sensorPath} returned to normal`,
      expoPushToken: this.defaultExpoPushToken,
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
    const url = buildFirebaseJsonUrl(
      this.databaseUrl,
      this.sensorPath,
      this.firebaseAuthToken
    );
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
    if (!response.ok) {
      throw new Error(
        payload?.error || `Firebase poll failed with status ${response.status}`
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
      const nowMs = Date.now();

      if (issue.hasIssue) {
        const signature = this.buildIssueSignature(issue, sensorData);
        const shouldSend = this.shouldSendIssueNotification(signature, nowMs);

        this.lastIssueActive = true;
        this.lastIssueSignature = signature;

        if (shouldSend) {
          const result = await this.sendIssueNotification(issue, sensorData);
          this.lastNotificationAtMs = nowMs;

          console.log(
            `[worker] issue notification sent. expoSuccess=${result.expo.success}, telegramSuccess=${result.telegram.success}`
          );
        }

        return;
      }

      if (this.lastIssueActive && this.sendResolvedNotification) {
        const result = await this.sendResolvedAlert(sensorData);

        console.log(
          `[worker] recovered notification sent. expoSuccess=${result.expo.success}, telegramSuccess=${result.telegram.success}`
        );
      }

      this.lastIssueActive = false;
      this.lastIssueSignature = "";
    } catch (error) {
      console.error("[worker] firebase polling error:", error.message);

      if (String(error.message).toLowerCase().includes("permission denied")) {
        console.error(
          "[worker] firebase polling stopped because access was denied. Set FIREBASE_AUTH_TOKEN or update Firebase read rules."
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
