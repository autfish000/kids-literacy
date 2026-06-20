// ==================== 小马识字乐园 · 原生小程序 ====================

const WORDS_PER_GROUP = 5
const STORAGE_KEY = 'pony-literacy-v3'
const REVIEW_INTERVALS = [1, 3, 7, 14, 30]
const SWIPE_THRESHOLD = 80

// 加载字库
const WORD_LIBRARY = require('../../utils/words.js')

Page({
  data: {
    currentWord: {},
    cizuText: '',
    groupIndex: 0,
    currentQueue: [],
    currentIdx: 0,
    progressPercent: 0,
    boundaryDir: '',
    cardTransform: '',
    cardStyle: '',
  },

  // 内部状态（不参与渲染）
  _state: null,
  _dragging: false,
  _startX: 0,

  onLoad() {
    this._state = this._loadState()
    this._state.groupIndex = this._state.groupIndex || 0
    const queue = this._buildQueue(this._state.groupIndex)
    this.setData({
      groupIndex: this._state.groupIndex,
      currentQueue: queue,
      currentIdx: 0,
    })
    this._renderCurrent()
  },

  // ==================== 状态管理 ====================

  _defaultState() {
    return { groupIndex: 0, words: {}, lastStudyDate: null, streak: 0, history: [] }
  },

  _loadState() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY)
      if (!raw) return this._defaultState()
      return Object.assign(this._defaultState(), raw)
    } catch (e) {
      return this._defaultState()
    }
  },

  _saveState() {
    wx.setStorageSync(STORAGE_KEY, this._state)
  },

  // ==================== 词库与队列 ====================

  _buildQueue(groupIdx) {
    const queue = []
    const toReview = []

    // 取出需要复习的字
    for (const char in this._state.words) {
      const info = this._state.words[char]
      if (info.level >= REVIEW_INTERVALS.length) continue
      const days = (Date.now() - new Date(info.lastShown)) / 86400000
      const interval = REVIEW_INTERVALS[Math.min(info.level, REVIEW_INTERVALS.length - 1)]
      if (Math.floor(days) >= interval) toReview.push(char)
    }

    // 混入复习字（最多2个）
    toReview.sort(() => Math.random() - 0.5).slice(0, 2).forEach(char => {
      const w = WORD_LIBRARY.find(w => w.char === char)
      if (w) queue.push({ ...w, isReview: true })
    })

    // 补充新字
    const need = WORDS_PER_GROUP - queue.length
    const baseStart = groupIdx * WORDS_PER_GROUP
    for (let i = 0; i < need; i++) {
      const idx = baseStart + i
      if (idx >= WORD_LIBRARY.length) break
      const w = WORD_LIBRARY[idx]
      if (queue.some(q => q.char === w.char)) continue
      queue.push({ ...w, isReview: false })
    }
    return queue
  },

  // ==================== 渲染 ====================

  _renderCurrent() {
    const { currentQueue, currentIdx, groupIndex } = this.data
    if (!currentQueue.length) return

    const word = currentQueue[currentIdx]
    if (!word) return

    // 处理组词
    const raw = (word.example || '').replace(/^组词[：:]?\s*/, '').trim()
    const parts = raw.split(/[、,，]/).map(s => s.trim()).filter(s => s)
    const cizuText = parts.length >= 1 ? parts.slice(0, 3).join('  ') : word.char

    const done = currentIdx + 1
    const total = Math.max(currentQueue.length, 1)
    const progressPercent = Math.round((done / total) * 100)

    this.setData({
      currentWord: { char: word.char || '', pinyin: word.pinyin || '' },
      cizuText,
      progressPercent,
      boundaryDir: '',
      cardTransform: '',
    })
  },

  _updateProgress() {
    const { currentQueue, currentIdx, groupIndex } = this.data
    const done = currentIdx + 1
    const total = Math.max(currentQueue.length, 1)
    this.setData({ progressPercent: Math.round((done / total) * 100) })
  },

  // ==================== 单词记录 ====================

  _markWordShown(word) {
    const info = this._state.words[word.char] || { level: 0, lastShown: null, timesShown: 0 }
    info.timesShown = (info.timesShown || 0) + 1
    info.level = Math.min(REVIEW_INTERVALS.length, (info.level || 0) + 1)
    const today = new Date().toISOString().slice(0, 10)
    info.lastShown = today

    const last = this._state.history[this._state.history.length - 1]
    if (last && last.date === today) {
      if (!last.words.includes(word.char)) last.words.push(word.char)
    } else {
      this._state.history.push({ date: today, words: [word.char] })
    }
    this._state.lastStudyDate = today
    this._saveState()
  },

  // ==================== 前进 / 后退 ====================

  _handleNextWord() {
    const { currentQueue, currentIdx } = this.data
    const word = currentQueue[currentIdx]
    if (word) this._markWordShown(word)

    const nextIdx = currentIdx + 1
    if (nextIdx >= currentQueue.length) {
      this.setData({ boundaryDir: 'next', progressPercent: 100 })
    } else {
      this.setData({ currentIdx: nextIdx }, () => this._renderCurrent())
    }
  },

  _handlePrevWord() {
    const { currentIdx } = this.data
    if (currentIdx === 0) {
      this.setData({ boundaryDir: 'prev' })
      return
    }
    this.setData({ currentIdx: currentIdx - 1 }, () => this._renderCurrent())
  },

  _goNextGroup() {
    const { groupIndex } = this.data
    if (groupIndex * WORDS_PER_GROUP >= WORD_LIBRARY.length) return
    const nextGroup = groupIndex + 1
    const queue = this._buildQueue(nextGroup)
    this._state.groupIndex = nextGroup
    this._saveState()
    this.setData({ groupIndex: nextGroup, currentQueue: queue, currentIdx: 0 }, () => this._renderCurrent())
  },

  _goPrevGroup() {
    const { groupIndex } = this.data
    if (groupIndex <= 0) {
      this.setData({ currentIdx: 0 }, () => this._renderCurrent())
      return
    }
    const prevGroup = groupIndex - 1
    const queue = this._buildQueue(prevGroup)
    this._state.groupIndex = prevGroup
    this._saveState()
    this.setData({ groupIndex: prevGroup, currentQueue: queue, currentIdx: 0 }, () => this._renderCurrent())
  },

  // ==================== 触摸事件 ====================

  onTouchStart(e) {
    this._dragging = true
    this._startX = e.touches[0].clientX
    this.setData({ cardTransform: '', cardStyle: 'transition:none;' })
  },

  onTouchMove(e) {
    if (!this._dragging) return
    const dx = e.touches[0].clientX - this._startX
    const rot = dx / 40

    // 实时更新卡片位置
    this.setData({
      cardTransform: `translateX(${dx}px) rotate(${rot}deg)`,
      cardStyle: 'transition:none;',
    })

    const { currentQueue, currentIdx, boundaryDir } = this.data
    const isLast = currentIdx >= currentQueue.length - 1
    const isFirst = currentIdx === 0

    if (isLast && dx < -SWIPE_THRESHOLD / 2 && boundaryDir !== 'next') {
      this.setData({ boundaryDir: 'next' })
    } else if (isFirst && dx > SWIPE_THRESHOLD / 2 && boundaryDir !== 'prev') {
      this.setData({ boundaryDir: 'prev' })
    } else if (boundaryDir && Math.abs(dx) < SWIPE_THRESHOLD / 2) {
      this.setData({ boundaryDir: '' })
      this._renderCurrent()
    }
  },

  onTouchEnd(e) {
    if (!this._dragging) return
    this._dragging = false

    // 从 cardTransform 中提取 dx
    const transform = this.data.cardTransform || ''
    const match = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(transform)
    const dx = match ? parseFloat(match[1]) : 0

    this.setData({ cardStyle: '' })

    if (dx < -SWIPE_THRESHOLD) {
      // 向左滑 → 下一个
      const { boundaryDir } = this.data
      this.setData({ cardTransform: `translateX(${dx * 2}px) rotate(${dx / 40}deg)`, cardStyle: 'transition: all 0.28s ease;' }, () => {
        setTimeout(() => {
          this.setData({ cardTransform: '' })
          if (boundaryDir === 'next') this._goNextGroup()
          else this._handleNextWord()
        }, 280)
      })
    } else if (dx > SWIPE_THRESHOLD) {
      // 向右滑 → 上一个
      const { boundaryDir } = this.data
      this.setData({ cardTransform: `translateX(${dx * 2}px) rotate(${dx / 40}deg)`, cardStyle: 'transition: all 0.28s ease;' }, () => {
        setTimeout(() => {
          this.setData({ cardTransform: '' })
          if (boundaryDir === 'prev') this._goPrevGroup()
          else this._handlePrevWord()
        }, 280)
      })
    } else {
      // 未超过阈值 → 归位
      this.setData({ cardTransform: '', boundaryDir: '' })
    }
  },
})
