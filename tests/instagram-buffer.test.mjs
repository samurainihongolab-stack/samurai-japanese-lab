import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bufferInstagram, imageDigest, instagramHash } from '../lib/instagram/buffer.mjs';

const now = Date.parse('2026-11-22T12:00:00Z');
const post = {
  channelId: 'instagram-channel', caption: 'リョウ先生\n#日本語教育',
  scheduledAt: '2026-11-22T19:00:00+07:00',
  images: Array.from({ length: 6 }, (_, i) => ({
    key: `comic/${i}.jpg`, digest: imageDigest(Buffer.from(String(i))),
  })),
};
const job = { postId: 'local-post', post, approvedHash: instagramHash(post) };
const result = (status) => ({
  data: {
    createPost: {
      __typename: 'PostActionSuccess',
      post: { id: 'buffer-post', status, assets: post.images.map(({ key }) => ({ id: key })) },
    },
  },
});

function fixture({ respond = () => result('sending'), ...overrides } = {}) {
  const calls = [];
  let state = 'approved';
  const adapter = bufferInstagram({
    apiKey: 'test-key', publishingEnabled: true, clock: () => now,
    signImage: async ({ key }) => ({
      url: `https://media.example/${key}?signature=test`, expiresAt: now + 3_600_000,
    }),
    claim: async ({ postId, hash }) => {
      if (state !== 'approved' || postId !== job.postId || hash !== job.approvedHash) return false;
      state = 'sending';
      return true;
    },
    finish: async (outcome) => { state = outcome.state; },
    request: async (url, options) => {
      const call = { url, ...JSON.parse(options.body), authorization: options.headers.Authorization };
      calls.push(call);
      return Response.json(await respond(call));
    },
    ...overrides,
  });
  return { adapter, calls, getState: () => state };
}

test('authentication uses the Buffer endpoint and bearer header', async () => {
  const { adapter, calls } = fixture({ respond: () => ({ data: { account: { id: 'account' } } }) });
  assert.deepEqual(await adapter.checkAuthentication(), { accountId: 'account' });
  assert.equal(calls[0].url, 'https://api.buffer.com');
  assert.equal(calls[0].authorization, 'Bearer test-key');
});

test('draft contains six ordered images and cannot schedule publication', async () => {
  const { adapter, calls } = fixture({
    publishingEnabled: false,
    respond: () => result('draft'),
  });
  assert.equal((await adapter.createDraft(post)).imageCount, 6);
  const { input } = calls[0].variables;
  assert.equal(input.saveToDraft, true);
  assert.equal(input.mode, 'addToQueue');
  assert.deepEqual(input.assets.map(({ image }) => new URL(image.url).pathname),
    post.images.map(({ key }) => '/' + key));
  assert.equal(input.text, post.caption);
});

test('publication defaults to disabled', async () => {
  assert.deepEqual(await bufferInstagram({}).publish(job), { state: 'disabled' });
});

test('missing or stale approval, reordered images and future times are blocked', async () => {
  const { adapter, calls } = fixture();
  for (const changed of [
    { ...job, approvedHash: null },
    { ...job, post: { ...post, caption: 'changed' } },
    { ...job, post: { ...post, channelId: 'another-account' } },
    { ...job, post: { ...post, images: post.images.toReversed() } },
    { ...job, post: { ...post, images: [{ ...post.images[0], digest: '0'.repeat(64) }, ...post.images.slice(1)] } },
  ]) {
    assert.equal((await adapter.publish(changed)).state, 'blocked');
  }
  const future = { ...post, scheduledAt: '2026-11-23T12:00:00Z' };
  assert.equal((await adapter.publish({ ...job, post: future, approvedHash: instagramHash(future) })).state, 'blocked');
  assert.equal(calls.length, 0);
});

test('short-lived media is rejected before any provider request', async () => {
  const { adapter, calls, getState } = fixture({
    signImage: async () => ({ url: 'https://media.example/image.jpg', expiresAt: now + 60_000 }),
  });
  await assert.rejects(adapter.publish(job), /expires too soon/);
  assert.equal(calls.length, 0);
  assert.equal(getState(), 'approved');
});

test('approval can be revoked during media preparation', async () => {
  const { adapter, calls } = fixture({ claim: async () => false });
  assert.equal((await adapter.publish(job)).state, 'blocked');
  assert.equal(calls.length, 0);
});

test('concurrent runs submit once and acceptance remains distinct from publication', async () => {
  const { adapter, calls } = fixture({ respond: (call) => call.query.includes('InstagramStatus')
    ? { data: { post: { id: 'buffer-post', status: 'sent', externalLink: 'https://www.instagram.com/p/example/' } } }
    : result('sending') });
  const outcomes = await Promise.all([adapter.publish(job), adapter.publish(job)]);
  assert.deepEqual(outcomes.map(({ state }) => state).sort(), ['accepted', 'blocked']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].variables.input.mode, 'shareNow');
  assert.equal(calls[0].variables.input.schedulingType, 'automatic');
  assert.equal((await adapter.checkStatus('buffer-post')).state, 'published');
});

test('post status records a confirmed error without a write', async () => {
  const { adapter, calls } = fixture({ respond: () => ({
    data: { post: { id: 'buffer-post', status: 'error' } },
  }) });
  assert.equal((await adapter.checkStatus('buffer-post')).state, 'failed');
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /^query/);
});

test('lost response stays unknown after repeated executions', async () => {
  const { adapter, calls, getState } = fixture({ respond: () => { throw new Error('timeout'); } });
  assert.equal((await adapter.publish(job)).state, 'unknown');
  for (let i = 0; i < 6; i++) assert.equal((await adapter.publish(job)).state, 'blocked');
  assert.equal(calls.length, 1);
  assert.equal(getState(), 'unknown');
});

test('if result persistence fails, the durable claim must still block another write', async () => {
  const { adapter, calls, getState } = fixture({ finish: async () => { throw new Error('DB unavailable'); } });
  await assert.rejects(adapter.publish(job), /DB unavailable/);
  assert.equal(getState(), 'sending');
  assert.equal((await adapter.publish(job)).state, 'blocked');
  assert.equal(calls.length, 1);
});
