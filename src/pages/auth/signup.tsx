import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import PublicLayout from "../../components/layout/PublicLayout";
import InputField from "../../components/ui/InputField";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "signing-in" | "done">("idle");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("saving");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="surface-card p-8">
          <p className="text-[10px] uppercase tracking-widest text-slate">Get started</p>
          <h1 className="mt-3 text-2xl font-bold text-ink">Create your account</h1>
          <p className="mt-2 text-sm text-slate">Build your personalized intelligence feed.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <InputField
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
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
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <button type="submit" className="btn-primary w-full" disabled={status === "saving" || status === "signing-in"}>
              {status === "saving" ? "Creating..." : status === "signing-in" ? "Signing you in..." : "Create account"}
            </button>
          </form>

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
