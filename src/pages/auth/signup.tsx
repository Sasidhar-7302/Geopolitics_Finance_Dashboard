import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import PublicLayout from "../../components/layout/PublicLayout";
import InputField from "../../components/ui/InputField";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

declare global {
  interface Window {
    onGeoPulseTurnstileToken?: (token: string) => void;
    onGeoPulseTurnstileExpired?: () => void;
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const TURNSTILE_REQUIRED = process.env.NODE_ENV === "production";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "signing-in" | "done">("idle");

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || typeof window === "undefined") {
      return undefined;
    }

    window.onGeoPulseTurnstileToken = (token: string) => {
      setTurnstileToken(token);
    };
    window.onGeoPulseTurnstileExpired = () => {
      setTurnstileToken("");
    };

    return () => {
      delete window.onGeoPulseTurnstileToken;
      delete window.onGeoPulseTurnstileExpired;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (TURNSTILE_REQUIRED && !TURNSTILE_SITE_KEY) {
      setError("Signup verification is not configured right now. Please contact support before opening public signup.");
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setStatus("saving");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        website,
        formStartedAt,
        turnstileToken: turnstileToken || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        digestHour: 7,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Unable to create account.");
      setStatus("idle");
      return;
    }

    setStatus("signing-in");
    const signInResult = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInResult.error) {
      setError("Account created, but automatic sign-in failed. Please sign in manually.");
      setStatus("done");
      return;
    }

    setStatus("done");
    await router.replace("/onboarding");
  };

  return (
    <PublicLayout>
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
        />
      )}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="surface-card p-8">
          <p className="text-[10px] uppercase tracking-widest text-slate">Get started</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-slate">
            Start with a free account. The first 10 users get lifetime premium, and every new signup gets a 7-day premium trial.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <InputField
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
            <div className="hidden" aria-hidden="true">
              <InputField
                type="text"
                placeholder="Company website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
            </div>
            <InputField
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
            <InputField
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
            {TURNSTILE_SITE_KEY && (
              <div
                className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#111] p-3"
              >
                <div
                  className="cf-turnstile"
                  data-sitekey={TURNSTILE_SITE_KEY}
                  data-callback="onGeoPulseTurnstileToken"
                  data-expired-callback="onGeoPulseTurnstileExpired"
                  data-theme="dark"
                />
              </div>
            )}
            {TURNSTILE_REQUIRED && !TURNSTILE_SITE_KEY && (
              <p className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Public signup is disabled until Cloudflare Turnstile is configured for production.
              </p>
            )}
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={status === "saving" || status === "signing-in" || (TURNSTILE_REQUIRED && !TURNSTILE_SITE_KEY)}
            >
              {status === "saving" ? "Creating..." : status === "signing-in" ? "Signing you in..." : "Create account"}
            </button>
          </form>

          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            GeoPulse uses lightweight abuse checks on signup, requires Turnstile verification for production signups, and starts every new account with premium access for the first week.
          </p>

          <p className="mt-6 text-center text-xs text-slate">
            Already have an account?{" "}
            <Link href="/auth/signin" className="font-semibold !text-emerald">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
