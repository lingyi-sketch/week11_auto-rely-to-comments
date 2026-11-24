/**
 * Agent 5: 审核者 (Reviewer)
 * 在回复真正发布之前，对 Agent3 生成的回复做一次自我检查(反思循环)，
 * 判断是否合适，不合适则给出具体修改意见，交回 Replier 重新生成。
 */

const REVIEW_PROMPT = (commentText, sentiment, language, replyText) => `你是一个严格的内容审核员，负责检查一条即将发布到Instagram的评论回复是否合适。

原评论: "${commentText}"
评论情感分类: ${sentiment}
评论语言代码: ${language}
待审核的回复: "${replyText}"

请检查以下几点，严格按JSON格式返回结果，不要输出多余文字:
1. 回复语言是否与评论语言代码(${language})一致
2. 回复语气是否自然、像真人在聊天，而不是机器人/客服腔调
3. 回复是否暴露了"这是AI/自动回复/官方账号"等信息
4. 如果原评论是negative，回复是否足够谨慎得体，没有火上浇油
5. 回复长度是否合适(不要太长，1-2句话为宜)

返回格式:
{"approved": true 或 false, "issues": "如果不合格，说明具体问题；如果合格，留空字符串"}
`;

/** 调用 Claude 审核回复是否合适 */
async function reviewReply(commentText, analysis, replyText, client) {
  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: REVIEW_PROMPT(
          commentText,
          analysis.sentiment || "neutral",
          analysis.language || "unknown",
          replyText
        ),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error(`Claude 未返回文本内容 (stop_reason=${message.stop_reason})`);
  }

  const rawText = textBlock.text.trim();
  try {
    return JSON.parse(rawText);
  } catch (err) {
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  }
}

module.exports = { reviewReply };
