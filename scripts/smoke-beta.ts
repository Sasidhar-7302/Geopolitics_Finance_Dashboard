import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...init,
  });

  return response;
}

async function expectHtml(path: string, contains: string) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} should return 200`);
  const html = await response.text();
  assert.match(html, new RegExp(contains, "i"), `${path} should contain ${contains}`);
}

async function expectJson(path: string) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} should return 200`);
  const payload = await response.json();
  return { response, payload };
}

async function main() {
  console.log(`Running GeoPulse beta smoke against ${BASE_URL}`);

  await expectHtml("/", "GeoPulse");
  await expectHtml("/auth/signup", "Create your account");

  const dashboardResponse = await request("/dashboard");
  assert.ok(
    dashboardResponse.status === 302 || dashboardResponse.status === 307,
    "/dashboard should redirect anonymous users to sign-in"
  );

  const { response: statusResponse, payload: statusPayload } = await expectJson("/api/status");
  assert.ok(statusPayload?.stats?.totalEvents >= 0, "/api/status should include stats");
  assert.match(
    statusResponse.headers.get("cache-control") || "",
    /s-maxage/i,
    "/api/status should expose cache headers"
  );

  const { response: eventsResponse, payload: eventsPayload } = await expectJson("/api/events?limit=3");
  assert.ok(Array.isArray(eventsPayload?.events), "/api/events should return an events array");
  assert.ok(eventsPayload?.events?.length > 0, "/api/events should return at least one event");
  assert.ok(eventsPayload?.pagination?.total >= eventsPayload?.events?.length, "/api/events should return pagination");
  assert.ok(eventsResponse.headers.get("x-ratelimit-limit"), "/api/events should expose rate limit headers");

  const firstEventId = eventsPayload.events[0]?.id;
  assert.ok(firstEventId, "Expected a first event id from /api/events");

  const { payload: eventPayload } = await expectJson(`/api/events/${firstEventId}`);
  assert.ok(eventPayload?.event?.title, "/api/events/[id] should return an event");
  assert.ok(eventPayload?.trust?.supportingSourcesCount >= 1, "/api/events/[id] should include trust metadata");

  const { response: quotesResponse, payload: quotesPayload } = await expectJson("/api/markets/quotes?symbols=SPY,QQQ,GLD");
  assert.ok(Array.isArray(quotesPayload?.quotes), "/api/markets/quotes should return quotes");
  assert.ok(quotesResponse.headers.get("x-ratelimit-limit"), "/api/markets/quotes should expose rate limit headers");

  const unauthorizedCron = await request("/api/cron/ingest");
  assert.equal(unauthorizedCron.status, 401, "/api/cron/ingest should reject anonymous access");

  const honeypotSignup = await request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bot Test",
      email: "bot@example.com",
      password: "securepassword123",
      website: "https://spam.invalid",
      formStartedAt: Date.now() - 5000,
    }),
  });
  assert.equal(honeypotSignup.status, 400, "/api/auth/signup should reject honeypot submissions");

  console.log("Smoke checks passed:");
  console.log("- public preview pages render");
  console.log("- anonymous dashboard access redirects");
  console.log("- public APIs return data plus cache/rate-limit headers");
  console.log("- cron is protected");
  console.log("- signup abuse guard rejects honeypot traffic");
}

main().catch((error) => {
  console.error("Smoke check failed:", error);
  process.exitCode = 1;
});
