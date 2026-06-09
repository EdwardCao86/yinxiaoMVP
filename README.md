# yinxiaoMVP

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

必需 OpenAI-compatible LLM。`/api/analyze` 不使用本地规则或模板兜底；未配置或调用失败会直接返回错误：

```bash
OPENAI_API_KEY="..."
OPENAI_API_BASE="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4.1-mini"
LLM_TIMEOUT_MS=90000
```

无代理配置时，项目可使用内置券商评论样例作为输入；但热点提取、资产线索判断、Banner 和文章生成只由 LLM 完成。

## MVP Chain

1. 券商评论接口/样例：读取 `SEC0001` 早午晚盘资讯、`SEC0003` 早盘前瞻、`SEC0004` 盘中解读、`SEC0007` 盘后收评、`SEC0034` 产业链图谱。
2. HTML 清洗：解析标题、正文段落、数据来源和风险提示。
3. LLM 热点提取：把结构化券商评论直接发给 LLM，由 LLM 提取 2-5 个热点、证据句、关键词、评分、情绪和风险等级。
4. LLM 资产线索判断：由 LLM 根据正文证据判断产品/资产/板块线索；正文不足以支撑具体产品代码时要求留空，不强行编造。
5. LLM 物料生成：由 LLM 生成 Banner、半屏标题、热点摘要、文章和风险提示；生成失败直接报错。
6. Web 可视化：页面展示链路步骤、券商原文解析、LLM 热点列表、文章、Banner/半屏/资产卡片和结构化 JSON。

## API

- `GET /api/health`
- `GET /api/columns`
- `GET /api/comment?columnCode=SEC0004`
- `GET /api/analyze?columnCode=SEC0004`
