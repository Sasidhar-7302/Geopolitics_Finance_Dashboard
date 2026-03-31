import { prisma } from "../src/lib/prisma";
import { getSupabaseAdminClient } from "../src/lib/supabase-admin";

function getArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
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

async function main() {
  const email = getArg("--email")?.trim().toLowerCase();

  if (!email) {
    throw new Error("Usage: npx tsx scripts/debug-user-access.ts --email user@example.com");
  }

  const authUser = await findSupabaseUserByEmail(email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      preference: true,
      subscription: true,
      digest: true,
      entitlements: {
        orderBy: { key: "asc" },
      },
      watchlists: {
        include: {
          items: true,
        },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        email,
        authUser: authUser
          ? {
              id: authUser.id,
              email: authUser.email,
              user_metadata: authUser.user_metadata,
              app_metadata: authUser.app_metadata,
            }
          : null,
        localUser: user
          ? {
              id: user.id,
              email: user.email,
              supabaseAuthId: user.supabaseAuthId,
              preference: user.preference,
              subscription: user.subscription,
              digest: user.digest,
              entitlements: user.entitlements,
              watchlists: user.watchlists.map((watchlist) => ({
                id: watchlist.id,
                name: watchlist.name,
                itemCount: watchlist.items.length,
              })),
            }
          : null,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
