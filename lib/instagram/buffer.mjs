import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const endpoint = 'https://api.buffer.com';
const createPost = `mutation CreateInstagram($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status assets { id } } }
    ... on MutationError { message }
  }
}`;

export function instagramSnapshot({ channelId, caption, scheduledAt, images }) {
  if (typeof channelId !== 'string' || !channelId.trim() ||
      typeof caption !== 'string' ||
      typeof scheduledAt !== 'string' ||
      !/(Z|[+-]\d\d:\d\d)$/.test(scheduledAt) ||
      !Number.isFinite(Date.parse(scheduledAt)) ||
      !Array.isArray(images) || images.length !== 6) {
    throw new TypeError('Invalid Instagram post');
  }
  const order = Array.from(images, ({ key, digest }) => {
    if (typeof key !== 'string' || !key || !/^[0-9a-f]{64}$/.test(digest)) {
      throw new TypeError('Expected immutable image key and SHA-256 digest');
    }
    return { key, digest };
  });
  return {
    platform: 'instagram', channelId, caption,
    scheduledAt: new Date(scheduledAt).toISOString(), images: order,
  };
}

export function imageDigest(bytes) {
  return sha256(bytes);
}

export function instagramHash(post) {
  return sha256(JSON.stringify(instagramSnapshot(post)));
}

// claim must atomically check the stored approval and persist the attempt before
// returning true. A crashed attempt remains blocked until reconciled.
export function bufferInstagram({
  apiKey, request = fetch, signImage, claim, finish,
  publishingEnabled = false, draftsEnabled = false, clock = Date.now, minimumUrlLifetimeMs = 15 * 60_000,
}) {
  async function send(query, variables) {
    if (!apiKey) throw new Error('Buffer API key is missing');
    const reply = await request(endpoint, {
      method: 'POST', redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!reply.ok) throw new Error(`Buffer HTTP ${reply.status}`);
    const payload = await reply.json();
    if (payload.errors?.length || !payload.data) throw new Error('Buffer GraphQL error');
    return payload.data;
  }

  async function prepare(post, saveToDraft) {
    const signed = await Promise.all(post.images.map(signImage));
    const minimumExpiry = clock() + minimumUrlLifetimeMs;
    return {
      channelId: post.channelId, text: post.caption,
      schedulingType: 'automatic', mode: saveToDraft ? 'addToQueue' : 'shareNow',
      saveToDraft, metadata: { instagram: { type: 'post' } },
      assets: signed.map(({ url, expiresAt }) => {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
            !Number.isFinite(expiresAt) || expiresAt < minimumExpiry) {
          throw new Error('Image URL is insecure or expires too soon');
        }
        return { image: { url } };
      }),
    };
  }

  return {
    async checkAuthentication() {
      const data = await send('query CheckBufferAccess { account { id } }', {});
      if (!data.account?.id) throw new Error('Buffer account not found');
      return { accountId: data.account.id };
    },

    async createDraft(post) {
      if (draftsEnabled !== true) throw new Error("Buffer draft creation is disabled");
      const input = await prepare(instagramSnapshot(post), true);
      const { createPost: result } = await send(createPost, { input });
      if (!result?.post?.id || result.post.status !== 'draft' || result.post.assets?.length !== 6) {
        throw new Error('Buffer did not confirm a six-image draft');
      }
      return { bufferPostId: result.post.id, imageCount: result.post.assets.length };
    },

    async publish({ postId, approvedHash, post }) {
      if (publishingEnabled !== true) return { state: 'disabled' };
      const snapshot = instagramSnapshot(post);
      const hash = instagramHash(snapshot);
      if (!approvedHash || hash !== approvedHash || Date.parse(snapshot.scheduledAt) > clock()) {
        return { state: 'blocked' };
      }

      const input = await prepare(snapshot, false);
      if (!await claim({ postId, hash })) return { state: 'blocked' };

      // A write may have reached Buffer even if no usable response comes back.
      let outcome = { state: 'unknown', error: 'Buffer did not confirm acceptance' };
      try {
        const { createPost: result } = await send(createPost, { input });
        if (result?.__typename === 'PostActionSuccess' &&
            typeof result.post?.id === 'string' && result.post.id.trim() &&
            result.post.status !== 'draft' && result.post.assets?.length === 6) {
          outcome = { state: 'accepted', bufferPostId: result.post.id };
        }
      } catch {
        // Do not include exception text, which can contain signed media URLs.
      }
      await finish({ postId, hash, ...outcome });
      return outcome;
    },

    async checkStatus(bufferPostId) {
      const { post } = await send(
        'query InstagramStatus($id: PostId!) { post(input: { id: $id }) { id status externalLink sentAt error { message } } }',
        { id: bufferPostId },
      );
      if (post?.id !== bufferPostId || !post?.status) throw new Error('Buffer status unavailable');
      if (post.status === 'sent') {
        return { state: 'published', bufferPostId, permalink: post.externalLink, sentAt: post.sentAt };
      }
      if (post.status === 'error') {
        return { state: 'failed', bufferPostId, error: 'Buffer reports a publishing error' };
      }
      return { state: 'accepted', bufferPostId, bufferStatus: post.status };
    },
  };
}
