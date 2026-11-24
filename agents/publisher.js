/**
 * Agent 4: 执行者 (Publisher)
 * 负责把生成好的回复真正发布到 Instagram 评论区，并记录发布结果。
 */

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 对指定评论发布回复。
 * 成功返回 { success: true, replyId }
 * 失败返回 { success: false, error }
 */
async function publishReply(commentId, replyText, accessToken, maxRetries = 2) {
  const url = `${GRAPH_API_BASE}/${commentId}/replies`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: accessToken, message: replyText }),
    });

    if (resp.ok) {
      const data = await resp.json();
      return { success: true, replyId: data.id };
    }

    // 429 为限流，做一次退避重试
    if (resp.status === 429 && attempt < maxRetries) {
      await sleep(3000 * (attempt + 1));
      continue;
    }

    return { success: false, error: await resp.text() };
  }

  return { success: false, error: "max retries exceeded" };
}

module.exports = { publishReply };
