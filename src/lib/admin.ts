export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length === 0) {
    return process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";
  }

  return configured.includes(email.toLowerCase());
}
