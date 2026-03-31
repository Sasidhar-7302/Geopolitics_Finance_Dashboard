export async function verifyTurnstileToken(params: {
  token?: string;
  remoteIp?: string;
}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const verificationRequired = process.env.NODE_ENV === "production";

  if (verificationRequired && !secret) {
    return {
      ok: false as const,
      skipped: false as const,
      message: "Signup verification is not configured in production.",
    };
  }

  if (!secret) {
    return { ok: true as const, skipped: true as const };
  }

  if (!params.token) {
    return {
      ok: false as const,
      skipped: false as const,
      message: "Please complete the security check.",
    };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", params.token);
  if (params.remoteIp) {
    form.set("remoteip", params.remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        skipped: false as const,
        message: "Security verification could not be completed.",
      };
    }

    const payload = await response.json() as { success?: boolean };
    return payload.success
      ? { ok: true as const, skipped: false as const }
      : {
          ok: false as const,
          skipped: false as const,
          message: "Security verification failed. Please try again.",
        };
  } catch {
    return {
      ok: false as const,
      skipped: false as const,
      message: "Security verification could not be completed.",
    };
  }
}
