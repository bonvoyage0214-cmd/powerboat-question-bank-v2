import './styles.css';

const CATEGORIES = ['海事法規', '避碰規則', '航海常識', '氣（海）象常識', '船機常識', '船藝與操船', '通訊與緊急措施'];
const LETTERS = ['A', 'B', 'C', 'D'];
const STORAGE_KEY = 'seawise-stats-v1';
const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const isSummaryDOption = (question) => {
  const dOption = String(question.options?.D || '').replace(/\s+/g, '');
  return /(以上|上述|前述).{0,8}(皆|均).{0,10}(是|對|正確|符合|可|非|錯誤)/.test(dOption);
};
const icon = (name, size = 18) => {
  const icons = {
    boat: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16.5 6.2 11h11.6l3.2 5.5c-3.5 1.6-5.6 1.6-8 0-2.4 1.6-4.5 1.6-8 0Z"/><path d="M9 11V5.5h6V11M12 5.5V3"/><path d="M3 19c2.4 1.8 4.5 1.8 7 0 2.4 1.8 4.6 1.8 7 0 1.4 1 2.7 1.4 4 1.3"/></svg>`,
    compass: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z"/><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2"/></svg>`,
    arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    back: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
    check: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`,
    info: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
    spark: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></svg>`,
  };
  return icons[name] || '';
};

const state = {
  screen: 'home',
  questions: [],
  quiz: [],
  currentIndex: 0,
  selected: null,
  answered: false,
  expandedDiagram: false,
  roundAnswers: {},
  shuffleEnabled: true,
  stats: loadStats(),
  lastResult: null,
};

function loadStats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveStats() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats)); }
function getStat(id) { return state.stats[id] || { correct: 0, wrong: 0 }; }
function totalAttempts(stat) { return stat.correct + stat.wrong; }
function accuracy(stat) { return totalAttempts(stat) ? stat.correct / totalAttempts(stat) : 0; }
function isMistake(question) {
  const stat = getStat(question.id);
  return stat.wrong > 0 && accuracy(stat) < 0.95;
}
function mistakeQuestions() { return state.questions.filter(isMistake); }
function weightedPick(items, count) {
  const pool = [...items];
  const result = [];
  while (pool.length && result.length < count) {
    const weights = pool.map((question) => {
      const stat = getStat(question.id);
      const missBoost = isMistake(question) ? 4 : 1;
      const learningBoost = stat.wrong && totalAttempts(stat) ? 1 + (stat.wrong / totalAttempts(stat)) * 2 : 1;
      return missBoost * learningBoost;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = Math.random() * total;
    let pickedIndex = 0;
    for (let i = 0; i < weights.length; i += 1) {
      cursor -= weights[i];
      if (cursor <= 0) { pickedIndex = i; break; }
    }
    result.push(pool.splice(pickedIndex, 1)[0]);
  }
  return result;
}
function buildQuiz() {
  const selected = [];
  CATEGORIES.forEach((category) => {
    const pool = state.questions.filter((question) => question.category === category);
    selected.push(...weightedPick(pool, 1));
  });
  const selectedIds = new Set(selected.map((question) => question.id));
  selected.push(...weightedPick(state.questions.filter((question) => !selectedIds.has(question.id)), 20 - selected.length));
  const ordered = state.shuffleEnabled ? shuffle(selected) : selected.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.number - b.number);
  return ordered.map((question) => {
    // Summary choices such as "以上皆是／皆非／皆正確" are conventionally the D choice.
    // Keep D at D while still randomising A-C; image choices stay fixed to preserve the source diagram.
    const optionKeys = state.shuffleEnabled && !question.imageOptions
      ? (isSummaryDOption(question) ? [...shuffle(LETTERS.slice(0, 3)), 'D'] : shuffle(LETTERS))
      : [...LETTERS];
    return { ...question, optionKeys };
  });
}
function render() {
  const app = document.querySelector('#app');
  app.innerHTML = `${header()}<main class="content">${state.screen === 'home' ? homeScreen() : state.screen === 'quiz' ? quizScreen() : state.screen === 'result' ? resultScreen() : mistakeScreen()}</main><footer class="footer-note">題庫來源：營業用動力小船題庫（111.09.01 修訂 1 版）<br>所有正確答案依原始題庫前置答案紀錄</footer>`;
  bindEvents();
}
function header() {
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="回到首頁"><span class="brand-mark">${icon('boat', 24)}</span><span><span class="brand-name">海航 20 題</span><span class="brand-subtitle">POWERBOAT LOGBOOK</span></span></button><span class="topbar-badge">通勤練習版</span></header>`;
}
function homeScreen() {
  const mistakes = mistakeQuestions().length;
  return `<section class="screen"><div class="hero"><div><p class="eyebrow">CAPTAIN'S DAILY DRILL</p><h1>每一題，都是<br>靠岸前的準備。</h1><p>七大類題庫、每回 20 題。用零碎時間熟悉營業用動力小船考試內容。</p></div><div class="compass" aria-hidden="true"><span class="compass-label">N</span><span class="east">E</span><span class="compass-needle"></span></div></div><div class="surface"><div class="quick-stats"><div class="stat"><div class="stat-label">題庫總量</div><div class="stat-value">${state.questions.length}<small> 題</small></div></div><div class="stat"><div class="stat-label">每回題數</div><div class="stat-value">20<small> 題</small></div></div><div class="stat"><div class="stat-label">易錯題</div><div class="stat-value">${mistakes}<small> 題</small></div></div></div><div class="section-title"><div><div class="section-kicker">READY TO CAST OFF</div><h2>開始今日練習</h2><p>七大類每回至少各出現 1 題</p></div></div><div class="setup"><div class="panel"><h3>本回合的航程</h3><p>每題 5 分，完成 20 題後會立即顯示百分制成績。易錯題會自動提高出現機率，答對率累積達 95% 後會解除標記。</p><div class="category-list">${CATEGORIES.map((category) => `<span class="category-chip"><i></i>${category}</span>`).join('')}</div></div><div class="panel"><h3>出題設定</h3><label class="toggle-row"><span class="toggle"><input id="shuffle-toggle" type="checkbox" ${state.shuffleEnabled ? 'checked' : ''}><span class="toggle-track"></span></span><span class="toggle-copy"><strong>打亂題庫順序</strong><span>打亂七大類題目順序，並重新排列 ABCD 選項位置。</span></span></label><div class="button-stack"><button class="primary-button" data-action="start">起航，開始 20 題 ${icon('arrow', 16)}</button><button class="secondary-button" data-action="mistakes">檢視易錯題 <span class="count">${mistakes}</span></button></div></div></div><div class="source-note">${icon('info', 17)}<span>題目、選項與正確答案完全依照原始題庫整理。圖示題會直接顯示單題裁切圖，保留原比例、原色彩與 A／B／C／D 標示。</span></div></div></section>`;
}
function quizScreen() {
  const question = state.quiz[state.currentIndex];
  if (!question) return '';
  const total = state.quiz.length;
  const stat = getStat(question.id);
  const progress = ((state.currentIndex + (state.answered ? 1 : 0)) / total) * 100;
  const correctDisplayLetter = LETTERS[question.optionKeys.indexOf(question.answer)];
  const options = question.optionKeys.map((sourceLetter, index) => {
    const displayLetter = LETTERS[index];
    const selectedClass = state.answered && displayLetter === correctDisplayLetter ? 'is-correct' : state.answered && displayLetter === state.selected ? 'is-wrong' : '';
    return `<button class="option ${selectedClass}" data-action="answer" data-letter="${displayLetter}" ${state.answered ? 'disabled' : ''}><span class="option-letter">${displayLetter}</span><span class="option-text">${escapeHTML(question.options[sourceLetter])}</span></button>`;
  }).join('');
  const answerBanner = state.answered ? `<div class="answer-banner ${state.roundAnswers[question.id] === question.answer ? 'ok' : 'no'}">${state.roundAnswers[question.id] === question.answer ? icon('check', 17) : icon('info', 17)}<span>${state.roundAnswers[question.id] === question.answer ? '答對了，保持航向！' : `本題題庫原始答案為（${question.answer}），請依原始答案記憶。`}</span></div>` : '';
  const diagramVisible = question.imageOptions || state.expandedDiagram;
  const diagram = question.diagramImage
    ? `<div class="diagram-wrap diagram-direct"><div class="image-option-note">${question.imageOptions ? '本題選項為原始圖示，A／B／C／D 標示與順序依原 PDF 保留。' : '原始 PDF 圖示（單題裁切）'}</div><img class="diagram-image" src="${question.diagramImage}" alt="題庫第 ${question.number} 題的原始圖示，保留原始比例與色彩" /></div>`
    : question.sourceImage
      ? `<div class="diagram-wrap">${question.imageOptions ? '<div class="image-option-note">本題選項為原始圖示，A／B／C／D 標示請以原始頁面為準。</div>' : ''}<button class="diagram-toggle" data-action="toggle-diagram">${icon('compass', 15)}${diagramVisible ? '收起原始頁面圖示' : `查看原始頁面圖示（第 ${question.sourcePage} 頁）`}</button>${diagramVisible ? `<img class="diagram-image" src="${question.sourceImage}" alt="題庫原始第 ${question.sourcePage} 頁，保留原始比例與色彩" />` : ''}</div>` : '';
  return `<section class="screen"><div class="quiz-shell"><div class="quiz-head"><button class="back-button" data-action="quit">${icon('back', 16)}離開本回合</button><span class="progress-copy">${state.currentIndex + 1} / ${total}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div><div class="quiz-meta"><span class="category-label">${escapeHTML(question.category)}</span><span class="question-source">題庫第 ${question.number} 題 · 每題 5 分</span></div><div class="question-card"><div class="question-number">QUESTION ${String(state.currentIndex + 1).padStart(2, '0')}</div><h2 class="question-text">${escapeHTML(question.question)}</h2>${diagram}<div class="options">${options}</div>${answerBanner}</div><div class="quiz-actions">${state.answered ? `<button class="next-button" data-action="next">${state.currentIndex === total - 1 ? '查看成績' : '下一題'} ${icon('arrow', 16)}</button>` : ''}</div></div></section>`;
}
function resultScreen() {
  const result = state.lastResult || { score: 0, correct: 0, wrong: 20 };
  const score = result.score;
  const title = score >= 90 ? '航向穩定，表現亮眼' : score >= 70 ? '掌舵不錯，再熟悉幾題' : '繼續練習，熟能生巧';
  return `<section class="screen"><div class="surface result-shell"><div class="result-hero"><div class="result-overline">VOYAGE COMPLETE</div><div class="score-ring" style="--score:${score}%"><div class="score-inner"><div class="score-number">${score}</div><div class="score-unit">/ 100 分</div></div></div><h2>${title}</h2><p>本回合 20 題，每題 5 分 · 易錯題已更新</p></div><div class="result-stats"><div class="result-stat"><strong>${result.correct}</strong><span>答對題數</span></div><div class="result-stat"><strong>${result.wrong}</strong><span>需要複習</span></div><div class="result-stat"><strong>${mistakeQuestions().length}</strong><span>目前易錯題</span></div></div><div class="result-actions"><button class="primary-button" data-action="start">再刷一回 ${icon('arrow', 16)}</button><button class="secondary-button" data-action="mistakes">檢視易錯題 <span class="count">${mistakeQuestions().length}</span></button><button class="secondary-button" data-action="home">回到首頁</button></div></div></section>`;
}
function mistakeScreen() {
  const mistakes = mistakeQuestions().sort((a, b) => accuracy(getStat(a.id)) - accuracy(getStat(b.id)));
  return `<section class="screen"><div class="surface"><div class="mistake-head"><div><div class="section-kicker">REVIEW THE ROUGH WATER</div><h2>易錯題</h2><p>答錯後會提高出現機率；累積正確率達 95% 即自動解除。</p></div><button class="back-button" data-action="home">${icon('back', 16)}回到首頁</button></div>${mistakes.length ? `<div class="mistake-grid">${mistakes.map((question) => { const stat = getStat(question.id); return `<article class="mistake-item"><div class="mistake-item-top"><strong>${escapeHTML(question.category)} · 題庫第 ${question.number} 題</strong><span class="rate">${Math.round(accuracy(stat) * 100)}% 正確</span></div><p>${escapeHTML(question.question)}</p><div class="mistake-item-foot"><span>作答 ${totalAttempts(stat)} 次</span><span>答錯 ${stat.wrong} 次</span><span>正解（${question.answer}）</span></div></article>`; }).join('')}</div>` : `<div class="empty-state"> <div class="empty-icon">${icon('spark', 26)}</div><h3>目前沒有易錯題</h3><p>先完成一回練習，答錯的題目會在這裡集中，方便通勤時回顧。</p></div>`}</div></section>`;
}
function bindEvents() {
  document.querySelectorAll('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action, element.dataset.letter)));
  const toggle = document.querySelector('#shuffle-toggle');
  if (toggle) toggle.addEventListener('change', (event) => { state.shuffleEnabled = event.target.checked; });
}
function handleAction(action, letter) {
  if (action === 'home') { state.screen = 'home'; state.selected = null; state.answered = false; render(); return; }
  if (action === 'start') { state.screen = 'quiz'; state.quiz = buildQuiz(); state.currentIndex = 0; state.selected = null; state.answered = false; state.expandedDiagram = false; state.roundAnswers = {}; render(); return; }
  if (action === 'mistakes') { state.screen = 'mistakes'; render(); return; }
  if (action === 'quit') { state.screen = 'home'; state.selected = null; state.answered = false; render(); return; }
  if (action === 'toggle-diagram') { state.expandedDiagram = !state.expandedDiagram; render(); return; }
  if (action === 'answer' && !state.answered) {
    state.selected = letter;
    state.answered = true;
    const question = state.quiz[state.currentIndex];
    const sourceLetter = question.optionKeys[LETTERS.indexOf(letter)];
    state.roundAnswers[question.id] = sourceLetter;
    const stat = getStat(question.id);
    if (sourceLetter === question.answer) stat.correct += 1; else stat.wrong += 1;
    state.stats[question.id] = stat;
    saveStats();
    render();
    return;
  }
  if (action === 'next' && state.answered) {
    if (state.currentIndex >= state.quiz.length - 1) {
      const correctThisRound = state.quiz.filter((question) => state.roundAnswers[question.id] === question.answer).length;
      state.lastResult = { correct: correctThisRound, wrong: state.quiz.length - correctThisRound, score: correctThisRound * 5 };
      state.screen = 'result';
    } else {
      state.currentIndex += 1;
      state.selected = null;
      state.answered = false;
      state.expandedDiagram = false;
    }
    render();
  }
}

async function init() {
  try {
    const response = await fetch('/data/questions.json');
    state.questions = await response.json();
  } catch (error) {
    state.questions = [];
    console.error('題庫讀取失敗', error);
  }
  render();
}

init();
