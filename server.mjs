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

const assetUniverse = [
  { code: '159770', name: '机器人ETF', type: 'ETF', keywords: ['机器人', '物理AI', '人形机器人', '智能制造', '工业自动化'], risk: '高', direction: '机器人产业链' },
  { code: '159819', name: '人工智能ETF', type: 'ETF', keywords: ['AI', '算力', '英伟达', '半导体', '内存'], risk: '中高', direction: 'AI 科技' },
  { code: '512760', name: '半导体ETF', type: 'ETF', keywords: ['半导体', '芯片', 'SK海力士', '英伟达', '内存'], risk: '高', direction: '半导体' },
  { code: '518880', name: '黄金ETF', type: 'ETF', keywords: ['黄金', '央行', '避险', '地缘', '伊朗', '以色列'], risk: '中', direction: '贵金属' },
  { code: '515080', name: '中证红利ETF', type: 'ETF', keywords: ['红利', '低位', '防守', '银行', '保险'], risk: '中', direction: '红利防守' },
  { code: '000001', name: '平安银行', type: '股票', keywords: ['银行', '保险', '防守'], risk: '中', direction: '金融防守' },
  { code: '159611', name: '基建ETF', type: 'ETF', keywords: ['城市更新', '地下管网', '工程机械', '基建'], risk: '中高', direction: '基建城市更新' },
  { code: '159915', name: '创业板ETF', type: 'ETF', keywords: ['创业板', '科技', '成长'], risk: '高', direction: '成长风格' },
];

const topicRules = [
  {
    id: 'global-risk',
    keywords: ['全球资产', '大跌', '熔断', '破位', '港股', '日韩', '比特币', '风险偏好'],
    title: '全球资产波动加剧，防守思路升温',
    angle: '宏观风险',
    sentiment: 'negative',
    riskLevel: 'high',
  },
  {
    id: 'robotics',
    keywords: ['机器人', '物理AI', '人形机器人', '优必选', '智能制造', '工业气体'],
    title: '机器人方向逆势活跃，产业链关注度提升',
    angle: '产业主题',
    sentiment: 'positive',
    riskLevel: 'medium',
  },
  {
    id: 'city-renewal',
    keywords: ['城市更新', '地下管网', '工程机械', '十五五', '基建'],
    title: '城市更新任务推进，基建链条迎来政策线索',
    angle: '政策主题',
    sentiment: 'positive',
    riskLevel: 'medium',
  },
  {
    id: 'geopolitics',
    keywords: ['以色列', '伊朗', '胡塞', '导弹', '特朗普', '中东'],
    title: '地缘扰动升温，避险情绪仍需关注',
    angle: '地缘风险',
    sentiment: 'negative',
    riskLevel: 'high',
  },
  {
    id: 'gold',
    keywords: ['黄金', '央行', '外汇储备', '增持', '避险'],
    title: '黄金储备延续增加，贵金属配置线索强化',
    angle: '贵金属',
    sentiment: 'neutral',
    riskLevel: 'medium',
  },
  {
    id: 'ai-chip',
    keywords: ['英伟达', 'SK海力士', 'AI工厂', '内存', '半导体', '芯片'],
    title: 'AI 芯片与内存合作推进，算力产业链再获关注',
    angle: 'AI 科技',
    sentiment: 'positive',
    riskLevel: 'medium',
  },
  {
    id: 'defensive-dividend',
    keywords: ['银行', '保险', '红利', '防守', '低位板块'],
    title: '防守板块相对占优，红利资产线索延续',
    angle: '防守风格',
    sentiment: 'neutral',
    riskLevel: 'low',
  },
];

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
      note: `broker api unavailable: ${error.message}`,
    };
  }
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

function extractTopics(comment) {
  const fullText = `${comment.title}\n${comment.paragraphs.join('\n')}`;
  const topics = [];
  for (const rule of topicRules) {
    const hits = rule.keywords.filter(k => fullText.includes(k));
    if (!hits.length) continue;
    const evidence = comment.paragraphs
      .filter(p => hits.some(k => p.includes(k)))
      .slice(0, 3);
    const assets = matchAssets(`${rule.title} ${hits.join(' ')} ${evidence.join(' ')}`);
    const score = scoreTopic(rule, hits, evidence, assets, comment);
    topics.push({
      id: `${rule.id}-${hash(comment.title).slice(0, 6)}`,
      title: rule.title,
      angle: rule.angle,
      sentiment: rule.sentiment,
      riskLevel: rule.riskLevel,
      score,
      keywords: hits,
      evidence,
      relatedAssets: assets,
      sourceColumn: comment.columnCode,
      sourceTitle: comment.title,
    });
  }
  if (!topics.length) {
    topics.push({
      id: `market-summary-${hash(comment.title).slice(0, 6)}`,
      title: comment.title.replace(/^【.*?】/, ''),
      angle: '市场解读',
      sentiment: 'neutral',
      riskLevel: 'medium',
      score: 62,
      keywords: ['市场', '热点'],
      evidence: comment.paragraphs.slice(0, 2),
      relatedAssets: [],
      sourceColumn: comment.columnCode,
      sourceTitle: comment.title,
    });
  }
  return topics.sort((a, b) => b.score - a.score).slice(0, 5);
}

function scoreTopic(rule, hits, evidence, assets, comment) {
  const firstEvidenceIndex = evidence.length ? comment.paragraphs.findIndex(p => p === evidence[0]) : 99;
  const positionScore = Math.max(0, 30 - firstEvidenceIndex * 4);
  const importance = Math.min(25, hits.length * 5 + evidence.length * 4);
  const assetScore = Math.min(15, assets.length * 5);
  const riskBoost = rule.riskLevel === 'high' ? 8 : rule.riskLevel === 'medium' ? 5 : 2;
  const marketability = rule.sentiment === 'positive' ? 12 : 8;
  return Math.min(98, Math.round(35 + positionScore + importance + assetScore + riskBoost + marketability));
}

function matchAssets(text) {
  return assetUniverse
    .map(asset => {
      const hits = asset.keywords.filter(k => text.includes(k));
      return {
        ...asset,
        matchedKeywords: hits,
        relevance: Math.min(96, 45 + hits.length * 18),
      };
    })
    .filter(asset => asset.matchedKeywords.length)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 4)
    .map(({ keywords, ...asset }) => asset);
}

async function generateMaterials(comment, topics) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithLLM(comment, topics);
    } catch (error) {
      const local = generateLocally(comment, topics);
      return { ...local, generator: 'local-fallback', generatorNote: `LLM unavailable: ${error.message}` };
    }
  }
  return { ...generateLocally(comment, topics), generator: 'local-rule-engine' };
}

async function generateWithLLM(comment, topics) {
  const base = (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const prompt = {
    role: 'user',
    content: `你是证券业务内容运营助手。请基于券商评论和候选热点，生成 JSON，字段包括 topics。每个 topic 需要 title, summary, banner_title, banner_subtitle, half_screen_title, article, related_assets, risk_warning。禁止补充证据外事实，必须保留不构成投资建议提示。\n\n券商评论：${JSON.stringify(comment)}\n候选热点：${JSON.stringify(topics)}`,
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
      messages: [
        { role: 'system', content: '只输出严格 JSON。' },
        prompt,
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);
  return {
    generator: `llm:${model}`,
    topics: normalizeGeneratedTopics(parsed.topics || [], topics, comment),
  };
}

function normalizeGeneratedTopics(generated, topics, comment) {
  return topics.map((topic, index) => {
    const g = generated[index] || {};
    return {
      ...topic,
      summary: g.summary || makeSummary(topic),
      banner: {
        title: g.banner_title || makeBannerTitle(topic),
        subtitle: g.banner_subtitle || makeBannerSubtitle(topic),
        buttonText: '查看热点解读',
        riskTag: riskLabel(topic.riskLevel),
      },
      halfScreenTitle: g.half_screen_title || `AI 解读：${topic.title}`,
      article: g.article || makeArticle(topic, comment),
      riskWarning: g.risk_warning || compactRisk(comment.riskWarning),
    };
  });
}

function generateLocally(comment, topics) {
  return {
    topics: topics.map(topic => ({
      ...topic,
      summary: makeSummary(topic),
      banner: {
        title: makeBannerTitle(topic),
        subtitle: makeBannerSubtitle(topic),
        buttonText: '查看热点解读',
        riskTag: riskLabel(topic.riskLevel),
      },
      halfScreenTitle: `AI 解读：${topic.title}`,
      article: makeArticle(topic, comment),
      riskWarning: compactRisk(comment.riskWarning),
    })),
  };
}

function makeSummary(topic) {
  const assetText = topic.relatedAssets.length ? `，关联${topic.relatedAssets.slice(0, 3).map(a => a.name).join('、')}` : '';
  return `${topic.sourceTitle}中出现“${topic.keywords.slice(0, 3).join('、')}”等线索，${topic.angle}具备热点解读价值${assetText}。`;
}

function makeBannerTitle(topic) {
  if (topic.id.startsWith('robotics')) return '机器人逆势升温，哪些方向被带动？';
  if (topic.id.startsWith('global-risk')) return '全球资产剧烈波动，如何看待防守线索？';
  if (topic.id.startsWith('city-renewal')) return '地下管网建设提速，基建链条受关注';
  if (topic.id.startsWith('gold')) return '黄金储备持续增加，贵金属线索怎么看？';
  return topic.title;
}

function makeBannerSubtitle(topic) {
  const assets = topic.relatedAssets.slice(0, 2).map(a => a.name).join('、');
  return assets ? `AI 解读热点证据与${assets}` : 'AI 解读券商评论中的热点线索';
}

function makeArticle(topic, comment) {
  const evidenceText = topic.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n');
  const assets = topic.relatedAssets.length
    ? topic.relatedAssets.map(a => `${a.name}（${a.type}，${a.direction}，风险${a.risk}）`).join('、')
    : '暂无明确资产映射，适合先作为资讯解读观察。';
  return [
    `# ${topic.title}`,
    '',
    `## 一句话摘要`,
    makeSummary(topic),
    '',
    `## 发生了什么`,
    evidenceText || '券商评论中出现相关市场线索，适合作为热点观察。',
    '',
    `## 为什么值得关注`,
    `该热点属于${topic.angle}方向，热点评分 ${topic.score}。它同时具备${topic.keywords.slice(0, 4).join('、')}等关键词，可用于生成解释型内容和运营承接。`,
    '',
    `## 相关资产线索`,
    assets,
    '',
    `## 风险提示`,
    compactRisk(comment.riskWarning),
  ].join('\n');
}

function compactRisk(warn = '') {
  const base = warn || '市场有风险，投资需谨慎。本文内容仅供辅助参考，不构成投资建议。';
  const first = base.split(/[。\n]/).filter(Boolean).slice(0, 2).join('。');
  return `${first}。`;
}

function riskLabel(level) {
  return { high: '高波动', medium: '需观察', low: '低风险' }[level] || '需观察';
}

async function runPipeline(columnCode = 'SEC0004') {
  const source = await fetchBrokerHtml(columnCode);
  const comment = parseBrokerHtml(source.html, columnCode);
  const topics = extractTopics(comment);
  const generated = await generateMaterials(comment, topics);
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
        { id: 'extract', name: '热点抽取与资产映射', status: 'done', detail: `${topics.length} 个候选热点` },
        { id: 'rank', name: '热点评分排序', status: 'done', detail: `Top1 ${topics[0]?.score || 0} 分` },
        { id: 'generate', name: '生成文章和 Banner', status: 'done', detail: generated.generator },
      ],
    },
    topics: generated.topics,
  };
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
    if (url.pathname === '/api/health') return json(res, { ok: true, name: 'broker-hotspot-mvp', time: new Date().toISOString() });
    if (url.pathname === '/api/columns') return json(res, { ok: true, data: columns });
    if (url.pathname === '/api/comment') {
      const columnCode = url.searchParams.get('columnCode') || 'SEC0004';
      const source = await fetchBrokerHtml(columnCode);
      return json(res, { ok: true, source, data: parseBrokerHtml(source.html, columnCode) });
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
  console.log(`Broker Hotspot MVP running at http://localhost:${PORT}`);
});
