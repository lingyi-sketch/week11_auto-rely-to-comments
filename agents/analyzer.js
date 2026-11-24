/**
 * Agent 2: 分析者 (Analyzer)
 * 负责判断每条评论的语言、情感/意图，决定是否需要回复。
 */

const ANALYZE_PROMPT = (commentText) => `你是一个Instagram评论分析助手。请分析下面这条评论，并严格按照JSON格式返回结果，不要输出任何多余的文字，也不要用代码块包裹。

评论内容: "${commentText}"

返回格式:
{"sentiment": "positive | negative | neutral | question | spam", "need_reply": true 或 false, "reason": "一句话说明判断理由"}

判断规则:
- 如果是广告/垃圾信息/无意义内容，sentiment 填 "spam"，need_reply 填 false
- 如果是提问，sentiment 填 "question"，need_reply 填 true
- 如果是夸奖/正面评价，sentiment 填 "positive"，need_reply 填 true
- 如果是负面/抱怨，sentiment 填 "negative"，need_reply 填 true（但后续生成回复时需要谨慎措辞）
- 其他情况 sentiment 填 "neutral"`;

/**
 * 轻量级语言检测，基于 Unicode 字符范围做启发式判断。
 * 不依赖任何外部 API，瞬间完成、零成本。
 */
function detectLanguage(text) {
  if (/[가-힣]/.test(text)) return "ko"; // 韩文(谚文)
  if (/[぀-ヿ]/.test(text)) return "ja"; // 日文假名
  if (/[一-鿿]/.test(text)) return "zh"; // 中文汉字
  if (/[a-zA-Z]/.test(text)) return "en"; // 默认按英文/拉丁字母处理
  return "unknown";
}

/** 调用 Claude 分析评论的情感/意图，返回结构化结果 */
async function analyzeComment(commentText, client) {
  const message = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: ANALYZE_PROMPT(commentText) }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock) {
    throw new Error(`Claude 未返回文本内容 (stop_reason=${message.stop_reason})`);
  }
  const rawText = textBlock.text.trim();
  let result;
  try {
    result = JSON.parse(rawText);
  } catch (err) {
    // 模型偶尔会在 JSON 外包一层代码块，做一次简单清理再重试
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    result = JSON.parse(cleaned);
  }

  result.language = detectLanguage(commentText);
  return result;
}

module.exports = { detectLanguage, analyzeComment };
