import { matchesContent } from "./match";
import { fetchJson, PublishError, requireEnv, type PlatformBackend } from "./types";

const createPost = `mutation PublishText($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status externalLink } }
  }
}`;

type BufferPost = { id: string; status: string; text?: string; externalLink?: string };
type BufferChannel = { id: string; name: string; service: string; isDisconnected: boolean; isLocked: boolean };

const officialAccounts = {
  x: { handle: "samurai_nihongo", services: ["twitter", "x"] },
  threads: { handle: "samurai.nihongo.lab", services: ["threads"] },
};

async function bufferRequest<T>(query: string, variables = {}): Promise<T> {
  const apiKey = requireEnv("BUFFER_API_KEY");
  const response = await fetchJson("https://api.buffer.com", {
    method: "POST",
    redirect: "error",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  }, "Buffer");
  const payload = response as { data?: T; errors?: unknown[] } | null;
  if (!payload?.data || payload.errors?.length) {
    throw new PublishError("Buffer API の処理結果を確認できませんでした", "unknown");
  }
  return payload.data;
}

async function resolveChannel(platform: keyof typeof officialAccounts) {
  const { account } = await bufferRequest<{ account: { organizations: { id: string }[] } }>(
    "query BufferOrganizations { account { organizations { id } } }",
  );
  const { handle, services } = officialAccounts[platform];
  const channelsByOrganization = await Promise.all(account.organizations.map(async ({ id }) => {
    const { channels } = await bufferRequest<{ channels: BufferChannel[] }>(`query BufferChannels {
      channels(input: { organizationId: ${JSON.stringify(id)} }) {
        id name service isDisconnected isLocked
      }
    }`);
    return channels.filter((channel) =>
      services.includes(channel.service.toLowerCase()) &&
      channel.name.replace(/^@/, "").toLowerCase() === handle,
    ).map((channel) => ({ organizationId: id, channel }));
  }));
  const matches = channelsByOrganization.flat();
  const target = matches[0];
  if (matches.length !== 1 || !target?.channel.id || target.channel.isDisconnected || target.channel.isLocked) {
    throw new PublishError(`Buffer で公式アカウント @${handle} の有効な接続を一意に確認できませんでした`, "definite");
  }
  return { organizationId: target.organizationId, channelId: target.channel.id };
}

export function bufferTextBackend(platform: keyof typeof officialAccounts): PlatformBackend {

  return {
    async post(content) {
      let channelId: string;
      try {
        ({ channelId } = await resolveChannel(platform));
      } catch (error) {
        if (error instanceof PublishError && error.kind !== "unknown") throw error;
        throw new PublishError("Buffer のチャンネルを確認できませんでした。投稿リクエストは未送信です", "definite");
      }
      const { createPost: result } = await bufferRequest<{
        createPost?: { __typename: string; post?: BufferPost };
      }>(createPost, {
        input: { channelId, text: content.text, schedulingType: "automatic", mode: "shareNow" },
      });
      if (result?.__typename === "MutationError") {
        throw new PublishError("Buffer が投稿の作成を拒否しました", "definite");
      }
      const post = result?.post;
      if (result?.__typename === "PostActionSuccess" && post?.id && post.status === "sent") {
        return { externalId: post.id, url: post.externalLink ?? null };
      }
      throw new PublishError("Buffer での公開を確認できませんでした。送信済み一覧を照合します", "unknown");
    },
    async find(content) {
      const { organizationId, channelId } = await resolveChannel(platform);
      const { posts } = await bufferRequest<{ posts?: { edges: { node: BufferPost }[] } }>(`query FindSentText {
        posts(first: 25, input: {
          organizationId: ${JSON.stringify(organizationId)}
          filter: { status: [sent], channelIds: [${JSON.stringify(channelId)}] }
          sort: [{ field: createdAt, direction: desc }]
        }) { edges { node { id status text externalLink } } }
      }`);
      if (!posts) throw new PublishError("Buffer の送信済み一覧を取得できませんでした", "unknown");
      const post = posts.edges.map(({ node }) => node)
        .find((node) => node.status === "sent" && matchesContent(content, node));
      return post ? { externalId: post.id, url: post.externalLink ?? null } : null;
    },
  };
}
