/**
 * Agent 3: 生成者 (Replier)
 * 根据 Agent 2 的分析结果，生成符合语气、符合评论语言的回复文本。
 */

// 人设可以通过 .env 里的 ACCOUNT_PERSONA 自定义，默认是「账号主人本人」在亲自回复
const DEFAULT_PERSONA = "你就是这个Instagram账号的本人，这是你自己分享日常生活/照片的个人账号，不是品牌或官方账号。回复评论时要像朋友之间聊天一样自然，绝不能暴露或暗示自己是机器人/官方/客服";

const REPLY_PROMPT = (commentText, sentiment, language, persona, feedback) => `${persona}。

评论原文: "${commentText}"
评论情感分类: ${sentiment}
评论语言代码: ${language}

请生成一条回复这条评论的文本，要求:
1. 必须使用与评论语言代码(${language})相同的语言回复，不要翻译成其他语言
2. 【语气要跟着评论走】仔细判断评论原文使用的是敬语/正式语气，还是非敬语/随意语气（比如韩语的반말 vs 존댓말，中文的"亲"体 vs 日常口语），你的回复要匹配同样的随意程度——评论很随性，你就用朋友间聊天的随意语气回复；评论很正式，你才用礼貌语气回复
3. 控制在1-2句话以内，符合Instagram评论区的自然语气，可以适当用表情符号
4. 如果评论是关于你个人生活的真实提问（比如"明天来不来学校"这种朋友间会问的问题），把自己当成账号本人，像朋友一样自然地给出一个合理回答，不要说"这是官方账号/你发错人了"这类话术
5. 如果情感分类是 negative，语气要谨慎、礼貌，避免火上浇油
6. 不要输出任何解释性文字，只输出最终的回复内容本身${
  feedback
    ? `\n\n【重要】你上一次生成的回复被审核打回，原因是: "${feedback}"。请根据这个反馈修改，生成一条新的、解决了上述问题的回复。`
    : ""
}`;

/** 调用 Claude 生成回复文本。feedback 为审核意见，传入时表示这是一次重新生成 */
async function generateReply(commentText, analysis, client, feedback = null) {
  const persona = process.env.ACCOUNT_PERSONA || DEFAULT_PERSONA;
  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: REPLY_PROMPT(
          commentText,
          analysis.sentiment || "neutral",
          analysis.language || "unknown",
          persona,
          feedback
        ),
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error(`Claude 未返回文本内容 (stop_reason=${message.stop_reason})`);
  }
  return textBlock.text.trim();
}

module.exports = { generateReply };
