import { prisma } from "../src/lib/prisma";
import { syncSupabaseUserProfile } from "../src/lib/auth";
import { bootstrapUserProductState } from "../src/lib/userBootstrap";
import { grantLifetimePremium } from "../src/lib/premium";
import { stringifyStringArray } from "../src/lib/json";
import { getSupabaseAdminClient } from "../src/lib/supabase-admin";

type Args = {
  email: string;
  password: string;
  name: string;
};

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function parseArgs(): Args {
  const email = getArg("--email");
  const password = getArg("--password");
  const name = getArg("--name");

  if (!email || !password || !name) {
    throw new Error("Usage: npx tsx scripts/create-premium-user.ts --email user@example.com --password password123 --name \"GeoPulse User\"");
  }

  return {
    email: email.trim().toLowerCase(),
    password,
    name: name.trim(),
  };
}

async function findSupabaseUserByEmail(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) {
      return match;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function ensureSupabaseUser(args: Args) {
  const supabaseAdmin = getSupabaseAdminClient();
  const existing = await findSupabaseUserByEmail(args.email);

  if (existing) {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      email: args.email,
      password: args.password,
      email_confirm: true,
      user_metadata: {
        name: args.name,
        plan: "premium",
        lifetimePremium: true,
      },
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      name: args.name,
      plan: "premium",
      lifetimePremium: true,
    },
  });

  if (error || !data.user) {
    throw error || new Error("Could not create Supabase auth user.");
  }

  return data.user;
}

async function seedDefaultWatchlist(userId: string) {
  const existing = await prisma.watchlist.count({ where: { userId } });
  if (existing > 0) return;

  const watchlist = await prisma.watchlist.create({
    data: {
      userId,
      name: "Core Macro Watchlist",
    },
  });

  await prisma.watchlistItem.createMany({
    data: [
      { watchlistId: watchlist.id, symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "ETF" },
      { watchlistId: watchlist.id, symbol: "QQQ", name: "Invesco QQQ Trust", assetClass: "ETF" },
      { watchlistId: watchlist.id, symbol: "GLD", name: "SPDR Gold Shares", assetClass: "Commodity ETF" },
      { watchlistId: watchlist.id, symbol: "USO", name: "United States Oil Fund", assetClass: "Commodity ETF" },
      { watchlistId: watchlist.id, symbol: "ITA", name: "iShares U.S. Aerospace & Defense ETF", assetClass: "ETF" },
    ],
    skipDuplicates: true,
  });
}

async function seedDefaultPreferences(userId: string) {
  await prisma.userPreference.update({
    where: { userId },
    data: {
      onboarded: true,
      timezone: "America/New_York",
      digestHour: 7,
      categories: stringifyStringArray(["conflict", "energy", "economic", "sanctions", "trade", "threat"]),
      regions: stringifyStringArray(["North America", "Europe", "Middle East", "Asia-Pacific"]),
      symbols: stringifyStringArray(["SPY", "QQQ", "GLD", "USO", "XLE", "ITA", "TLT", "NVDA"]),
      deliveryChannels: stringifyStringArray(["email"]),
      savedViewsEnabled: true,
      emailDigestEnabled: true,
      plan: "premium",
    },
  });
}

async function main() {
  const args = parseArgs();
  const authUser = await ensureSupabaseUser(args);
  const user = await syncSupabaseUserProfile({
    email: args.email,
    name: args.name,
    supabaseAuthId: authUser.id,
  });

  await bootstrapUserProductState(user.id, {
    timezone: "America/New_York",
    digestHour: 7,
    deliveryChannels: ["email"],
  });
  await seedDefaultPreferences(user.id);
  await seedDefaultWatchlist(user.id);
  await grantLifetimePremium(user.id);

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: {
      plan: true,
      status: true,
      billingInterval: true,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    email: args.email,
    name: args.name,
    userId: user.id,
    supabaseAuthId: authUser.id,
    subscription,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
