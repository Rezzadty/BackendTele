function pickExpoTicket(payload) {
  if (!payload || !payload.data) {
    return null;
  }

  if (Array.isArray(payload.data)) {
    return payload.data[0] || null;
  }

  return payload.data;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

class ExpoPushService {
  constructor({ expoPushUrl }) {
    this.expoPushUrl = expoPushUrl;
  }

  async sendNotification({ expoPushToken, title, body, data }) {
    if (!expoPushToken) {
      return {
        success: false,
        skipped: true,
        reason: "Missing expoPushToken",
      };
    }

    if (typeof fetch !== "function") {
      throw new Error(
        "Global fetch is not available. Use Node.js 18+ or install a fetch polyfill."
      );
    }

    const response = await fetch(this.expoPushUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data: data || {},
        sound: "default",
      }),
    });

    const payload = await safeJson(response);
    const ticket = pickExpoTicket(payload);
    const success = response.ok && ticket?.status === "ok";

    return {
      success,
      skipped: false,
      statusCode: response.status,
      ticket,
      error:
        success
          ? null
          : ticket?.message ||
            payload?.errors?.[0]?.message ||
            `Expo push failed with status ${response.status}`,
      raw: payload,
    };
  }
}

module.exports = {
  ExpoPushService,
};
