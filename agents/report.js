/**
 * 可视化报告生成器
 * 把本轮 pipeline 处理过的每条评论的完整链路（Fetcher -> Analyzer -> Replier -> Publisher）
 * 渲染成一份静态 HTML 报告，方便 demo 展示。
 */

const fs = require("fs");

const SENTIMENT_STYLE = {
  positive: { label: "正面", color: "#2e7d32", bg: "#e8f5e9" },
  negative: { label: "负面", color: "#c62828", bg: "#ffebee" },
  question: { label: "提问", color: "#1565c0", bg: "#e3f2fd" },
  neutral: { label: "中性", color: "#616161", bg: "#f5f5f5" },
  spam: { label: "垃圾信息", color: "#6a1b9a", bg: "#f3e5f5" },
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReviewStep(reviewHistory = []) {
  if (!reviewHistory.length) return "";

  const attemptsHtml = reviewHistory
    .map((r, i) => {
      const ok = r.review?.approved;
      return `<div class="review-attempt ${ok ? "pass" : "fail"}">
        <span class="badge ${ok ? "success" : "fail"}">${ok ? "✓ 通过" : "✗ 未通过"}</span>
        第${i + 1}次: "${escapeHtml(r.replyText)}"
        ${!ok ? `<div class="reason">问题: ${escapeHtml(r.review?.issues || "")}</div>` : ""}
      </div>`;
    })
    .join("");

  return `
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-icon">5</div>
      <div class="step-body">
        <div class="step-title">Reviewer · 自我审核 (反思循环，共 ${reviewHistory.length} 次)</div>
        <div class="step-content">${attemptsHtml}</div>
      </div>
    </div>`;
}

function renderCard(record) {
  const { username, text, analysis, replyText, publishResult, skipped, reviewHistory, needsManualReview } = record;
  const sentimentKey = analysis?.sentiment || "neutral";
  const style = SENTIMENT_STYLE[sentimentKey] || SENTIMENT_STYLE.neutral;

  const stepsHtml = `
    <div class="step">
      <div class="step-icon">1</div>
      <div class="step-body">
        <div class="step-title">Fetcher · 拉取评论</div>
        <div class="step-content">@${escapeHtml(username)}: "${escapeHtml(text)}"</div>
      </div>
    </div>
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-icon">2</div>
      <div class="step-body">
        <div class="step-title">Analyzer · 分析</div>
        <div class="step-content">
          <span class="badge" style="color:${style.color};background:${style.bg}">${style.label}</span>
          <span class="badge lang">语言: ${escapeHtml(analysis?.language || "unknown")}</span>
          <div class="reason">${escapeHtml(analysis?.reason || "")}</div>
        </div>
      </div>
    </div>
    ${
      skipped
        ? `<div class="arrow">↓</div>
           <div class="step skipped">
             <div class="step-icon">—</div>
             <div class="step-body"><div class="step-title">判定无需回复，流程结束</div></div>
           </div>`
        : `
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-icon">3</div>
      <div class="step-body">
        <div class="step-title">Replier · 生成回复</div>
        <div class="step-content reply-text">${escapeHtml(replyText)}</div>
      </div>
    </div>
    ${renderReviewStep(reviewHistory)}
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-icon">4</div>
      <div class="step-body">
        <div class="step-title">Publisher · 发布</div>
        <div class="step-content">
          ${
            needsManualReview
              ? `<span class="badge manual">⚠ 多次审核未通过，已跳过发布，待人工处理</span>`
              : publishResult?.success
              ? `<span class="badge success">✓ 发布成功 (reply_id: ${escapeHtml(publishResult.replyId)})</span>`
              : `<span class="badge fail">✗ 发布失败: ${escapeHtml(publishResult?.error)}</span>`
          }
        </div>
      </div>
    </div>`
    }
  `;

  return `<div class="card">${stepsHtml}</div>`;
}

function generateReport(records, outputPath = "report.html") {
  const cardsHtml = records.length
    ? records.map(renderCard).join("\n")
    : `<p class="empty">本轮没有新评论需要处理</p>`;

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8" />
<title>Instagram 评论自动化 Pipeline 报告</title>
<style>
  body { font-family: -apple-system, "Microsoft YaHei", sans-serif; background: #f0f2f5; margin: 0; padding: 32px; color: #1a1a1a; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #666; margin-bottom: 24px; font-size: 14px; }
  .pipeline-overview { display: flex; align-items: center; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
  .agent-chip { background: #fff; border-radius: 10px; padding: 10px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px; font-weight: 600; }
  .chip-arrow { color: #999; }
  .card { background: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
  .step { display: flex; gap: 12px; align-items: flex-start; }
  .step-icon { width: 26px; height: 26px; border-radius: 50%; background: #1976d2; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .step.skipped .step-icon { background: #9e9e9e; }
  .step-title { font-weight: 600; font-size: 13px; color: #333; margin-bottom: 4px; }
  .step-content { font-size: 14px; color: #444; }
  .arrow { text-align: center; color: #bbb; margin: 2px 0 2px 12px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-right: 6px; }
  .badge.lang { background: #eceff1; color: #455a64; }
  .badge.success { background: #e8f5e9; color: #2e7d32; }
  .badge.fail { background: #ffebee; color: #c62828; }
  .badge.manual { background: #fff3e0; color: #e65100; }
  .review-attempt { font-size: 13px; margin-bottom: 6px; padding: 8px 10px; border-radius: 8px; background: #fafafa; }
  .review-attempt.fail { background: #fff8f7; }
  .reason { font-size: 12px; color: #888; margin-top: 4px; }
  .reply-text { background: #fff8e1; padding: 8px 12px; border-radius: 8px; display: inline-block; }
  .empty { color: #999; }
  .generated-at { color: #aaa; font-size: 12px; margin-top: 32px; }
</style>
</head>
<body>
  <h1>Instagram 评论自动化 Pipeline 报告</h1>
  <div class="subtitle">多智能体协作流程可视化</div>

  <div class="pipeline-overview">
    <div class="agent-chip">Agent1 Fetcher<br/><span style="font-weight:400;color:#888">拉取评论</span></div>
    <div class="chip-arrow">→</div>
    <div class="agent-chip">Agent2 Analyzer<br/><span style="font-weight:400;color:#888">语言/情感分析</span></div>
    <div class="chip-arrow">→</div>
    <div class="agent-chip">Agent3 Replier<br/><span style="font-weight:400;color:#888">生成回复</span></div>
    <div class="chip-arrow">→</div>
    <div class="agent-chip">Agent5 Reviewer<br/><span style="font-weight:400;color:#888">自我审核(反思循环)</span></div>
    <div class="chip-arrow">→</div>
    <div class="agent-chip">Agent4 Publisher<br/><span style="font-weight:400;color:#888">真实发布</span></div>
  </div>

  ${cardsHtml}

  <div class="generated-at">报告生成时间: ${new Date().toLocaleString("zh-CN")}</div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, "utf-8");
  return outputPath;
}

module.exports = { generateReport };
