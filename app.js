const API_ENDPOINT = '/api/analyze';
const STORAGE_KEY = 'truthcheck-ai-history-v1';
const EXAMPLE = 'FICTIONAL TEST CLAIM: Every college student will receive a free laptop and ₹50,000 from the government next month.';

const $ = (id) => document.getElementById(id);
const newsText = $('newsText');
const sourceUrl = $('sourceUrl');
const analyzeBtn = $('analyzeBtn');
const clearBtn = $('clearBtn');
const exampleBtn = $('exampleBtn');
const errorBox = $('errorBox');
const emptyState = $('emptyState');
const loadingState = $('loadingState');
const resultState = $('resultState');

newsText.addEventListener('input', () => { $('charCount').textContent = `${newsText.value.length.toLocaleString()} / 5,000`; hideError(); });
exampleBtn.addEventListener('click', () => { newsText.value = EXAMPLE; sourceUrl.value = ''; newsText.dispatchEvent(new Event('input')); newsText.focus(); });
clearBtn.addEventListener('click', clearForm);
analyzeBtn.addEventListener('click', analyze);
$('deleteHistoryBtn').addEventListener('click', () => { localStorage.removeItem(STORAGE_KEY); renderHistory(); });
$('refreshNewsBtn').addEventListener('click', loadWorldNews);

function clearForm() { newsText.value = ''; sourceUrl.value = ''; newsText.dispatchEvent(new Event('input')); hideError(); resultState.hidden = true; loadingState.hidden = true; emptyState.hidden = false; }
function hideError() { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message) { errorBox.textContent = message; errorBox.hidden = false; }
function validUrl(value) { if (!value) return true; try { const u = new URL(value.startsWith('http') ? value : `https://${value}`); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.'); } catch { return false; } }
function normaliseUrl(value) { return value && !/^https?:\/\//i.test(value) ? `https://${value}` : value; }

async function analyze() {
  const text = newsText.value.trim();
  const url = sourceUrl.value.trim();
  if (!text) return showError('Add a news claim or article excerpt before analyzing.');
  if (text.length < 15) return showError('Please provide a little more context — at least 15 characters.');
  if (!validUrl(url)) return showError('That source URL does not look valid. Try including a domain such as example.com.');
  hideError(); setLoading(true);
  let result;
  try {
    // The production path: a deployed backend can answer the requested /api/analyze contract.
    const response = await fetch(API_ENDPOINT, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ newsText: text, sourceUrl: normaliseUrl(url) }), signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error('API unavailable');
    result = await response.json();
  } catch {
    // GitHub Pages is static, so this fallback keeps the prototype fully interactive without pretending web verification happened.
    await delay(850); result = demoAnalyze(text, url);
  }
  setLoading(false); renderResult(result, text, url); saveHistory(result, text, url);
}
function setLoading(isLoading) { analyzeBtn.disabled = isLoading; analyzeBtn.querySelector('span:first-child').textContent = isLoading ? 'Analyzing…' : 'Analyze news'; emptyState.hidden = isLoading; resultState.hidden = isLoading || !resultState.innerHTML; loadingState.hidden = !isLoading; }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function demoAnalyze(text, url) {
  const lower = text.toLowerCase();
  const isFictional = lower.includes('free laptop') || lower.includes('₹50,000');
  const hasUrgency = /urgent|share now|breaking|before it.s? too late|must see|guaranteed|shocking|secret/i.test(text);
  const hasAbsolute = /every|all|never|always|100%|guarantee/i.test(text);
  const trustedSource = /(^|\.)((reuters|bbc|apnews|who|un|nasa|gov|edu)\.[a-z.]+)$/i.test((url || '').replace(/^https?:\/\//, '').split('/')[0]);
  const factualSignals = /announced|reported|published|data shows|according to|confirmed by|study found|official statistics/i.test(lower);
  const likelyReal = !isFictional && !hasUrgency && !hasAbsolute && (trustedSource || factualSignals) && text.length >= 45;
  const verdict = likelyReal ? 'LIKELY_REAL' : 'NEEDS_VERIFICATION';
  const signals = [];
  if (hasUrgency) signals.push('Urgency or emotionally loaded framing');
  if (hasAbsolute) signals.push('Absolute language without a clear qualification');
  if (!url) signals.push('No source URL supplied for attribution review');
  if (!signals.length) signals.push('Claim needs corroboration from independent sources');
  const claim = text.length > 150 ? `${text.slice(0,147)}…` : text;
  return { verdict, confidence: likelyReal ? 86 : isFictional ? 78 : 61, riskLevel: likelyReal ? 'LOW' : isFictional || hasUrgency ? 'MEDIUM' : 'LOW', claims: [claim], riskSignals: likelyReal ? ['No major sensational or absolute-language signals detected'] : signals, sourceAnalysis: url ? `The supplied source (${new URL(normaliseUrl(url)).hostname}) was noted. The demo recognizes a source/context signal, but cannot verify its publication history or supporting evidence.` : 'No source was supplied. Attribution and publication context could not be assessed.', evidenceSummary: likelyReal ? 'The wording and supplied context are consistent with a factual report, but this frontend cannot independently verify the event.' : 'Insufficient evidence for verification. This frontend demo does not access live reporting, databases, or primary documents.', explanation: likelyReal ? 'This claim looks like a conventional factual report and includes context signals. “Likely Real” is an indicator, not proof; open the original source and compare independent reporting.' : 'The claim contains signals that warrant a slower read, but language patterns alone do not prove a story is false. Compare the claim with reliable, independently reported evidence before sharing.', verificationSteps: ['Open the original publisher and check the publication date.', 'Search for the same claim in two reputable, independent outlets.', 'Look for an original statement, official document, or named expert.'] };
}

function renderResult(data, text, url) {
  const verdict = String(data.verdict || 'NEEDS_VERIFICATION').toUpperCase();
  const type = verdict === 'LIKELY_REAL' ? 'real' : verdict === 'LIKELY_FAKE' ? 'fake' : 'needs';
  const label = type === 'real' ? 'Likely Real' : type === 'fake' ? 'Likely Fake' : 'Needs Verification';
  const confidence = Number(data.confidence) || 0;
  resultState.innerHTML = `<div class="result-top"><div><div class="result-kicker">CREDIBILITY READOUT</div><div class="verdict ${type}"><span class="verdict-dot"></span>${escapeHtml(label)}</div></div><div class="confidence"><strong>${confidence}%</strong><small>confidence indicator</small></div></div><p class="result-summary">${escapeHtml(data.explanation || 'This result is an indicator only. Review the details below before drawing a conclusion.')}</p><div class="result-meta"><span class="meta-tag warning">${escapeHtml(data.riskLevel || 'MEDIUM')} RISK</span><span class="meta-tag">${url ? 'SOURCE PROVIDED' : 'NO SOURCE URL'}</span><span class="meta-tag">DEMO ANALYSIS</span></div><div class="result-block"><h3>CLAIMS DETECTED</h3><div class="claim-list">${(data.claims || [text]).map(c => `<div class="claim">${escapeHtml(c)}</div>`).join('')}</div></div><div class="result-block"><h3>SUSPICIOUS SIGNALS</h3><ul>${(data.riskSignals || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div><div class="result-block"><h3>SOURCE ANALYSIS</h3><p>${escapeHtml(data.sourceAnalysis || 'No source context available.')}</p></div><div class="result-block"><h3>EVIDENCE SUMMARY</h3><p>${escapeHtml(data.evidenceSummary || 'Insufficient evidence for verification.')}</p></div><div class="result-block"><h3>VERIFICATION RECOMMENDATIONS</h3><ul>${(data.verificationSteps || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div><div class="result-actions"><button class="text-button" id="analyzeAgain">↻ Analyze another claim</button><span class="timestamp">${new Date().toLocaleString([], {dateStyle:'medium', timeStyle:'short'})}</span></div>`;
  emptyState.hidden = true; loadingState.hidden = true; resultState.hidden = false; $('analyzeAgain').addEventListener('click', () => { newsText.focus(); window.scrollTo({top:document.getElementById('analyzer').offsetTop - 20, behavior:'smooth'}); });
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function getHistory() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveHistory(result, text, url) { const item = { id: Date.now(), text: text.slice(0, 180), verdict: result.verdict, confidence: result.confidence, url, timestamp: new Date().toISOString() }; localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...getHistory()].slice(0, 8))); renderHistory(); }
function renderHistory() { const list = $('historyList'); const history = getHistory(); if (!history.length) { list.innerHTML = '<div class="history-empty">No analyses yet. Your recent checks will be saved locally on this device.</div>'; return; } list.innerHTML = history.map(item => { const type = item.verdict === 'LIKELY_REAL' ? 'real' : item.verdict === 'LIKELY_FAKE' ? 'fake' : ''; const label = item.verdict === 'LIKELY_REAL' ? 'Likely real' : item.verdict === 'LIKELY_FAKE' ? 'Likely fake' : 'Needs verification'; return `<div class="history-item"><div class="history-claim">${escapeHtml(item.text)}</div><div class="history-time">${new Date(item.timestamp).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})} · ${item.confidence}%</div><span class="history-verdict ${type}">${label}</span><button class="history-delete" data-id="${item.id}" aria-label="Delete analysis">×</button></div>`; }).join(''); document.querySelectorAll('.history-delete').forEach(btn => btn.addEventListener('click', () => { const next = getHistory().filter(item => String(item.id) !== btn.dataset.id); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); renderHistory(); })); }

const fallbackNews = [
  { tag: 'GLOBAL', title: 'Compare this headline with the original publisher before sharing', source: 'TruthCheck editorial board', time: 'Demo card', color: 'blue' },
  { tag: 'EXPLAINER', title: 'Look for dates, named sources, primary documents, and independent coverage', source: 'Verification guide', time: 'Read first', color: 'purple' },
  { tag: 'CHECKLIST', title: 'A calm headline is not automatically true — context still matters', source: 'TruthCheck editorial board', time: 'Demo card', color: 'gold' }
];
function renderNews(items, live = false) {
  $('worldNewsGrid').innerHTML = items.slice(0, 6).map(item => `<article class="news-card"><div class="news-card-top"><span class="news-tag ${item.color || 'blue'}">${escapeHtml(item.tag || 'WORLD')}</span><span class="news-time">${escapeHtml(item.time || 'Today')}</span></div><h3>${escapeHtml(item.title)}</h3><div class="news-source"><span>${escapeHtml(item.source || 'World news')}</span>${live && item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Open source ↗</a>` : '<span>Context board</span>'}</div></article>`).join('');
}
async function loadWorldNews() {
  const button = $('refreshNewsBtn'); button.textContent = '↻ Loading…';
  try {
    const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffeeds.bbci.co.uk%2Fnews%2Fworld%2Frss.xml', { signal: AbortSignal.timeout(3500) });
    const data = await response.json();
    if (!data.items?.length) throw new Error('No feed');
    renderNews(data.items.map(item => ({ tag: 'WORLD', title: item.title, source: 'BBC News', time: new Date(item.pubDate).toLocaleDateString([], {month:'short', day:'numeric'}), link: item.link, color: 'blue' })), true);
  } catch { renderNews(fallbackNews); }
  button.textContent = '↻ Refresh feed';
}
renderHistory();
loadWorldNews();
