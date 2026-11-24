# Instagram 评论自动化 Pipeline (Multi-Agent)

一个基于多智能体架构的 Instagram 评论自动回复系统。系统会定期拉取账号下帖子的最新评论，
自动判断评论的语言与情感/意图，生成与评论语言一致的回复，并真实发布到 Instagram 评论区。

## 架构

```
Agent1 Fetcher   -> 拉取 Instagram 帖子下的最新评论
Agent2 Analyzer  -> 检测评论语言 + 用 Claude 分析情感/意图，判断是否需要回复
Agent3 Replier   -> 用 Claude 根据分析结果生成对应语言、合适语气的回复
Agent5 Reviewer  -> 对生成的回复做自我审核(反思循环)，不合格则带着审核意见打回 Replier 重新生成
Agent4 Publisher -> 审核通过后，调用 Instagram Graph API 把回复真实发布出去
```

Agent3 和 Agent5 之间构成一个反思循环（reflection loop）：回复生成后先经过审核，判断语言是否一致、语气是否自然、是否暴露 AI/官方身份等，不合格会带着具体问题重新生成，最多重试 2 次；仍不通过则跳过发布，标记为待人工处理。

五个 Agent 各司其职、通过一个 comment 数据结构逐步传递中间结果，由 `main.js` 负责调度整条流水线，并在每轮结束后生成一份可视化报告 `report.html`，直观展示每条评论从拉取到发布(或打回)的完整链路。

## 环境准备

需要 Node.js 18 及以上版本（使用内置的全局 `fetch`）。

```powershell
npm install
```

复制 `.env.example` 为 `.env`，并填入：

- `IG_ACCESS_TOKEN`: Instagram Graph API 访问令牌
- `IG_BUSINESS_ACCOUNT_ID`: Instagram 专业账号的 Business Account ID
- `ANTHROPIC_API_KEY`: Claude API Key

## 运行

```powershell
node main.js          # 跑一轮
node main.js --loop   # 持续轮询，每 60 秒检查一次新评论
```

已处理过的评论 ID 会记录在本地 `processed_comments.json` 中，避免重复回复。

每轮处理完成后会在项目根目录生成 `report.html`，用浏览器打开即可看到本轮每条评论经过 Fetcher → Analyzer → Replier → Reviewer → Publisher 各环节的可视化流程图。

## 技术栈

- Node.js
- Instagram Graph API（评论拉取 / 回复发布）
- Anthropic Claude API（情感分析 / 回复生成）
- 基于 Unicode 字符范围的轻量级本地语言检测（无需额外 API 调用）
