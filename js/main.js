const REMOTE_BASE = {
  NCE1: 'https://raw.githubusercontent.com/ichochy/NCE/main/book1',
  NCE2: 'https://raw.githubusercontent.com/ichochy/NCE/main/book2'
};

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const STORAGE_KEYS = {
  BOOK: 'nce_selected_book',
  UNIT_INDEX: (book) => `nce_${book}_unit`,
  PLAY_TIME: (book, unit) => `nce_${book}_${unit}_time`,
  SPEED: 'nce_speed',
  MODE: 'nce_mode',
  TRANSLATION: 'nce_translation'
};

class LrcProcessor {
  static decode(raw) {
    const entries = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.+)/;

    for (const line of raw.split('\n')) {
      const match = line.match(regex);
      if (!match) continue;

      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10);
      const offset = match[3].length === 2 ? ms * 10 : ms;
      const timestamp = mins * 60 + secs + offset / 1000 - 0.5;

      const content = match[4].trim();
      const segments = content.split('|').map((s) => s.trim());

      entries.push({
        time: Math.max(0, timestamp),
        en: segments[0] || '',
        cn: segments[1] || ''
      });
    }

    return entries.sort((a, b) => a.time - b.time);
  }
}

class AudioResolver {
  static async fetchWithFallback(localSrc, remoteSrc) {
    try {
      const resp = await fetch(localSrc, { method: 'HEAD' });
      if (resp.ok) return localSrc;
    } catch {
      // local not available
    }
    return remoteSrc;
  }

  static buildLocal(bookKey, filename, ext) {
    return `./audio/${bookKey}/${filename}.${ext}`;
  }

  static buildRemote(bookKey, filename, ext) {
    return `${REMOTE_BASE[bookKey]}/${filename}.${ext}`;
  }
}

class PlaybackEngine {
  constructor(audioEl) {
    this.audio = audioEl;
    this.mode = localStorage.getItem(STORAGE_KEYS.MODE) || 'single';
    this.speed = parseFloat(localStorage.getItem(STORAGE_KEYS.SPEED)) || 1.0;
    this.lineEndBoundary = null;

    this.audio.playbackRate = this.speed;
    this.audio.addEventListener('timeupdate', () => this._onTick());
    this.audio.addEventListener('ended', () => this._onFinish());
  }

  async load(localSrc, remoteSrc) {
    const resolved = await AudioResolver.fetchWithFallback(localSrc, remoteSrc);
    this.audio.src = resolved;
    this.audio.load();
    return new Promise((resolve, reject) => {
      this.audio.addEventListener('canplay', resolve, { once: true });
      this.audio.addEventListener('error', reject, { once: true });
    });
  }

  seekTo(seconds) {
    this.audio.currentTime = seconds;
  }

  play() {
    this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  toggle() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  setBoundary(endTime) {
    this.lineEndBoundary = endTime;
  }

  clearBoundary() {
    this.lineEndBoundary = null;
  }

  cycleSpeed() {
    const idx = SPEED_OPTIONS.indexOf(this.speed);
    this.speed = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    this.audio.playbackRate = this.speed;
    localStorage.setItem(STORAGE_KEYS.SPEED, this.speed);
    return this.speed;
  }

  toggleMode() {
    this.mode = this.mode === 'single' ? 'loop' : 'single';
    localStorage.setItem(STORAGE_KEYS.MODE, this.mode);
    return this.mode;
  }

  _onTick() {
    if (this.mode === 'single' && this.lineEndBoundary !== null) {
      if (this.audio.currentTime >= this.lineEndBoundary) {
        this.audio.pause();
        this.audio.currentTime = this.lineEndBoundary - 0.01;
        this.clearBoundary();
      }
    }
  }

  _onFinish() {
    if (this.mode === 'loop') {
      this._advanceCallback?.();
    }
  }

  set onAdvance(fn) {
    this._advanceCallback = fn;
  }

  get paused() {
    return this.audio.paused;
  }

  get currentTime() {
    return this.audio.currentTime;
  }

  get duration() {
    return this.audio.duration || 0;
  }

  get isReady() {
    return this.audio.readyState >= 2;
  }
}

class NceApp {
  constructor() {
    this.books = [];
    this.units = [];
    this.bookKey = '';
    this.unitIdx = -1;
    this.lyrics = [];
    this.activeLineIdx = -1;

    this.els = {
      bookSelector: document.getElementById('bookSelector'),
      unitGrid: document.getElementById('unitGrid'),
      playerDialog: document.getElementById('playerDialog'),
      closePlayerBtn: document.getElementById('closePlayerBtn'),
      playerTitle: document.getElementById('playerTitle'),
      prevUnitBtn: document.getElementById('prevUnitBtn'),
      nextUnitBtn: document.getElementById('nextUnitBtn'),
      lyricsContainer: document.getElementById('lyricsContainer'),
      playPauseBtn: document.getElementById('playPauseBtn'),
      progressTrack: document.getElementById('progressTrack'),
      progressFill: document.getElementById('progressFill'),
      progressThumb: document.getElementById('progressThumb'),
      currentTime: document.getElementById('currentTime'),
      duration: document.getElementById('duration'),
      speedBtn: document.getElementById('speedBtn'),
      speedLabel: document.getElementById('speedLabel'),
      modeBtn: document.getElementById('modeBtn'),
      translateBtn: document.getElementById('translateBtn'),
      audioEngine: document.getElementById('audioEngine')
    };

    this.engine = new PlaybackEngine(this.els.audioEngine);
    this.engine.onAdvance = () => this._playNextLine();

    this._lrcCache = new Map();
    this._translationState = localStorage.getItem(STORAGE_KEYS.TRANSLATION) || 'show';
    this._applyTranslationState();
    this._syncSpeedDisplay();
    this._syncModeDisplay();
  }

  async bootstrap() {
    await this._loadBooks();
    this._restoreBookSelection();
    this._bindEvents();
  }

  async _loadBooks() {
    try {
      const resp = await fetch('data.json');
      const data = await resp.json();
      this.books = data.books || [];
    } catch (err) {
      console.error('Failed to load book catalog:', err);
      this.books = [];
    }
  }

  _restoreBookSelection() {
    const stored = localStorage.getItem(STORAGE_KEYS.BOOK);
    const key = stored || this.books[0]?.key || '';
    if (key) this._switchBook(key);
  }

  _switchBook(key) {
    this.bookKey = key;
    localStorage.setItem(STORAGE_KEYS.BOOK, key);
    this.els.bookSelector.value = key;
    this._renderBookOptions();
    this._loadUnitList();
  }

  _renderBookOptions() {
    this.els.bookSelector.innerHTML = this.books
      .map((b) => `<option value="${b.key}">${b.title}</option>`)
      .join('');
    this.els.bookSelector.value = this.bookKey;
  }

  async _loadUnitList() {
    try {
      const resp = await fetch(`${REMOTE_BASE[this.bookKey]}/book.json`);
      const data = await resp.json();
      this.units = data.units || [];
      this._renderUnitGrid();
      this._restoreLastUnit();
    } catch (err) {
      console.error('Failed to load units:', err);
      this.units = [];
    }
  }

  _renderUnitGrid() {
    this.els.unitGrid.innerHTML = this.units
      .map((u, i) => `
        <article class="unit-card" data-index="${i}" tabindex="0" role="button" aria-label="${u.title}">
          <span class="unit-number">${String(i + 1).padStart(2, '0')}</span>
          <span class="unit-name">${u.title}</span>
        </article>
      `)
      .join('');
  }

  _restoreLastUnit() {
    const saved = localStorage.getItem(STORAGE_KEYS.UNIT_INDEX(this.bookKey));
    const idx = saved ? parseInt(saved, 10) : 0;
    const safe = Math.min(Math.max(0, idx), this.units.length - 1);
    if (this.units.length > 0) {
      this._openUnit(safe);
    }
  }

  async _openUnit(index) {
    this.unitIdx = index;
    this.activeLineIdx = -1;
    localStorage.setItem(STORAGE_KEYS.UNIT_INDEX(this.bookKey), index);

    const unit = this.units[index];
    this.els.playerTitle.textContent = unit.title;
    this._updateNavButtons();
    this._highlightCard(index);

    this._resetPlayer();

    const localLrc = AudioResolver.buildLocal(this.bookKey, unit.filename, 'lrc');
    const remoteLrc = AudioResolver.buildRemote(this.bookKey, unit.filename, 'lrc');

    let lrcText = this._lrcCache.get(localLrc);
    if (!lrcText) {
      try {
        const resp = await fetch(localLrc);
        if (!resp.ok) throw new Error('Not found');
        lrcText = await resp.text();
      } catch {
        const resp = await fetch(remoteLrc);
        lrcText = await resp.text();
      }
      this._lrcCache.set(localLrc, lrcText);
    }

    this.lyrics = LrcProcessor.decode(lrcText);
    this._renderLyrics();

    const localAudio = AudioResolver.buildLocal(this.bookKey, unit.filename, 'mp3');
    const remoteAudio = AudioResolver.buildRemote(this.bookKey, unit.filename, 'mp3');

    try {
      await this.engine.load(localAudio, remoteAudio);
    } catch {
      console.warn('Audio load failed');
    }

    this._restorePlayTime();
    this._prefetchNeighbor(index + 1);
    this._showPlayer();
  }

  _resetPlayer() {
    this.engine.pause();
    this.engine.seekTo(0);
    this.engine.clearBoundary();
    this._updatePlayButton();
    this._updateProgress(0);
  }

  _restorePlayTime() {
    const key = STORAGE_KEYS.PLAY_TIME(this.bookKey, this.unitIdx);
    const saved = localStorage.getItem(key);
    if (saved) {
      const t = parseFloat(saved);
      if (isFinite(t) && t > 0) {
        this.engine.seekTo(Math.min(t, this.engine.duration - 0.1));
      }
    }
  }

  _renderLyrics() {
    if (this.lyrics.length === 0) {
      this.els.lyricsContainer.innerHTML = '<p class="lyric-entry"><span class="lyric-en">No lyrics available</span></p>';
      return;
    }

    this.els.lyricsContainer.innerHTML = this.lyrics
      .map((line, i) => `
        <div class="lyric-entry" data-line="${i}" data-time="${line.time}">
          <div class="lyric-en">${line.en}</div>
          ${line.cn ? `<div class="lyric-cn">${line.cn}</div>` : ''}
        </div>
      `)
      .join('');

    this.els.lyricsContainer.scrollTop = 0;
  }

  _highlightCard(index) {
    this.els.unitGrid.querySelectorAll('.unit-card').forEach((card, i) => {
      card.classList.toggle('active', i === index);
    });
  }

  _updateNavButtons() {
    this.els.prevUnitBtn.disabled = this.unitIdx <= 0;
    this.els.nextUnitBtn.disabled = this.unitIdx >= this.units.length - 1;
  }

  _showPlayer() {
    this.els.playerDialog.showModal();
  }

  _hidePlayer() {
    this.els.playerDialog.close();
    this.engine.pause();
  }

  _playLine(index) {
    if (index < 0 || index >= this.lyrics.length) return;

    const line = this.lyrics[index];
    this.engine.seekTo(line.time);

    if (this.engine.mode === 'single') {
      const nextLine = this.lyrics[index + 1];
      this.engine.setBoundary(nextLine ? nextLine.time : this.engine.duration);
    } else {
      this.engine.clearBoundary();
    }

    this.engine.play();
    this._persistPlayTime(line.time);
  }

  _playNextLine() {
    const next = this.activeLineIdx + 1;
    if (next < this.lyrics.length) {
      this._playLine(next);
    }
  }

  _updateActiveLine() {
    if (this.lyrics.length === 0 || !this.engine.isReady) return;

    const now = this.engine.currentTime;
    let newIdx = -1;

    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      if (now >= this.lyrics[i].time) {
        newIdx = i;
        break;
      }
    }

    if (newIdx === this.activeLineIdx) return;

    this.activeLineIdx = newIdx;

    const entries = this.els.lyricsContainer.querySelectorAll('.lyric-entry');
    entries.forEach((el, i) => {
      el.classList.toggle('active', i === newIdx);
    });

    if (newIdx >= 0 && entries[newIdx]) {
      const container = this.els.lyricsContainer;
      const rect = container.getBoundingClientRect();
      const lineRect = entries[newIdx].getBoundingClientRect();
      const topLimit = rect.top + rect.height * 0.25;
      const bottomLimit = rect.bottom - rect.height * 0.25;

      if (lineRect.top < topLimit || lineRect.bottom > bottomLimit) {
        entries[newIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  _updateProgress() {
    if (this.engine.duration === 0) return;
    const pct = (this.engine.currentTime / this.engine.duration) * 100;
    this.els.progressFill.style.width = `${pct}%`;
    this.els.progressThumb.style.left = `${pct}%`;
    this.els.currentTime.textContent = this._formatTime(this.engine.currentTime);
  }

  _updateDuration() {
    this.els.duration.textContent = this._formatTime(this.engine.duration);
  }

  _updatePlayButton() {
    this.els.playPauseBtn.classList.toggle('playing', !this.engine.paused);
  }

  _syncSpeedDisplay() {
    this.els.speedLabel.textContent = `${this.engine.speed}x`;
  }

  _syncModeDisplay() {
    this.els.modeBtn.dataset.mode = this.engine.mode;
  }

  _applyTranslationState() {
    document.body.classList.remove('hide-cn', 'blur-cn');
    if (this._translationState === 'hide') {
      document.body.classList.add('hide-cn');
    } else if (this._translationState === 'blur') {
      document.body.classList.add('blur-cn');
    }
  }

  _persistPlayTime(time) {
    localStorage.setItem(STORAGE_KEYS.PLAY_TIME(this.bookKey, this.unitIdx), time);
  }

  _formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async _prefetchNeighbor(index) {
    const unit = this.units[index];
    if (!unit) return;

    const localLrc = AudioResolver.buildLocal(this.bookKey, unit.filename, 'lrc');
    if (!this._lrcCache.has(localLrc)) {
      fetch(localLrc)
        .then((r) => r.ok ? r.text() : Promise.reject())
        .then((t) => this._lrcCache.set(localLrc, t))
        .catch(() => {
          fetch(AudioResolver.buildRemote(this.bookKey, unit.filename, 'lrc'))
            .then((r) => r.text())
            .then((t) => this._lrcCache.set(localLrc, t))
            .catch(() => {});
        });
    }
  }

  _bindEvents() {
    this.els.bookSelector.addEventListener('change', (e) => {
      if (e.target.value) this._switchBook(e.target.value);
    });

    this.els.unitGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.unit-card');
      if (!card) return;
      this._openUnit(parseInt(card.dataset.index, 10));
    });

    this.els.unitGrid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('.unit-card');
      if (!card) return;
      e.preventDefault();
      this._openUnit(parseInt(card.dataset.index, 10));
    });

    this.els.closePlayerBtn.addEventListener('click', () => this._hidePlayer());

    this.els.playerDialog.addEventListener('click', (e) => {
      if (e.target === this.els.playerDialog) this._hidePlayer();
    });

    this.els.prevUnitBtn.addEventListener('click', () => {
      if (this.unitIdx > 0) this._openUnit(this.unitIdx - 1);
    });

    this.els.nextUnitBtn.addEventListener('click', () => {
      if (this.unitIdx < this.units.length - 1) this._openUnit(this.unitIdx + 1);
    });

    this.els.lyricsContainer.addEventListener('click', (e) => {
      const entry = e.target.closest('.lyric-entry');
      if (!entry) return;
      const idx = parseInt(entry.dataset.line, 10);
      const time = parseFloat(entry.dataset.time);
      this._playLine(idx);
      this._persistPlayTime(time);
    });

    this.els.playPauseBtn.addEventListener('click', () => {
      this.engine.toggle();
    });

    this.els.audioEngine.addEventListener('timeupdate', () => {
      this._updateActiveLine();
      this._updateProgress();
    });

    this.els.audioEngine.addEventListener('loadedmetadata', () => {
      this._updateDuration();
    });

    this.els.audioEngine.addEventListener('canplay', () => {
      this.els.playPauseBtn.disabled = false;
      this._updatePlayButton();
    });

    this.els.audioEngine.addEventListener('play', () => this._updatePlayButton());
    this.els.audioEngine.addEventListener('pause', () => {
      this.engine.clearBoundary();
      this._updatePlayButton();
    });

    this._setupProgressInteraction();

    this.els.speedBtn.addEventListener('click', () => {
      this.engine.cycleSpeed();
      this._syncSpeedDisplay();
    });

    this.els.modeBtn.addEventListener('click', () => {
      this.engine.toggleMode();
      this._syncModeDisplay();
    });

    this.els.translateBtn.addEventListener('click', () => {
      const states = ['show', 'hide', 'blur'];
      const cur = states.indexOf(this._translationState);
      this._translationState = states[(cur + 1) % states.length];
      localStorage.setItem(STORAGE_KEYS.TRANSLATION, this._translationState);
      this._applyTranslationState();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.els.playerDialog.open) {
        this._hidePlayer();
      }
    });
  }

  _setupProgressInteraction() {
    const track = this.els.progressTrack;

    const seek = (clientX) => {
      if (this.engine.duration === 0) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      this.engine.seekTo(pct * this.engine.duration);
    };

    track.addEventListener('click', (e) => seek(e.clientX));

    track.addEventListener('pointerdown', (e) => {
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
      seek(e.clientX);
    });

    track.addEventListener('pointermove', (e) => {
      if (!track.classList.contains('dragging')) return;
      seek(e.clientX);
    });

    track.addEventListener('pointerup', () => {
      track.classList.remove('dragging');
    });

    track.addEventListener('pointercancel', () => {
      track.classList.remove('dragging');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new NceApp();
  app.bootstrap();
});
