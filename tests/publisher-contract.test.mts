import assert from "node:assert/strict";
import { test } from "node:test";
import { instagramLiveBackend, threadsLiveBackend, xLiveBackend } from "../lib/publishers/platforms";
import { PublishError, type PublishContent } from "../lib/publishers/types";

const content = { text: "fixture", imageUrl: "https://example.test/quiz.jpg" } as PublishContent;

test("each provider requires a confirmed publication ID and holds ambiguous responses", async (t) => {
  const saved = { ...process.env };
  t.after(() => { process.env = saved; });
  Object.assign(process.env, {
    IG_USER_ID: "1", THREADS_USER_ID: "1", IG_ACCESS_TOKEN: "fake",
    THREADS_ACCESS_TOKEN: "fake", X_USER_ACCESS_TOKEN: "fake",
  });
  const replies: Response[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.redirect, "error");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer fake");
    const reply = replies.shift();
    assert.ok(reply, "unexpected outbound operation");
    return reply;
  });
  for (const [backend, multiStep] of [
    [threadsLiveBackend(), true], [instagramLiveBackend(), true], [xLiveBackend(), false],
  ] as const) {
    if (multiStep) replies.push(Response.json({ id: "10" }));
    replies.push(Response.json({}));
    await assert.rejects(backend.post(content), (e) => e instanceof PublishError && e.kind === "unknown");
    assert.equal(replies.length, 0);
    if (multiStep) replies.push(Response.json({ id: "10" }));
    replies.push(multiStep ? Response.json({ id: "20" }) : Response.json({ data: { id: "20" } }));
    if (multiStep) replies.push(Response.json({ permalink: "https://example.test/post" }));
    assert.equal((await backend.post(content)).externalId, "20");
    assert.equal(replies.length, 0);
  }
  replies.push(new Response("<not-json>"));
  await assert.rejects(xLiveBackend().post(content), (e) => e instanceof PublishError && e.kind === "unknown");
  replies.push(new Response("fixture", { status: 408 }));
  await assert.rejects(xLiveBackend().post(content), (e) => e instanceof PublishError && e.kind === "unknown");
});
