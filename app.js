// ==================== 小马识字乐园 · 核心逻辑 ====================

const WORDS_PER_GROUP = 5;
const STORAGE_KEY = 'pony-literacy-v3';
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];
const SWIPE_THRESHOLD = 80;

const PONY_QUOTES = [
  '真棒，继续加油！',
  '又认识一个字！',
  '你学得真快~',
  '这个字也认识啦！',
  '每天都在进步！',
  '你是识字小能手~',
];

function defaultState() {
  return { groupIndex: 0, words: {}, lastStudyDate: null, streak: 0, history: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { return defaultState(); }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function buildGroupQueue(groupIdx) {
  const queue = [];
  const toReview = [];
  for (const char in state.words) {
    const info = state.words[char];
    if (info.level >= REVIEW_INTERVALS.length) continue;
    const days = new Date() - new Date(info.lastShown);
    const interval = REVIEW_INTERVALS[Math.min(info.level, REVIEW_INTERVALS.length - 1)];
    if (Math.floor(days / 86400000) >= interval) toReview.push(char);
  }
  toReview.sort(() => Math.random() - 0.5).slice(0, 2).forEach(char => {
    const w = WORD_LIBRARY.find(w => w.char === char);
    if (w) queue.push({ ...w, isReview: true });
  });
  const need = WORDS_PER_GROUP - queue.length;
  const baseStart = groupIdx * WORDS_PER_GROUP;
  for (let i = 0; i < need; i++) {
    const idx = baseStart + i;
    if (idx >= WORD_LIBRARY.length) break;
    const w = WORD_LIBRARY[idx];
    if (queue.some(q => q.char === w.char)) continue;
    queue.push({ ...w, isReview: false });
  }
  return queue;
}

let state = loadState();
let currentQueue = buildGroupQueue(state.groupIndex);
let currentIdx = 0;

const el = {
  card: document.getElementById('card'),
  bgHint: document.getElementById('cardBgHint'),
  pinyinBox: document.getElementById('pinyinBox'),
  hanzi: document.getElementById('hanzi'),
  bihui: document.getElementById('bihui'),
  cizu: document.getElementById('cizu'),
  progressFill: document.getElementById('progressFill'),
  sessionProgress: document.getElementById('sessionProgress'),
  dayLabel: document.getElementById('dayLabel'),
  ponyQuotes: document.getElementById('ponyQuotes'),
};

function renderWordContent(word) {
  el.pinyinBox.textContent = word.pinyin || '';
  el.hanzi.textContent = word.char || '';

  let strokeText = (word.stroke && word.stroke.trim()) || '';
  if (!strokeText) {
    strokeText = `${word.char} · 按汉字顺序书写`;
  }
  el.bihui.textContent = strokeText;

  const cizuRaw = (word.example || '').replace(/^组词[：:]?\s*/, '').trim();
  const cizuParts = cizuRaw.split(/[、,，]/).map(s => s.trim()).filter(s => s);
  el.cizu.textContent = cizuParts.length >= 1 ? cizuParts.slice(0, 3).join('  ') : word.char;

  el.card.classList.remove('boundary-next', 'boundary-prev');
  if (el.bgHint) {
    el.bgHint.classList.remove('show-next', 'show-prev');
    el.bgHint.innerHTML = '';
  }
}

function renderBoundaryHint(kind) {
  if (!el.bgHint) return;
  if (kind === 'next') {
    el.bgHint.innerHTML = `
      <div class="bg-arrow">👉</div>
      <div class="bg-title">进入下一组</div>
      <div class="bg-sub">继续向左滑到底，开启全新的 5 个字</div>
    `;
    el.bgHint.classList.add('show-next');
    el.bgHint.classList.remove('show-prev');
  } else if (kind === 'prev') {
    el.bgHint.innerHTML = `
      <div class="bg-arrow">👈</div>
      <div class="bg-title">回到上一组</div>
      <div class="bg-sub">继续向右滑到底，再学一遍这 5 个字</div>
    `;
    el.bgHint.classList.add('show-prev');
    el.bgHint.classList.remove('show-next');
  }
}

function clearBoundaryHint() {
  if (el.bgHint) {
    el.bgHint.classList.remove('show-next', 'show-prev');
    el.bgHint.innerHTML = '';
  }
}

function renderCurrent() {
  clearBoundaryHint();
  if (!currentQueue.length) return;
  renderWordContent(currentQueue[currentIdx]);
  updateProgress();
  showRandomPonyQuote();
}

function animateFlyIn() {
  el.card.classList.add('fly-in');
  setTimeout(() => el.card.classList.remove('fly-in'), 450);
}

function updateProgress() {
  const done = currentIdx + 1;
  const total = Math.max(currentQueue.length, 1);
  el.progressFill.style.width = Math.round((done / total) * 100) + '%';
  el.sessionProgress.textContent = `${done} / ${total}`;
  el.dayLabel.textContent = `第 ${state.groupIndex + 1} 组`;
}

function showRandomPonyQuote() {
  el.ponyQuotes.textContent = PONY_QUOTES[Math.floor(Math.random() * PONY_QUOTES.length)];
}

function markWordShown(word) {
  const info = state.words[word.char] || { level: 0, lastShown: null, timesShown: 0 };
  info.timesShown = (info.timesShown || 0) + 1;
  info.level = Math.min(REVIEW_INTERVALS.length, (info.level || 0) + 1);
  info.lastShown = new Date().toISOString().slice(0, 10);
  state.words[word.char] = info;

  const today = info.lastShown;
  const last = state.history[state.history.length - 1];
  if (last && last.date === today) {
    if (!last.words.includes(word.char)) last.words.push(word.char);
  } else {
    state.history.push({ date: today, words: [word.char] });
  }
  state.lastStudyDate = today;
  saveState();
}

function handleNextWord() {
  const w = currentQueue[currentIdx];
  if (w) markWordShown(w);
  currentIdx++;
  if (currentIdx >= currentQueue.length) {
    renderBoundaryHint('next');
    el.sessionProgress.textContent = `${currentQueue.length} / ${currentQueue.length}`;
    el.progressFill.style.width = '100%';
  } else {
    renderCurrent();
    animateFlyIn();
  }
}

function handlePrevWord() {
  if (currentIdx === 0) { renderBoundaryHint('prev'); return; }
  currentIdx--;
  renderCurrent();
  animateFlyIn();
}

function goNextGroup() {
  if (state.groupIndex * WORDS_PER_GROUP >= WORD_LIBRARY.length) return;
  state.groupIndex += 1;
  currentQueue = buildGroupQueue(state.groupIndex);
  currentIdx = 0;
  saveState();
  renderCurrent();
  animateFlyIn();
}

function goPrevGroup() {
  if (state.groupIndex <= 0) { currentIdx = 0; renderCurrent(); animateFlyIn(); return; }
  state.groupIndex -= 1;
  currentQueue = buildGroupQueue(state.groupIndex);
  currentIdx = 0;
  saveState();
  renderCurrent();
  animateFlyIn();
}

let dragging = false;
let pointerStartX = 0;
let boundaryShown = null;

function onPointerDown(e) {
  dragging = true;
  const p = e.touches ? e.touches[0] : e;
  pointerStartX = p.clientX;
  boundaryShown = null;
  el.card.style.transition = 'none';
}

function onPointerMove(e) {
  if (!dragging) return;
  const p = e.touches ? e.touches[0] : e;
  const dx = p.clientX - pointerStartX;
  const rot = dx / 40;
  el.card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  if (e.cancelable && Math.abs(dx) > 4) e.preventDefault();

  const isLast = currentIdx >= currentQueue.length - 1;
  const isFirst = currentIdx === 0;

  if (isLast && dx < -SWIPE_THRESHOLD / 2 && boundaryShown !== 'next') {
    renderBoundaryHint('next');
    boundaryShown = 'next';
  } else if (isFirst && dx > SWIPE_THRESHOLD / 2 && boundaryShown !== 'prev') {
    renderBoundaryHint('prev');
    boundaryShown = 'prev';
  } else if (boundaryShown === 'next' && dx > -SWIPE_THRESHOLD / 2) {
    renderWordContent(currentQueue[currentIdx]);
    boundaryShown = null;
  } else if (boundaryShown === 'prev' && dx < SWIPE_THRESHOLD / 2) {
    renderWordContent(currentQueue[currentIdx]);
    boundaryShown = null;
  }
}

function onPointerUp() {
  if (!dragging) return;
  dragging = false;
  el.card.style.transition = '';

  const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.card.style.transform || '');
  const dx = m ? parseFloat(m[1]) : 0;

  if (dx < -SWIPE_THRESHOLD) {
    el.card.classList.add('swipe-left');
    setTimeout(() => {
      el.card.style.transform = '';
      el.card.classList.remove('swipe-left');
      if (boundaryShown === 'next') goNextGroup();
      else handleNextWord();
    }, 280);
  } else if (dx > SWIPE_THRESHOLD) {
    el.card.classList.add('swipe-right');
    setTimeout(() => {
      el.card.style.transform = '';
      el.card.classList.remove('swipe-right');
      if (boundaryShown === 'prev') goPrevGroup();
      else handlePrevWord();
    }, 280);
  } else {
    el.card.style.transform = '';
    if (boundaryShown) renderCurrent();
  }
}

el.card.addEventListener('touchstart', onPointerDown, { passive: false });
el.card.addEventListener('touchmove', onPointerMove, { passive: false });
el.card.addEventListener('touchend', onPointerUp);
el.card.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', (e) => { if (!dragging) return; onPointerMove(e); });
window.addEventListener('mouseup', onPointerUp);

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { if (currentIdx >= currentQueue.length - 1) goNextGroup(); else handleNextWord(); }
  else if (e.key === 'ArrowRight') { if (currentIdx === 0) goPrevGroup(); else handlePrevWord(); }
});

renderCurrent();
