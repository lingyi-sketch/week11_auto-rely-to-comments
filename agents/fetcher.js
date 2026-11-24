/**
 * Agent 1: 监听者 (Fetcher)
 * 负责从 Instagram Graph API 拉取账号下所有帖子的最新评论。
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

/** 获取该 Instagram 专业账号最近发布的帖子(media) id 列表 */
async function getMediaIds(igBusinessId, accessToken, limit = 5) {
  const url = `${GRAPH_API_BASE}/${igBusinessId}/media?access_token=${accessToken}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`获取帖子列表失败: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return (data.data || []).map((item) => item.id);
}

/** 获取某条帖子下的所有评论 */
async function getComments(mediaId, accessToken) {
  const fields = "id,text,username,timestamp";
  const url = `${GRAPH_API_BASE}/${mediaId}/comments?access_token=${accessToken}&fields=${fields}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`获取评论失败: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.data || [];
}

/** 遍历最近的帖子，拉取所有评论，并标记来自哪条帖子 */
async function fetchAllNewComments(igBusinessId, accessToken) {
  const mediaIds = await getMediaIds(igBusinessId, accessToken);
  const allComments = [];

  for (const mediaId of mediaIds) {
    const comments = await getComments(mediaId, accessToken);
    for (const c of comments) {
      c.mediaId = mediaId;
    }
    allComments.push(...comments);
  }

  return allComments;
}

module.exports = { getMediaIds, getComments, fetchAllNewComments };
