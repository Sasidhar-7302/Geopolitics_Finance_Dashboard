import type { User as SupabaseUser } from "@supabase/supabase-js";
import type {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from "next";
import { syncSupabaseUserProfile } from "./auth";
import { createSupabaseApiClient, createSupabasePageClient } from "./supabase-server";

async function getUserFromSupabase(
  supabaseUser: SupabaseUser
) {
  return syncSupabaseUserProfile({
    email: supabaseUser.email || "",
    name:
      (typeof supabaseUser.user_metadata?.name === "string"
        ? supabaseUser.user_metadata.name
        : null) ||
      (typeof supabaseUser.user_metadata?.full_name === "string"
        ? supabaseUser.user_metadata.full_name
        : null),
    supabaseAuthId: supabaseUser.id,
  });
}

export async function getAuthenticatedApiUser(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const supabase = createSupabaseApiClient(req, res);
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return null;
  }

  const user = await getUserFromSupabase(authUser);
  return { authUser, user };
}

export async function requireApiUser(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const currentUser = await getAuthenticatedApiUser(req, res);

  if (!currentUser) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  return currentUser;
}

export async function getOptionalPageUser(context: GetServerSidePropsContext) {
  const supabase = createSupabasePageClient(context);
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser?.email) {
    return null;
  }

  const user = await getUserFromSupabase(authUser);
  return { authUser, user };
}

export async function requireAuth(context: GetServerSidePropsContext) {
  const currentUser = await getOptionalPageUser(context);

  if (!currentUser) {
    return {
      redirect: {
        destination: "/auth/signin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      currentUser: {
        email: currentUser.user.email,
        name: currentUser.user.name,
      },
    },
  };
}
