import test from "node:test";
import assert from "node:assert/strict";
import type { NextApiRequest } from "next";
import { isAuthorizedCronRequest } from "../src/lib/cronAuth";

function mockRequest(authorization?: string) {
  return {
    headers: authorization ? { authorization } : {},
  } as NextApiRequest;
}

test("cron auth accepts the configured bearer token", () => {
  process.env.CRON_SECRET = "super-secret";
  assert.equal(isAuthorizedCronRequest(mockRequest("Bearer super-secret")), true);
});

test("cron auth rejects missing or incorrect bearer tokens", () => {
  process.env.CRON_SECRET = "super-secret";
  assert.equal(isAuthorizedCronRequest(mockRequest()), false);
  assert.equal(isAuthorizedCronRequest(mockRequest("Bearer wrong-secret")), false);
  assert.equal(isAuthorizedCronRequest(mockRequest("Basic super-secret")), false);
});
