import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export async function createLocalUser(params: {
  name: string;
  email: string;
  supabaseAuthId?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email already registered");
  }

  const user = await prisma.user.create({
    data: {
      name: params.name.trim(),
      email,
      supabaseAuthId: params.supabaseAuthId || null,
    },
  });

  return user;
}

export async function syncSupabaseUserProfile(params: {
  email: string;
  name?: string | null;
  supabaseAuthId?: string | null;
}) {
  const email = params.email.trim().toLowerCase();
  const displayName =
    params.name?.trim() || email.split("@")[0] || "GeoPulse User";

  return prisma.user.upsert({
    where: { email },
    update: {
      name: displayName,
      supabaseAuthId: params.supabaseAuthId || undefined,
    },
    create: {
      email,
      name: displayName,
      supabaseAuthId: params.supabaseAuthId || null,
    },
  });
}

export async function verifyLegacyUser(params: {
  email: string;
  password: string;
}) {
  const user = await prisma.user.findUnique({
    where: { email: params.email.trim().toLowerCase() },
  });
  if (!user) return null;
  if (!user.passwordHash) return null;

  const valid = await bcrypt.compare(params.password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export async function storeLegacyPasswordHash(params: {
  email: string;
  password: string;
  name?: string;
  supabaseAuthId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.upsert({
    where: { email: params.email.trim().toLowerCase() },
    update: {
      name: params.name?.trim() || undefined,
      passwordHash,
      supabaseAuthId: params.supabaseAuthId || undefined,
    },
    create: {
      email: params.email.trim().toLowerCase(),
      name: params.name?.trim() || params.email.trim().toLowerCase().split("@")[0] || "GeoPulse User",
      passwordHash,
      supabaseAuthId: params.supabaseAuthId || null,
    },
  });
}
