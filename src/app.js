const state = {
  data: null,
  selectedTopicId: null,
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
  showLoading(true);
  try {
    const columnCode = $('columnSelect').value;
    const res = await fetch(`/api/analyze?columnCode=${encodeURIComponent(columnCode)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || '链路运行失败');
    state.data = json;
    state.selectedTopicId = json.topics[0]?.id || null;
    renderAll();
    toast(`链路完成：${json.topics.length} 个热点`);
  } catch (error) {
    toast(error.message);
  } finally {
    showLoading(false);
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
  $('pipeline').innerHTML = state.data.pipeline.steps.map(step => `
    <div class="step">
      <span class="badge green">done</span>
      <b>${escapeHtml(step.name)}</b>
      <small>${escapeHtml(step.detail || '')}</small>
    </div>
  `).join('');
}

function renderComment() {
  const c = state.data.comment;
  $('commentBox').innerHTML = `
    <div class="comment-title">${escapeHtml(c.title)}</div>
    <div class="row" style="margin-top: 12px">
      <span class="badge">${escapeHtml(c.columnName)}</span>
      <span class="badge orange">${escapeHtml(state.data.source.kind)}</span>
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

function showLoading(show) {
  $('loading').classList.toggle('show', show);
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
