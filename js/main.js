/* 全局常量 */
const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const LS = { BOOK: 'nce_book', UNIT: k => `nce_${k}_u`, TIME: (k,u) => `nce_${k}_${u}_t`, SPD: 'nce_spd', MODE: 'nce_mode', TR: 'nce_tr' };

/* 歌词解析器 */
class Lrc {
  static parse(raw) {
    const list = [];
    for (const line of raw.split('\n')) {
      const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.+)/);
      if (!m) continue;
      const t = +m[1] * 60 + +m[2] + (m[3].length === 2 ? +m[3] * 10 : +m[3]) / 1000 - 0.5;
      const parts = m[4].trim().split('|').map(s => s.trim());
      list.push({ time: Math.max(0, t), en: parts[0], cn: parts[1] || '' });
    }
    return list.sort((a,b) => a.time - b.time);
  }
}

/* 主程序 */
class App {
  constructor() {
    this.books = [];
    this.units = [];
    this.key = '';
    this.path = '';
    this.idx = -1;
    this.lines = [];
    this.cur = -1;
    this.mode = localStorage.getItem(LS.MODE) || 'single';
    this.spd = +(localStorage.getItem(LS.SPD) || 1.0);
    this.tr = localStorage.getItem(LS.TR) || 'show';
    this.cache = new Map();
    
    this.els = {
      sel: document.getElementById('bookSelect'),
      grid: document.getElementById('unitGrid'),
      dlg: document.getElementById('playerDialog'),
      title: document.getElementById('unitTitle'),
      close: document.getElementById('closeBtn'),
      prev: document.getElementById('prevBtn'),
      next: document.getElementById('nextBtn'),
      expand: document.getElementById('expandBtn'),
      area: document.getElementById('lyricsArea'),
      play: document.getElementById('playBtn'),
      track: document.getElementById('progressTrack'),
      fill: document.getElementById('progressFill'),
      cur: document.getElementById('curTime'),
      dur: document.getElementById('durTime'),
      mode: document.getElementById('modeBtn'),
      modeL: document.getElementById('modeLabel'),
      spd: document.getElementById('speedBtn'),
      spdL: document.getElementById('speedLabel'),
      tr: document.getElementById('transBtn'),
      trL: document.getElementById('transLabel'),
      audio: document.getElementById('audio')
    };

    this.els.audio.playbackRate = this.spd;
    this.applyTr();
    this.syncUI();
  }

  async init() {
    await this.loadBooks();
    this.restoreBook();
    this.bind();
  }

  async loadBooks() {
    try {
      const d = await fetch('data.json').then(r => r.json());
      this.books = d.books || [];
    } catch (e) { this.books = []; }
  }

  restoreBook() {
    const k = localStorage.getItem(LS.BOOK) || this.books[0]?.key;
    if (k) this.switch(k);
  }

  switch(key) {
    this.key = key;
    this.path = (this.books.find(b => b.key === key) || {}).bookPath || '';
    localStorage.setItem(LS.BOOK, key);
    this.els.sel.value = key;
    this.loadUnits();
  }

  renderOptions() {
    this.els.sel.innerHTML = this.books.map(b => `<option value="${b.key}">${b.title}</option>`).join('');
    this.els.sel.value = this.key;
  }

  async loadUnits() {
    this.renderOptions();
    if (!this.path) return;
    try {
      const d = await fetch(`${this.path}/book.json`).then(r => r.json());
      this.units = d.units || [];
      this.grid();
      this.restoreUnit();
    } catch(e) { this.units = []; }
  }

  grid() {
    this.els.grid.innerHTML = this.units.map((u, i) => `
      <div class="card" data-i="${i}">
        <div class="card-num">${u.lesson_num || u.filename}</div>
        <div class="card-title">${u.title}</div>
      </div>`).join('');
  }

  restoreUnit() {
    const i = +(localStorage.getItem(LS.UNIT(this.key)) || 0);
    if (this.units.length > 0) {
      const safeIdx = Math.min(i, this.units.length-1);
      this.activeCard(safeIdx);
    }
  }

  async open(i) {
    this.idx = i;
    this.cur = -1;
    localStorage.setItem(LS.UNIT(this.key), i);
    
    const u = this.units[i];
    this.els.title.textContent = u.title;
    this.navBtns();
    this.activeCard(i);
    this.reset();
    
    // Load LRC
    const local = `./audio/${this.key}/${u.filename}.lrc`;
    let txt = this.cache.get(local);
    if (!txt) {
      try { txt = await fetch(local).then(r => r.text()); }
      catch { txt = await fetch(`${this.path}/${u.filename}.lrc`).then(r => r.text()); }
      this.cache.set(local, txt);
    }
    this.lines = Lrc.parse(txt);
    this.renderLines();
    
    // Load Audio
    const audio = this.els.audio;
    const audioSrc = `./audio/${this.key}/${u.filename}.mp3`;
    console.log('Loading audio:', audioSrc);
    audio.src = audioSrc;
    audio.load();
    
    // 等待音频加载完成后再显示弹窗
    audio.addEventListener('loadeddata', () => {
      console.log('Audio loaded, duration:', audio.duration);
      this.restoreTime();
      this.els.dlg.showModal();
    }, { once: true });
    
    audio.addEventListener('error', (e) => {
      console.error('Audio load error:', e);
      alert('音频加载失败，请检查网络连接');
    });
  }

  reset() {
    this.els.audio.pause();
    this.els.audio.currentTime = 0;
    this.els.fill.style.width = '0%';
    this.els.cur.textContent = '0:00';
    this.els.dur.textContent = '0:00';
    this.playIcon(false);
    this.bound = null;
  }

  restoreTime() {
    const t = +localStorage.getItem(LS.TIME(this.key, this.idx)) || 0;
    if (t > 0 && this.els.audio.duration) {
      this.els.audio.currentTime = Math.min(t, this.els.audio.duration - 0.1);
    }
  }

  renderLines() {
    if (!this.lines.length) { this.els.area.innerHTML = '<p class="line">无歌词数据</p>'; return; }
    this.els.area.innerHTML = this.lines.map((l, i) => `
      <div class="line" data-i="${i}" data-t="${l.time}">
        <div class="line-en">${l.en}</div>
        ${l.cn ? `<div class="line-cn">${l.cn}</div>` : ''}
      </div>`).join('');
    this.els.area.scrollTop = 0;
  }

  activeCard(i) {
    this.els.grid.querySelectorAll('.card').forEach((c, x) => c.classList.toggle('active', x === i));
  }

  navBtns() {
    this.els.prev.disabled = this.idx <= 0;
    this.els.next.disabled = this.idx >= this.units.length - 1;
  }

  playLine(i) {
    if (i < 0 || i >= this.lines.length) return;
    const line = this.lines[i];
    
    // 等待音频加载完成
    if (!this.els.audio.src || this.els.audio.readyState < 2) {
      console.log('Audio not ready, waiting...');
      this.els.audio.addEventListener('canplay', () => {
        console.log('Audio ready, playing line', i);
        this._doPlayLine(line, i);
      }, { once: true });
      return;
    }
    
    console.log('Audio ready, playing line', i);
    this._doPlayLine(line, i);
  }

  _doPlayLine(line, i) {
    this.els.audio.currentTime = line.time;
    this.cur = i;
    this.highlight();
    
    if (this.mode === 'single') {
      const nxt = this.lines[i + 1];
      this.bound = nxt ? nxt.time : this.els.audio.duration;
    } else { 
      this.bound = null; 
    }
    
    this.els.audio.play().catch(e => console.log('Play error:', e.message));
    this.saveTime(line.time);
  }

  playNext() {
    const n = this.cur + 1;
    if (n < this.lines.length) this.playLine(n);
  }

  highlight() {
    if (!this.lines.length) return;
    const now = this.els.audio.currentTime;
    let ni = -1;
    for (let i = this.lines.length - 1; i >= 0; i--) { if (now >= this.lines[i].time) { ni = i; break; } }
    if (ni === this.cur) return;
    this.cur = ni;
    this.els.area.querySelectorAll('.line').forEach((el, x) => el.classList.toggle('active', x === ni));
    if (ni >= 0) {
      const el = this.els.area.querySelectorAll('.line')[ni];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  updateProg() {
    if (!this.els.audio.duration) return;
    const p = (this.els.audio.currentTime / this.els.audio.duration) * 100;
    this.els.fill.style.width = `${p}%`;
    this.els.cur.textContent = this.fmt(this.els.audio.currentTime);
  }

  playIcon(isPlay) {
    this.els.play.querySelector('.ico-play').style.display = isPlay ? 'none' : 'block';
    this.els.play.querySelector('.ico-pause').style.display = isPlay ? 'block' : 'none';
  }

  syncUI() {
    this.els.spdL.textContent = `${this.spd}x`;
    this.modeLabel();
  }

  modeLabel() {
    this.els.modeL.textContent = this.mode === 'single' ? '单句' : '连播';
  }

  applyTr() {
    document.body.classList.remove('hide-cn', 'blur-cn');
    if (this.tr === 'hide') document.body.classList.add('hide-cn');
    else if (this.tr === 'blur') document.body.classList.add('blur-cn');
    this.els.trL.textContent = this.tr === 'show' ? '中文' : this.tr === 'hide' ? '隐藏' : '模糊';
  }

  saveTime(t) { localStorage.setItem(LS.TIME(this.key, this.idx), t); }
  
  fmt(s) { if (!isFinite(s)) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

  bind() {
    // Book select
    this.els.sel.addEventListener('change', e => { if (e.target.value) this.switch(e.target.value); });
    
    // Grid click
    this.els.grid.addEventListener('click', e => {
      const c = e.target.closest('.card');
      if (c) this.open(+c.dataset.i);
    });
    
    // Close
    this.els.close.addEventListener('click', () => { this.els.dlg.close(); this.els.audio.pause(); });
    
    // Nav
    this.els.prev.addEventListener('click', () => this.idx > 0 && this.open(this.idx - 1));
    this.els.next.addEventListener('click', () => this.idx < this.units.length - 1 && this.open(this.idx + 1));
    
    // Expand/Maximize Toggle
    if (this.els.expand) {
      this.els.expand.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const inner = this.els.dlg.querySelector('.dialog-inner');
        if (inner) {
          inner.classList.toggle('expanded');
          
          // Toggle icons
          const isExpanded = inner.classList.contains('expanded');
          const icoExp = this.els.expand.querySelector('.ico-expand');
          const icoShr = this.els.expand.querySelector('.ico-shrink');
          
          if (icoExp) icoExp.style.display = isExpanded ? 'none' : 'block';
          if (icoShr) icoShr.style.display = isExpanded ? 'block' : 'none';
          this.els.expand.setAttribute('aria-label', isExpanded ? '退出全屏' : '全屏模式');
        }
      });
    }
    
    // Line click
    this.els.area.addEventListener('click', e => {
      const l = e.target.closest('.line');
      if (l) this.playLine(+l.dataset.i);
    });
    
    // Play
    this.els.play.addEventListener('click', () => this.els.audio.paused ? this.els.audio.play() : this.els.audio.pause());
    
    // Audio events
    this.els.audio.addEventListener('timeupdate', () => {
      this.highlight();
      this.updateProg();
      if (this.mode === 'single' && this.bound && this.els.audio.currentTime >= this.bound) {
        this.els.audio.pause();
        this.els.audio.currentTime = this.bound - 0.01;
        this.bound = null;
      }
    });
    this.els.audio.addEventListener('loadedmetadata', () => { this.els.dur.textContent = this.fmt(this.els.audio.duration); });
    this.els.audio.addEventListener('play', () => this.playIcon(true));
    this.els.audio.addEventListener('pause', () => this.playIcon(false));
    this.els.audio.addEventListener('ended', () => { if (this.mode === 'loop') this.playNext(); });
    
    // Progress
    this.els.track.addEventListener('click', e => {
      if (!this.els.audio.duration) return;
      const r = this.els.track.getBoundingClientRect();
      this.els.audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * this.els.audio.duration;
    });
    
    // Mode
    this.els.mode.addEventListener('click', () => {
      this.mode = this.mode === 'single' ? 'loop' : 'single';
      localStorage.setItem(LS.MODE, this.mode);
      this.modeLabel();
    });
    
    // Speed
    this.els.spd.addEventListener('click', () => {
      const i = SPEEDS.indexOf(this.spd);
      this.spd = SPEEDS[(i + 1) % SPEEDS.length];
      this.els.audio.playbackRate = this.spd;
      localStorage.setItem(LS.SPD, this.spd);
      this.syncUI();
    });
    
    // Translation
    this.els.tr.addEventListener('click', () => {
      const m = ['show', 'hide', 'blur'];
      this.tr = m[(m.indexOf(this.tr) + 1) % m.length];
      localStorage.setItem(LS.TR, this.tr);
      this.applyTr();
    });
    
    // ESC
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.els.dlg.open) this.els.dlg.close(); });
  }
}

document.addEventListener('DOMContentLoaded', () => new App().init());
