# Security

## Secrets

- Never commit live secrets to Git.
- Real values belong in Vercel, Supabase, Stripe, or local untracked `.env` files.
- Tracked examples must stay as placeholders only.
- Run `npm run security:secrets` before pushing billing, auth, or deployment changes.

If a secret is ever exposed in Git, chat, screenshots, logs, or CI output:

1. Rotate it immediately at the provider.
2. Replace the deployed environment variable with the new value.
3. Remove it from tracked files and open pull requests.
4. If it was committed, treat the old value as permanently compromised even after deletion.

## GitHub

- Enable GitHub secret scanning and push protection in the repository settings.
- Restrict who can edit production environment variables.
- Keep branch protection enabled for `main`.

## GeoPulse-Specific Rules

- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, `DATABASE_URL`, and `DIRECT_URL` are always secret.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public by design and safe to expose to the browser.
- The current billing flow does not require a Stripe publishable key in the app bundle.

## Incident Note

If a live Stripe secret key has already been shared outside your secret manager, rotate it before using it again.
