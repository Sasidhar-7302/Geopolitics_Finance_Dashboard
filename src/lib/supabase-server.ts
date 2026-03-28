import { createServerClient } from "@supabase/ssr";
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";
import { serialize, type SerializeOptions } from "cookie";
import { getSupabasePublishableKey, getSupabaseUrl } from "./supabase";

type CookieRequest = {
  cookies: Partial<Record<string, string>>;
};

type CookieResponse = {
  getHeader(name: string): number | string | string[] | undefined;
  setHeader(name: string, value: string | string[]): void;
};

type CookiePair = {
  name: string;
  value: string;
  options?: SerializeOptions;
};

function appendCookies(
  res: CookieResponse,
  cookiesToSet: CookiePair[]
) {
  const existingHeader = res.getHeader("Set-Cookie");
  const existingCookies = Array.isArray(existingHeader)
    ? existingHeader.map(String)
    : typeof existingHeader === "string"
    ? [existingHeader]
    : [];

  const serialized = cookiesToSet.map(({ name, value, options }) =>
    serialize(name, value, options)
  );

  res.setHeader("Set-Cookie", [...existingCookies, ...serialized]);
}

export function createSupabaseServerClient(input: {
  req: CookieRequest;
  res: CookieResponse;
}) {
  const { req, res } = input;

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return Object.entries(req.cookies || {}).map(([name, value]) => ({
          name,
          value: value || "",
        }));
      },
      setAll(cookiesToSet) {
        appendCookies(res, cookiesToSet);
        for (const { name, value } of cookiesToSet) {
          req.cookies[name] = value;
        }
      },
    },
  });
}

export function createSupabaseApiClient(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return createSupabaseServerClient({ req, res });
}

export function createSupabasePageClient(context: GetServerSidePropsContext) {
  return createSupabaseServerClient({
    req: context.req,
    res: context.res,
  });
}
