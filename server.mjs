import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 4193);
const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

loadDotEnv();

const BROKER_API_URL = process.env.BROKER_API_URL || 'https://saas.htsc.com.cn:1462/content/tencent/proxy/content/queryContentMaterialInfo';
const BROKER_BUSS_ID = Number(process.env.BROKER_BUSS_ID || 10001);
const BROKER_PROXY_URL = process.env.BROKER_PROXY_URL || '';
const BROKER_PROXY_USER = process.env.BROKER_PROXY_USER || '';
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 90000);

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const columns = [
  { columnCode: 'SEC0001', columnName: '早午晚盘资讯', session: 'daily' },
  { columnCode: 'SEC0003', columnName: '早盘前瞻', session: 'morning' },
  { columnCode: 'SEC0004', columnName: '盘中解读', session: 'midday' },
  { columnCode: 'SEC0007', columnName: '盘后收评', session: 'evening' },
  { columnCode: 'SEC0034', columnName: '产业链图谱', session: 'industry' },
];

const sampleHtml = {
  SEC0001: `<h1><span>【早午晚盘资讯】</span><span>6月8日：全球波动下寻找结构性线索</span></h1><div><span>市场在外部风险扰动下震荡加剧，防守型资产和低位板块相对占优。</span></div><div><span>科技方向分化延续，机器人、AI 芯片和智能制造仍有局部资金关注。</span></div><div><span>政策线索方面，城市更新和地下管网建设继续提供基建链条观察点。</span></div><div><data-text>部分数据、资讯来源于第三方</data-text></div><div><warn>风险提示：市场有风险，投资需谨慎。本文内容仅供辅助参考，在任何情况下均不构成投资建议或投资依据。</warn></div>`,
  SEC0004: `<h1><span>【盘中解读】</span><span>6月8日</span><span>：全球资产巨震仍在进行时</span></h1><div><span>上午市场跳空低开后震荡回升再走低，截至午盘三大指数均出现大跌，沪指稍强。虽然盘中的回暖让指数收出假阳线，较开盘时的恐慌好了一些，但三大指数均未能回补缺口，因此仍属于破位下跌。但值得注意的是，上午北证50指数再度大涨，活跃资金“不甘寂寞”，也侧面说明当前利空因素虽多，但可能并非全面持续性风险。</span></div><div></div><div><span>板块方面，油气、工程机械、保险、银行等老登板块涨幅居前。科技这边，物理AI、机器人、工业气体相对强势。6月7日，优必选科技宣布旗下优世界超仿生人形机器人首发预订单量6天累计达2110+台。</span></div><div></div><div><span>在今天举行的国务院政策例行吹风会上，多位部委负责人介绍将在“十五五”期间支持城市更新重点任务，将继续建设改造城市地下管网约77万公里。</span></div><div></div><div><span>北京时间今天上午，美国全国广播公司（NBC）的《与新闻界对话》节目播出了对总统特朗普的专访。特朗普在接受采访时称，美伊离达成协议“非常近了”，但无论能否达成协议，“我们都是赢家”，还称伊朗已让步并承诺不会拥有核武器。但据今天上午以色列和伊朗媒体报道，以色列正在攻击伊朗境内目标，也门胡塞武装则对以色列发起导弹袭击。</span></div><div></div><div><span>港股上午跌幅与A股基本相当，日韩股市也出现大跌，韩国KOSPI指数盘初就因跌幅超8%触发熔断机制。黄金和比特币亦有走低，全球资产的巨震仍在进行时，宜保持谨慎。我们觉得A股有可能在这次巨震中相对强势，但这不是能随意“抄底”的理由，合适的博弈点位也许仍需等待。</span></div><div></div><div><data-text>部分数据、资讯来源于第三方</data-text></div><div><warn>风险提示：市场有风险，投资需谨慎。本文内容仅为投顾个人观点，仅供辅助参考，在任何情况下均不构成投资建议或投资依据。投资者应根据自身情况自主、审慎作出投资决策，自行承担投资风险。本文内容由华泰证券提供并享有著作权，除华泰证券书面同意外，不得转载或用于商业用途。</warn></div>`,
  SEC0003: `<h1><span>【早盘前瞻】</span><span>6月8日：科技退潮和加息预期引发全球股市大跌，市场</span><span>风险仍在</span></h1><div><span>上周五市场震荡下跌，隔夜美股遭遇重挫，纳指跌超4个点。纳斯达克中国金龙指数跌3.56%，富时A50期指夜盘跌0.68%。</span></div><div><span>中东方面，局势稍微转向紧张。以色列国防军6月7日晚称，以军正在拦截伊朗向以色列北部发射的导弹，以色列北部多个地区拉响防空警报。</span></div><div><span>大盘方面，目前各大宽基指数无论日线还是周线，都没有什么值得乐观的理由，因此市场可能强则震荡，弱则回调，防守是第一位的。板块方面，科技可能仍会处于分化和退潮，低位板块和红利板块或有一定机会。</span></div><div><span>据央行数据，我国5月末黄金储备报7496万盎司，环比增加32万盎司，为连续第19个月增持黄金。</span></div><div><span>6月8日，英伟达与SK海力士宣布建立多年期技术合作伙伴关系，围绕全球AI工厂建设所需的下一代内存展开联合研发，并将AI技术应用于半导体芯片设计与制造。</span></div><div><data-text>部分数据、资讯来源于第三方</data-text></div><div><warn>风险提示：市场有风险，投资需谨慎。本文内容仅供辅助参考，在任何情况下均不构成投资建议或投资依据。</warn></div>`,
  SEC0007: `<h1><span>【盘后收评】</span><span>6月8日：防守板块走强，科技分化延续</span></h1><div><span>市场全天震荡调整，防守型板块相对活跃，银行、保险、油气等方向表现较强。</span></div><div><span>科技成长方向继续分化，AI 算力、机器人、半导体设备仍有局部资金关注，但板块内部轮动较快。</span></div><div><span>资金层面看，市场仍在消化外部扰动和风险偏好回落，短期不宜盲目追高。</span></div><div><data-text>部分数据、资讯来源于第三方</data-text></div><div><warn>风险提示：市场有风险，投资需谨慎。本文不构成投资建议。</warn></div>`,
  SEC0034: `<h1><span>【产业链图谱】</span><span>机器人产业链热度提升</span></h1><div><span>机器人产业链涵盖减速器、伺服系统、控制器、传感器、整机制造和应用场景等环节。</span></div><div><span>近期人形机器人订单、AI 模型迭代和智能制造升级成为产业链关注催化。</span></div><div><span>相关资产包括机器人 ETF、智能制造基金、工业自动化和高端装备方向。</span></div><div><warn>风险提示：产业趋势不代表短期股价表现，投资需谨慎。</warn></div>`,
};

function stripTags(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseBrokerHtml(rawHtml, columnCode = 'SEC0004') {
  const col = columns.find(c => c.columnCode === columnCode) || columns[1];
  const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = stripTags(h1Match?.[1] || col.columnName);
  const warnMatch = rawHtml.match(/<warn[^>]*>([\s\S]*?)<\/warn>/i);
  const dataTextMatch = rawHtml.match(/<data-text[^>]*>([\s\S]*?)<\/data-text>/i);
  const paragraphMatches = [...rawHtml.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)];
  const paragraphs = paragraphMatches
    .map(m => stripTags(m[1]))
    .filter(text => text && !text.startsWith('风险提示') && !text.includes('部分数据、资讯来源'));

  return {
    columnCode: col.columnCode,
    columnName: col.columnName,
    title,
    publishDate: extractDate(title) || new Date().toISOString().slice(0, 10),
    paragraphs,
    dataSourceText: stripTags(dataTextMatch?.[1] || ''),
    riskWarning: stripTags(warnMatch?.[1] || '市场有风险，投资需谨慎。本文内容仅供辅助参考，不构成投资建议。'),
    rawHtml,
  };
}

function extractDate(text) {
  const m = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return '';
  const year = new Date().getFullYear();
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function fetchBrokerHtml(columnCode) {
  const requestBody = JSON.stringify({ columnCode, bussId: BROKER_BUSS_ID });
  if (process.env.BROKER_API_DISABLED === 'true') {
    return { html: sampleHtml[columnCode] || sampleHtml.SEC0004, source: 'sample-disabled' };
  }
  if (!BROKER_PROXY_URL || !BROKER_PROXY_USER) {
    return { html: sampleHtml[columnCode] || sampleHtml.SEC0004, source: 'sample-no-proxy-config' };
  }

  try {
    const args = [
      '-sS',
      '-x',
      BROKER_PROXY_URL,
      '--proxy-user',
      BROKER_PROXY_USER,
      '-H',
      'Content-Type: application/json',
      '-d',
      requestBody,
      BROKER_API_URL,
    ];
    const { stdout } = await execFileAsync('curl', args, { timeout: 15000, maxBuffer: 1024 * 1024 * 4 });
    return { html: extractHtmlFromApiPayload(stdout), source: 'broker-api-curl-proxy' };
  } catch (error) {
    return {
      html: sampleHtml[columnCode] || sampleHtml.SEC0004,
      source: 'sample-fallback',
      note: `broker api unavailable: ${sanitizeErrorMessage(error.message)}`,
    };
  }
}

function sanitizeErrorMessage(message = '') {
  let sanitized = String(message);
  if (BROKER_PROXY_USER) sanitized = sanitized.replaceAll(BROKER_PROXY_USER, '<BROKER_PROXY_USER>');
  if (process.env.OPENAI_API_KEY) sanitized = sanitized.replaceAll(process.env.OPENAI_API_KEY, '<OPENAI_API_KEY>');
  return sanitized;
}

function extractHtmlFromApiPayload(payload) {
  const text = String(payload || '').trim();
  if (text.startsWith('<')) return text;
  try {
    const json = JSON.parse(text);
    const candidates = [
      json.html,
      json.content,
      json.data?.html,
      json.data?.content,
      json.data?.materialContent,
      json.data?.materialInfo?.content,
      json.data?.[0]?.content,
      json.result?.content,
    ].filter(Boolean);
    const found = candidates.find(v => String(v).includes('<h1') || String(v).includes('<div'));
    if (found) return String(found);
  } catch {
    // Payload may already be an escaped HTML string.
  }
  const unquoted = text.replace(/^"+|"+$/g, '').replace(/\\"/g, '"');
  if (unquoted.includes('<h1') || unquoted.includes('<div')) return unquoted;
  throw new Error('broker api response did not contain html content');
}

async function generateMaterials(comment) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for hotspot generation');
  }
  return generateWithLLM(comment);
}

async function generateWithLLM(comment) {
  const base = (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const llmComment = {
    columnCode: comment.columnCode,
    columnName: comment.columnName,
    title: comment.title,
    publishDate: comment.publishDate,
    paragraphs: comment.paragraphs.map(p => p.slice(0, 360)).slice(0, 8),
    dataSourceText: comment.dataSourceText,
    riskWarning: comment.riskWarning,
  };
  const prompt = {
    role: 'user',
    content: `你是券商 App 的证券资讯运营助手，目标是把一篇券商评论转成可用于 App 首页/行情页分发的热点内容物料。

输入说明：
- 输入是券商评论 HTML 清洗后的结构化正文。
- 只能使用输入中的标题、正文、数据来源和风险提示。
- 不得使用外部事实，不得补充正文没有支撑的事件、数据、公司或产品。

任务：
1. 从正文中提取 2-3 个最适合做营销分发的热点。
2. 为每个热点判断资产/产品/板块线索。
3. 生成 Banner、半屏标题、摘要、文章和风险提示。

热点选择标准，按优先级排序：
1. 正文证据明确，至少能摘出 1 条原文证据句。
2. 用户可理解，有清晰的投资者关注点，例如风险波动、政策催化、产业事件、市场风格、资产配置。
3. 适合做运营承接，有可解释的资产/板块/产品线索。
4. 一个 topic 只能表达一个主线；没有直接因果关系的主题必须拆开，不能为了凑数量合并。
5. 不输出只有一句泛泛表述、缺少证据或难以承接的主题；宁可输出 2 个高质量热点，也不要输出 3 个拼接热点。

资产/产品线索规则：
1. 只有正文明确提到具体产品、指数、股票、基金、ETF 时，才可输出具体 code/name。
2. 正文只支持方向判断时，优先输出更接近真实金融产品承接的名称，但 code 必须为空字符串。
3. 产品承接优先级：具体证券/基金/ETF > 明确指数 > 常见 ETF/基金品类 > 行业或主题板块 > 其他资产方向。
4. 如果正文提到“黄金、红利、银行、机器人、半导体、基建、宽基指数、港股、A股”等方向，可输出类似“黄金ETF”“红利低波ETF”“银行ETF”“机器人ETF”“半导体ETF”“基建ETF”“沪深300ETF/中证A500ETF”“恒生科技ETF”等产品品类名称；但除非正文或输入中出现具体代码，否则 code 必须为空。
5. 如果只是无法产品化的宏观风险、地缘扰动、市场情绪，可输出“宽基指数ETF”“黄金ETF”“债券基金”等泛产品品类；不要只输出“市场风险方向”这类不可承接名称。
6. 禁止编造产品代码，禁止写成确定推荐，禁止输出收益承诺。
7. reason 必须说明“为什么该产品品类/资产线索与热点相关”，依据必须来自正文。

文案风格：
1. Banner 标题要短、有信息点，避免夸张和收益暗示。
2. Banner 副标题说明核心变化或观察角度。
3. article 用资讯解读口吻，不要 Markdown 标题，不要列表符号，不要投资建议。
4. 风险提示必须自然包含“不构成投资建议”。

只输出严格 JSON：
{"topics":[{"title":"","angle":"","sentiment":"positive|neutral|negative","risk_level":"low|medium|high","score":0,"keywords":[],"evidence":[],"summary":"","banner_title":"","banner_subtitle":"","half_screen_title":"","article":"","related_assets":[{"code":"","name":"","type":"ETF|股票|基金|指数|板块|其他","direction":"","risk":"低|中|中高|高","reason":""}],"risk_warning":""}]}

字段约束：
1. topics 输出 2-3 个，按营销价值和证据强度降序。
2. title 尽量 14-18 个中文字符，必须是单一主题；banner_title 16 字以内；banner_subtitle 24 字以内；half_screen_title 20 字以内。
3. score 为 0-100 整数，综合证据强度、用户关注度、运营承接价值。
4. keywords 输出 3-5 个，必须来自正文或正文中的概念。
5. evidence 输出 1-2 条，必须是正文原句或尽量接近原句。
6. summary 60-90 字。
7. article 180-260 字，必须覆盖：发生了什么、为什么值得关注、相关资产线索、风险提示。
8. related_assets 每个热点最多输出 2 个最相关线索，禁止超过 2 个；优先输出 ETF/基金/指数等可承接金融产品品类，code 无正文支撑时为空。
9. risk_warning 必须包含“不构成投资建议”。
10. 只输出 JSON，不要 Markdown，不要解释，不要代码块。

券商评论：${JSON.stringify(llmComment)}`,
  };
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      max_tokens: Number(process.env.LLM_MAX_TOKENS || 2600),
      messages: [
        { role: 'system', content: '只输出严格 JSON。' },
        prompt,
      ],
    }),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const rawText = await res.text();
  console.log('[LLM] response content-type:', res.headers.get('content-type') || 'unknown');
  console.log('[LLM] raw response text:', rawText);
  let json;
  try {
    json = JSON.parse(rawText);
  } catch (error) {
    throw new Error(`LLM returned non-JSON response: ${sanitizeErrorMessage(rawText.slice(0, 300))}`);
  }
  const content = json.choices?.[0]?.message?.content;
  console.log('[LLM] raw response content:', content);
  const parsed = parseLLMJson(content);
  return {
    generator: `llm:${model}`,
    topics: normalizeLLMTopics(parsed.topics, comment),
  };
}

function parseLLMJson(content = '') {
  const text = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(text);
}

function normalizeLLMTopics(topics, comment) {
  if (!Array.isArray(topics) || !topics.length) {
    throw new Error('LLM response missing topics');
  }
  return topics.slice(0, 5).map((topic, index) => {
    const title = assertString(topic.title, `topics[${index}].title`);
    const riskLevel = normalizeRiskLevel(topic.risk_level || topic.riskLevel);
    const relatedAssets = normalizeAssets(topic.related_assets || topic.relatedAssets || [], index);
    const evidence = normalizeStringArray(topic.evidence, `topics[${index}].evidence`);
    const keywords = normalizeStringArray(topic.keywords, `topics[${index}].keywords`);
    const article = assertString(topic.article, `topics[${index}].article`);
    const riskWarning = assertString(topic.risk_warning || topic.riskWarning, `topics[${index}].risk_warning`);
    if (!riskWarning.includes('不构成投资建议')) {
      throw new Error(`topics[${index}].risk_warning must include 不构成投资建议`);
    }
    return {
      id: `${hash(`${comment.title}-${title}-${index}`).slice(0, 12)}`,
      title,
      angle: assertString(topic.angle, `topics[${index}].angle`),
      sentiment: normalizeSentiment(topic.sentiment),
      riskLevel,
      score: normalizeScore(topic.score),
      keywords,
      evidence,
      relatedAssets,
      sourceColumn: comment.columnCode,
      sourceTitle: comment.title,
      summary: assertString(topic.summary, `topics[${index}].summary`),
      banner: {
        title: assertString(topic.banner_title || topic.bannerTitle, `topics[${index}].banner_title`),
        subtitle: assertString(topic.banner_subtitle || topic.bannerSubtitle, `topics[${index}].banner_subtitle`),
        buttonText: '查看热点解读',
        riskTag: riskLabel(riskLevel),
      },
      halfScreenTitle: assertString(topic.half_screen_title || topic.halfScreenTitle, `topics[${index}].half_screen_title`),
      article,
      riskWarning,
    };
  });
}

function assertString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`LLM response missing ${field}`);
  }
  return value.trim();
}

function normalizeStringArray(value, field) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`LLM response missing ${field}`);
  }
  return value.map(item => assertString(item, field)).slice(0, 5);
}

function normalizeAssets(value, topicIndex) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).map((asset, assetIndex) => ({
    code: typeof asset.code === 'string' ? asset.code.trim() : '',
    name: assertString(asset.name, `topics[${topicIndex}].related_assets[${assetIndex}].name`),
    type: assertString(asset.type, `topics[${topicIndex}].related_assets[${assetIndex}].type`),
    direction: assertString(asset.direction, `topics[${topicIndex}].related_assets[${assetIndex}].direction`),
    risk: assertString(asset.risk, `topics[${topicIndex}].related_assets[${assetIndex}].risk`),
    reason: assertString(asset.reason, `topics[${topicIndex}].related_assets[${assetIndex}].reason`),
  }));
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new Error('LLM response has invalid topic score');
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeSentiment(value) {
  if (['positive', 'neutral', 'negative'].includes(value)) return value;
  throw new Error('LLM response has invalid sentiment');
}

function normalizeRiskLevel(value) {
  if (['low', 'medium', 'high'].includes(value)) return value;
  throw new Error('LLM response has invalid risk_level');
}

function riskLabel(level) {
  return { high: '高波动', medium: '需观察', low: '低风险' }[level] || '需观察';
}

async function runPipeline(columnCode = 'SEC0004') {
  const source = await fetchBrokerHtml(columnCode);
  const comment = parseBrokerHtml(source.html, columnCode);
  const generated = await generateMaterials(comment);
  return buildPipelineResult(source, comment, generated);
}

function buildPipelineResult(source, comment, generated) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    source: {
      kind: source.source,
      note: source.note,
      apiConfigured: Boolean(BROKER_API_URL && BROKER_PROXY_URL && BROKER_PROXY_USER),
      llmConfigured: Boolean(process.env.OPENAI_API_KEY),
    },
    columns,
    comment,
    pipeline: {
      steps: [
        { id: 'fetch', name: '券商评论接口', status: 'done', detail: source.source },
        { id: 'parse', name: 'HTML 清洗与结构解析', status: 'done', detail: `${comment.paragraphs.length} 段正文` },
        { id: 'llm', name: 'LLM 提取热点与资产线索', status: 'done', detail: generated.generator },
        { id: 'generate', name: 'LLM 生成文章和 Banner', status: 'done', detail: `${generated.topics.length} 个热点物料` },
      ],
    },
    topics: generated.topics,
  };
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function hash(input) {
  return crypto.createHash('md5').update(String(input)).digest('hex');
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data, null, 2));
}

async function staticFile(res, pathname) {
  const file = pathname === '/' ? path.join(SRC, 'index.html') : path.join(ROOT, pathname.replace(/^\//, ''));
  const normalized = path.normalize(file);
  if (!normalized.startsWith(ROOT) || !existsSync(normalized)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(normalized);
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
  res.end(await readFile(normalized));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/api/health') return json(res, { ok: true, name: 'yinxiaoMVP', time: new Date().toISOString() });
    if (url.pathname === '/api/columns') return json(res, { ok: true, data: columns });
    if (url.pathname === '/api/comment') {
      const columnCode = url.searchParams.get('columnCode') || 'SEC0004';
      const source = await fetchBrokerHtml(columnCode);
      return json(res, { ok: true, source, data: parseBrokerHtml(source.html, columnCode) });
    }
    if (url.pathname === '/api/materials' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body.comment) throw new Error('comment is required');
      const generated = await generateMaterials(body.comment);
      const source = body.source || { source: 'client-comment' };
      return json(res, buildPipelineResult(source, body.comment, generated));
    }
    if (url.pathname === '/api/analyze') {
      const columnCode = url.searchParams.get('columnCode') || 'SEC0004';
      return json(res, await runPipeline(columnCode));
    }
    return staticFile(res, url.pathname);
  } catch (error) {
    json(res, { ok: false, error: error.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`yinxiaoMVP running at http://localhost:${PORT}`);
});
