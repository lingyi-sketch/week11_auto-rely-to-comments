/**
 * 多智能体 Instagram 评论自动化 Pipeline
 *
 * 数据流:
 *   Agent1(fetcher) -> Agent2(analyzer) -> Agent3(replier) -> Agent4(publisher)
 *
 * 运行方式:
 *   node main.js            跑一轮
 *   node main.js --loop     每隔 POLL_INTERVAL 毫秒循环跑一次
 */

require("dotenv").config();
const fs = require("fs");
const Anthropic = require("@anthropic-ai/sdk").default;

const { fetchAllNewComments } = require("./agents/fetcher");
const { analyzeComment } = require("./agents/analyzer");
const { generateReply } = require("./agents/replier");
const { publishReply } = require("./agents/publisher");

const { IG_ACCESS_TOKEN, IG_BUSINESS_ACCOUNT_ID, ANTHROPIC_API_KEY } = process.env;

if (!IG_ACCESS_TOKEN || !IG_BUSINESS_ACCOUNT_ID || !ANTHROPIC_API_KEY) {
  console.error("缺少必要的环境变量，请检查 .env 文件是否已正确配置");
  process.exit(1);
}

const PROCESSED_FILE = "processed_comments.json";
const POLL_INTERVAL_MS = 60_000;

function loadProcessedIds() {
  if (fs.existsSync(PROCESSED_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf-8")));
  }
  return new Set();
}

function saveProcessedIds(ids) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...ids], null, 2), "utf-8");
}

async function runOnce(client, processedIds) {
  const comments = await fetchAllNewComments(IG_BUSINESS_ACCOUNT_ID, IG_ACCESS_TOKEN);
  const newComments = comments.filter((c) => !processedIds.has(c.id));

  console.log(`[Fetcher] 拉取到 ${comments.length} 条评论，其中 ${newComments.length} 条是新的`);

  for (const comment of newComments) {
    const { id: commentId, text = "", username = "unknown" } = comment;
    console.log(`\n--- 处理评论 [${commentId}] by @${username}: ${JSON.stringify(text)} ---`);

    const analysis = await analyzeComment(text, client);
    console.log("[Analyzer]", analysis);

    if (!analysis.need_reply) {
      console.log("[Analyzer] 判定为无需回复，跳过");
      processedIds.add(commentId);
      continue;
    }

    const replyText = await generateReply(text, analysis, client);
    console.log(`[Replier] 生成回复: ${JSON.stringify(replyText)}`);

    const result = await publishReply(commentId, replyText, IG_ACCESS_TOKEN);
    if (result.success) {
      console.log(`[Publisher] 发布成功, replyId=${result.replyId}`);
    } else {
      console.log(`[Publisher] 发布失败: ${result.error}`);
    }

    processedIds.add(commentId);
  }

  return processedIds;
}

async function main() {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  let processedIds = loadProcessedIds();

  const loopMode = process.argv.includes("--loop");

  if (!loopMode) {
    processedIds = await runOnce(client, processedIds);
    saveProcessedIds(processedIds);
    return;
  }

  console.log(`进入循环模式，每 ${POLL_INTERVAL_MS / 1000} 秒检查一次新评论 (Ctrl+C 退出)`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    processedIds = await runOnce(client, processedIds);
    saveProcessedIds(processedIds);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Pipeline 执行出错:", err);
  process.exit(1);
});
