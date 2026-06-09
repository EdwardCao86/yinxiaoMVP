# Broker Hotspot MVP

券商评论接口到热点文章和 Banner 生成的端到端 MVP。

## Run

```bash
npm start
# http://localhost:4193
```

## Test

```bash
npm test
```

## Optional Environment

真实券商接口按你提供的 curl 形态调用：`curl -sS -x <proxy> --proxy-user <user> -H 'Content-Type: application/json' -d '{"columnCode":"...","bussId":10001}' <url>`。

复制 `.env.example` 为 `.env` 后填入代理账号即可；`.env` 不会进入 git：

```bash
cp .env.example .env

BROKER_API_URL="https://saas.htsc.com.cn:1462/content/tencent/proxy/content/queryContentMaterialInfo"
BROKER_PROXY_URL="http://your-proxy:8118"
BROKER_PROXY_USER="user:password"
BROKER_BUSS_ID=10001
```

可选 OpenAI-compatible LLM：

```bash
OPENAI_API_KEY="..."
OPENAI_API_BASE="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4.1-mini"
```

无代理配置或无模型 key 时，项目使用内置券商评论样例和本地规则生成器，保证完整链路可运行。

## MVP Chain

1. 券商评论接口/样例：读取 `SEC0001` 早午晚盘资讯、`SEC0003` 早盘前瞻、`SEC0004` 盘中解读、`SEC0007` 盘后收评、`SEC0034` 产业链图谱。
2. HTML 清洗：解析标题、正文段落、数据来源和风险提示。
3. 热点抽取：按关键词证据抽取宏观风险、机器人、城市更新、地缘、黄金、AI 芯片、红利防守等候选热点。
4. 资产映射：把热点关键词映射到 ETF/股票资产线索，输出匹配关键词、方向和风险等级。
5. 内容生成：优先使用 OpenAI-compatible LLM；未配置时使用本地规则生成 Banner、半屏标题和热点文章。
6. Web 可视化：页面展示链路步骤、券商原文解析、热点排序、文章、Banner/半屏/资产卡片和结构化 JSON。

## API

- `GET /api/health`
- `GET /api/columns`
- `GET /api/comment?columnCode=SEC0004`
- `GET /api/analyze?columnCode=SEC0004`
