import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

test("Instagram DB controls approval, scheduled claim and audit in one transaction", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean);
      create table admin_audit_log (actor_id text, actor_kind text, actor_email text,
        action text, entity text check (entity = 'instagram_carousel'), entity_id text, detail jsonb);
    `);
    const migration = readFileSync("supabase/migrations/005_instagram_carousel.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("grant insert on admin_audit_log to service_role");
    const add = async (hash: string, future = false) => (await db.query<{ id: string }>(
      "insert into instagram_carousels (snapshot, hash, scheduled_at) values ('{}', $1, $2) returning id",
      [hash, future ? "2099-01-01" : "2020-01-01"],
    )).rows[0].id;
    const a = await add("hash");
    const b = await add("future", true);
    const c = await add("other");
    const d = await add("original");
    const change = async (id: string, hash: string, from: string, to: string, email: string | null = null, buffer: string | null = null) =>
      (await db.query<{ ok: boolean }>(
        "select instagram_transition($1,$2,$3,$4,'test',$5,$6) ok", [id, hash, from, to, email, buffer],
      )).rows[0].ok;

    await db.exec("set role authenticated");
    await assert.rejects(change(a, "hash", "draft", "approved", "admin@example.com"), /permission denied/);
    await db.exec("set role service_role");
    assert.equal(await change(a, "hash", "approved", "sending"), false);
    assert.equal(await change(a, "stale", "draft", "approved", "admin@example.com"), false);
    assert.equal(await change(a, "hash", "draft", "approved", "admin@example.com"), true);
    assert.equal(await change(a, "hash", "approved", "draft", "admin@example.com"), true);
    assert.equal(await change(a, "hash", "approved", "sending"), false);
    assert.equal(await change(a, "hash", "draft", "approved", "admin@example.com"), true);
    assert.equal(await change(b, "future", "draft", "approved", "admin@example.com"), true);
    assert.equal(await change(b, "future", "approved", "sending"), false);
    assert.equal(await change(a, "hash", "approved", "sending"), true);
    assert.equal(await change(a, "hash", "approved", "sending"), false);
    assert.equal(await change(a, "hash", "sending", "accepted", null, "id"), true);
    assert.equal(await change(a, "hash", "accepted", "published"), true);
    assert.equal(await change(c, "other", "draft", "approved", "admin@example.com"), true);
    assert.equal(await change(c, "other", "approved", "sending"), true);
    assert.equal(await change(c, "other", "sending", "unknown"), true);
    assert.equal(await change(c, "other", "approved", "sending"), false);

    assert.equal(await change(d, "original", "draft", "approved", "admin@example.com"), true);
    const replace = await db.query<{ ok: boolean }>(
      "select instagram_replace($1,'original','{}','replacement','2020-01-01','test','admin@example.com') ok", [d],
    );
    assert.equal(replace.rows[0].ok, true);
    assert.equal(await change(d, "original", "draft", "approved", "admin@example.com"), false);
    assert.equal(await change(d, "replacement", "approved", "sending"), false);
    assert.equal(await change(d, "replacement", "draft", "approved", "admin@example.com"), true);

    await db.exec("reset role");
    const actions = (await db.query<{ action: string }>("select action from admin_audit_log")).rows.map((r) => r.action);
    assert.equal(actions.filter((a) => a === "instagram_sending").length, 2);
    assert.ok(actions.includes("instagram_accepted") && actions.includes("instagram_published"));
    await db.exec("revoke insert on admin_audit_log from service_role; set role service_role");
    await assert.rejects(change(b, "future", "approved", "draft", "admin@example.com"), /permission denied/);
    assert.equal((await db.query<{ state: string }>("select state from instagram_carousels where id=$1", [b])).rows[0].state, "approved");
  } finally {
    await db.close();
  }
});
