const state = {
  data: null,
  comment: null,
  source: null,
  pipelineSteps: initialPipelineSteps(),
  selectedTopicId: null,
  running: false,
};

const $ = id => document.getElementById(id);

boot();

async function boot() {
  await loadColumns();
  $('runBtn').addEventListener('click', runPipeline);
  await runPipeline();
}

async function loadColumns() {
  const res = await fetch('/api/columns');
  const json = await res.json();
  $('columnSelect').innerHTML = json.data.map(col => (
    `<option value="${col.columnCode}" ${col.columnCode === 'SEC0004' ? 'selected' : ''}>${col.columnName} · ${col.columnCode}</option>`
  )).join('');
}

async function runPipeline() {
  if (state.running) return;
  state.running = true;
  setRunDisabled(true);
  state.data = null;
  state.comment = null;
  state.source = null;
  state.selectedTopicId = null;
  state.pipelineSteps = initialPipelineSteps();
  clearResultPanels();
  setStepStatus('fetch', 'running', '正在请求券商评论');
  renderPipeline();
  try {
    const columnCode = $('columnSelect').value;
    const commentJson = await fetchJson(`/api/comment?columnCode=${encodeURIComponent(columnCode)}`);
    state.comment = commentJson.data;
    state.source = commentJson.source;
    setStepStatus('fetch', 'done', commentJson.source.source || commentJson.source.kind || 'done');
    setStepStatus('parse', 'done', `${state.comment.paragraphs.length} 段正文`);
    renderComment();
    setStepStatus('llm', 'running', '正在调用 LLM 提取热点与资产线索');
    renderPipeline();

    const materialsJson = await fetchJson('/api/materials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ comment: state.comment, source: state.source }),
    });
    state.data = materialsJson;
    state.pipelineSteps = materialsJson.pipeline.steps.map(step => ({ ...step, status: 'done' }));
    setStepStatus('generate', 'done', `${materialsJson.topics.length} 个热点物料`);
    state.selectedTopicId = materialsJson.topics[0]?.id || null;
    renderAll();
    toast(`链路完成：${materialsJson.topics.length} 个热点`);
  } catch (error) {
    markCurrentStepError(error.message);
    renderPipeline();
    renderError(error.message);
    toast(error.message);
  } finally {
    state.running = false;
    setRunDisabled(false);
  }
}

function renderAll() {
  const data = state.data;
  $('topicCount').textContent = data.topics.length;
  $('assetCount').textContent = uniqueAssets(data.topics).length;
  $('generator').textContent = data.source.llmConfigured ? 'LLM' : '本地';
  renderPipeline();
  renderComment();
  renderTopics();
  renderMaterials();
  $('rawJson').textContent = JSON.stringify(data, null, 2);
}

function renderPipeline() {
  $('pipeline').innerHTML = state.pipelineSteps.map(step => `
    <div class="step ${escapeHtml(step.status)}">
      <span class="step-icon ${escapeHtml(step.status)}"></span>
      <b>${escapeHtml(step.name)}</b>
      <small>${escapeHtml(step.detail || '')}</small>
    </div>
  `).join('');
}

function renderComment() {
  const c = state.data?.comment || state.comment;
  if (!c) return;
  $('commentBox').innerHTML = `
    <div class="comment-title">${escapeHtml(c.title)}</div>
    <div class="row" style="margin-top: 12px">
      <span class="badge">${escapeHtml(c.columnName)}</span>
      <span class="badge orange">${escapeHtml(state.data?.source.kind || state.source?.source || '')}</span>
    </div>
    <div class="paragraphs">
      ${c.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      <p><b>风险提示：</b>${escapeHtml(c.riskWarning)}</p>
    </div>
  `;
}

function renderTopics() {
  $('topicList').innerHTML = state.data.topics.map(topic => `
    <article class="topic ${topic.id === state.selectedTopicId ? 'active' : ''}" data-id="${topic.id}">
      <div class="row">
        <span class="badge">${escapeHtml(topic.angle)}</span>
        <span class="badge ${topic.riskLevel === 'high' ? 'red' : topic.riskLevel === 'medium' ? 'orange' : 'green'}">${topic.score} 分</span>
      </div>
      <h3>${escapeHtml(topic.title)}</h3>
      <p>${escapeHtml(topic.summary)}</p>
      <p><b>关键词：</b>${topic.keywords.map(escapeHtml).join('、')}</p>
    </article>
  `).join('');
  document.querySelectorAll('.topic').forEach(node => {
    node.addEventListener('click', () => {
      state.selectedTopicId = node.dataset.id;
      renderTopics();
      renderMaterials();
    });
  });
}

function renderMaterials() {
  const topic = selectedTopic();
  if (!topic) return;
  $('articleBox').innerHTML = `<pre>${escapeHtml(topic.article)}</pre>`;
  $('bannerBox').innerHTML = `
    <span class="badge orange">${escapeHtml(topic.banner.riskTag)}</span>
    <h3>${escapeHtml(topic.banner.title)}</h3>
    <p>${escapeHtml(topic.banner.subtitle)}</p>
    <p>${escapeHtml(topic.banner.buttonText)} →</p>
  `;
  $('halfBox').innerHTML = `
    <span class="badge">半屏弹窗</span>
    <h3>${escapeHtml(topic.halfScreenTitle)}</h3>
    <p>${escapeHtml(topic.summary)}</p>
    <p>${escapeHtml(topic.riskWarning)}</p>
  `;
  $('assetBox').innerHTML = `
    <h3>相关资产线索</h3>
    ${topic.relatedAssets.length ? topic.relatedAssets.map(asset => `
      <div class="asset">
        <b>${escapeHtml(asset.name)}</b>
        <p>${escapeHtml(asset.code)} · ${escapeHtml(asset.type)} · ${escapeHtml(asset.direction)} · 风险${escapeHtml(asset.risk)}</p>
      </div>
    `).join('') : '<p>暂无明确资产映射</p>'}
  `;
}

function selectedTopic() {
  return state.data?.topics.find(t => t.id === state.selectedTopicId) || state.data?.topics[0];
}

function uniqueAssets(topics) {
  const set = new Set();
  topics.flatMap(t => t.relatedAssets).forEach(a => set.add(a.code));
  return [...set];
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `请求失败：${res.status}`);
  return json;
}

function initialPipelineSteps() {
  return [
    { id: 'fetch', name: '券商评论接口', status: 'pending', detail: '等待开始' },
    { id: 'parse', name: 'HTML 清洗与结构解析', status: 'pending', detail: '等待券商评论' },
    { id: 'llm', name: 'LLM 提取热点与资产线索', status: 'pending', detail: '等待结构化正文' },
    { id: 'generate', name: 'LLM 生成文章和 Banner', status: 'pending', detail: '等待热点结果' },
  ];
}

function setStepStatus(id, status, detail) {
  state.pipelineSteps = state.pipelineSteps.map(step => (
    step.id === id ? { ...step, status, detail } : step
  ));
}

function markCurrentStepError(message) {
  const running = state.pipelineSteps.find(step => step.status === 'running');
  const target = running || state.pipelineSteps.find(step => step.status === 'pending');
  if (target) setStepStatus(target.id, 'error', message || '链路失败');
}

function clearResultPanels() {
  $('topicCount').textContent = '--';
  $('assetCount').textContent = '--';
  $('generator').textContent = 'LLM';
  $('commentBox').innerHTML = '<div class="empty">等待券商评论解析...</div>';
  $('topicList').innerHTML = '<div class="empty">等待 LLM 生成热点...</div>';
  $('articleBox').innerHTML = '<div class="empty">等待热点文章...</div>';
  $('bannerBox').innerHTML = '';
  $('halfBox').innerHTML = '';
  $('assetBox').innerHTML = '';
  $('rawJson').textContent = '';
}

function renderError(message) {
  const safe = escapeHtml(message || '链路失败');
  $('topicList').innerHTML = `<div class="error-box"><b>生成失败</b><p>${safe}</p></div>`;
  $('articleBox').innerHTML = `<div class="error-box"><b>失败原因</b><p>${safe}</p></div>`;
  $('rawJson').textContent = JSON.stringify({ ok: false, error: message }, null, 2);
}

function setRunDisabled(disabled) {
  $('runBtn').disabled = disabled;
  $('runBtn').textContent = disabled ? '运行中...' : '运行全链路';
}

let timer;
function toast(message) {
  clearTimeout(timer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  timer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}
