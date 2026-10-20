/**
 * ==========================================================================
 *  SOUND ENGINE (Web Audio API Synthesizer & Hover Sound Effects)
 * ==========================================================================
 *  外部音声ファイルを使用せず、Web Audio APIでリアルタイムに優しい
 *  アンビエントサイン波シンセ音（フワッ・ポワン）を生成して再生します。
 */

class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.volume = 0.2; // デフォルト音量 (0.0 - 1.0)
    this.isMuted = false;
    this.lastPlayTime = 0;
    this.minInterval = 50; // 連続再生スロットリング (ms)

    // 心地よいペンタトニック/コード構成音 (C5, D5, E5, G5, A5)
    this.frequencies = [523.25, 587.33, 659.25, 783.99, 880.00];
    this.freqIndex = 0;

    // ローカルストレージから設定を復元
    this.loadSettings();
  }

  /**
   * AudioContextの遅延初期化（ブラウザの自動再生ポリシー対応）
   */
  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * 「フワッ」「ポワン」とした優しいサイン波ピアノ/シンセホバー音を合成・再生
   */
  playHoverSound(customPitch = null) {
    if (this.isMuted || this.volume <= 0) return;

    const nowMs = performance.now();
    if (nowMs - this.lastPlayTime < this.minInterval) return;
    this.lastPlayTime = nowMs;

    this.initContext();
    if (!this.audioCtx || !this.masterGain) return;

    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime;

      // ピッチの決定
      let freq = customPitch;
      if (!freq) {
        freq = this.frequencies[this.freqIndex % this.frequencies.length];
        this.freqIndex++;
      }

      // 1. メインオシレーター (柔らかなサイン波)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);

      // 2. 微かな高音倍音オシレーター (透明感のあるベルの余韻)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, t);

      // 3. ローパスフィルター (角の取れたウォームな音色)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(400, t + 0.22);

      // 4. 音量エンベロープ (Attack: 0.015s, Decay/Release: 0.2s)
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, t);
      noteGain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

      // 5. 倍音用ゲイン
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.08, t);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      // 接続
      osc1.connect(noteGain);
      osc2.connect(harmonicGain);
      harmonicGain.connect(noteGain);

      noteGain.connect(filter);
      filter.connect(this.masterGain);

      // 再生開始 & 停止
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.25);
      osc2.stop(t + 0.25);

      // クリーンアップ
      setTimeout(() => {
        try {
          osc1.disconnect();
          osc2.disconnect();
          noteGain.disconnect();
          filter.disconnect();
        } catch (e) {}
      }, 300);
    } catch (err) {
      console.warn('SoundEngine play error:', err);
    }
  }

  /**
   * 投票ボタンクリック時の「ポチッ/カチッ」効果音（SE）を再生
   * サイト全体のボリュームコントローラー（音量スライダー・ミュート状態）と100%完全自動連動
   * 音声ファイル 'se/click.mp3' を読み込み再生（未配置時や制限時はWeb Audio APIで合成再生フォールバック）
   */
  playClickSound(src = 'se/click.mp3') {
    if (this.isMuted || this.volume <= 0) return;

    this.initContext();

    const currentVolume = this.isMuted ? 0 : Math.max(0, Math.min(1, this.volume));
    if (currentVolume <= 0) return;

    // 1. 指定された音声ファイル (se/click.mp3) の読み込み・再生を試行
    try {
      const audio = new Audio(src);
      audio.volume = currentVolume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // 音声ファイルが見つからない、またはデコードエラー時はシンセクリック音でフォールバック
          this.playSyntheticClick();
        });
      }
    } catch (e) {
      this.playSyntheticClick();
    }
  }

  /**
   * Web Audio APIによる心地よい「ポチッ/カチッ」クリック音の合成再生フォールバック
   */
  playSyntheticClick() {
    if (this.isMuted || this.volume <= 0) return;
    this.initContext();
    if (!this.audioCtx || !this.masterGain) return;

    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime;

      // 短く心地よい「プチッ/カチッ」としたアタック音（サイン波ピッチドロップ）
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.04);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.05);

      setTimeout(() => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch (e) {}
      }, 100);
    } catch (err) {
      console.warn('Synthetic click error:', err);
    }
  }

  /**
   * 目標達成（ゴール）時の派手な効果音（約2秒間）を再生
   * サイト全体のボリュームコントローラー（音量スライダー・ミュート状態）と100%完全自動連動
   * 音声ファイル 'se/complete.mp3' を読み込み再生（未配置時や制限時はWeb Audio APIで合成ファンファーレ再生フォールバック）
   */
  playCompleteSound(src = 'se/complete.mp3') {
    if (this.isMuted || this.volume <= 0) return;

    this.initContext();

    const currentVolume = this.isMuted ? 0 : Math.max(0, Math.min(1, this.volume));
    if (currentVolume <= 0) return;

    // 1. 指定された音声ファイル (se/complete.mp3) の読み込み・再生を試行
    try {
      const audio = new Audio(src);
      audio.volume = currentVolume;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // 音声ファイルが見つからない、またはデコードエラー時はシンセファンファーレ音でフォールバック
          this.playSyntheticFanfare();
        });
      }
    } catch (e) {
      this.playSyntheticFanfare();
    }
  }

  /**
   * Web Audio APIによる華やかなゴールファンファーレ・チャイム音の合成再生フォールバック（約2秒）
   */
  playSyntheticFanfare() {
    if (this.isMuted || this.volume <= 0) return;
    this.initContext();
    if (!this.audioCtx || !this.masterGain) return;

    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime;
      const notes = [
        { time: 0.00, freq: 523.25 }, // C5
        { time: 0.08, freq: 659.25 }, // E5
        { time: 0.16, freq: 783.99 }, // G5
        { time: 0.24, freq: 1046.50 }, // C6
        { time: 0.32, freq: 1318.51 }, // E6
        { time: 0.40, freq: 1567.98 }, // G6
        { time: 0.48, freq: 2093.00 }  // C7
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, t + n.time);

        const startTime = t + n.time;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 1.45);

        setTimeout(() => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch (e) {}
        }, 2200);
      });
    } catch (err) {
      console.warn('Synthetic fanfare error:', err);
    }
  }

  /**
   * 音量設定 (0.0 - 1.0)
   */
  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, parseFloat(val)));
    if (this.volume === 0) {
      this.isMuted = true;
    } else if (this.isMuted && this.volume > 0) {
      this.isMuted = false;
    }

    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.audioCtx.currentTime,
        0.02
      );
    }

    this.saveSettings();
    this.updateUI();
  }

  /**
   * ミュートのトグル切り替え
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted && this.volume === 0) {
      this.volume = 0.2;
    }

    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.audioCtx.currentTime,
        0.02
      );
    }

    if (!this.isMuted) {
      this.playHoverSound(659.25);
    }

    this.saveSettings();
    this.updateUI();
  }

  /**
   * 設定の保存
   */
  saveSettings() {
    try {
      localStorage.setItem('piano_site_se_vol', this.volume.toString());
      localStorage.setItem('piano_site_se_muted', this.isMuted.toString());
    } catch (e) {}
  }

  /**
   * 設定の読み込み
   */
  loadSettings() {
    try {
      const savedVol = localStorage.getItem('piano_site_se_vol');
      const savedMuted = localStorage.getItem('piano_site_se_muted');
      if (savedVol !== null) this.volume = parseFloat(savedVol);
      if (savedMuted !== null) this.isMuted = (savedMuted === 'true');
    } catch (e) {}
  }

  /**
   * コントローラーUIの初期化とイベントバインド
   */
  initControllerUI() {
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const volumeSlider = document.getElementById('soundVolumeSlider');

    // 初回UI同期
    this.updateUI();

    // 初回クリック/操作でAudioContextを有効化
    const unlockAudio = () => {
      this.initContext();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });

    // ミュートボタントグル
    soundToggleBtn?.addEventListener('click', () => {
      this.toggleMute();
    });

    // スライダー操作
    volumeSlider?.addEventListener('input', (e) => {
      this.setVolume(e.target.value);
    });

    // スライダー変更完了時にテスト音を優しく鳴らす
    volumeSlider?.addEventListener('change', () => {
      if (!this.isMuted && this.volume > 0) {
        this.playHoverSound(783.99);
      }
    });

    // サイト内の要素へホバー効果音をバインド
    this.bindHoverSoundElements();
  }

  /**
   * UI表示の更新
   */
  updateUI() {
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const volumeSlider = document.getElementById('soundVolumeSlider');
    const volumeValueText = document.getElementById('soundVolumeValue');
    const soundIconWrap = document.getElementById('soundIconWrap');

    const effectiveVol = this.isMuted ? 0 : this.volume;
    const volPercent = Math.round(effectiveVol * 100);

    if (volumeSlider) {
      volumeSlider.value = effectiveVol;
      volumeSlider.style.background = `linear-gradient(to right, #00f2fe 0%, #00f2fe ${volPercent}%, #20242e ${volPercent}%, #20242e 100%)`;
    }

    if (volumeValueText) {
      volumeValueText.textContent = this.isMuted ? 'MUTE' : `${volPercent}%`;
    }

    if (soundToggleBtn) {
      if (this.isMuted || effectiveVol === 0) {
        soundToggleBtn.classList.add('is-muted');
        soundToggleBtn.setAttribute('aria-label', '効果音をONにする');
        if (soundIconWrap) {
          soundIconWrap.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          `;
        }
      } else {
        soundToggleBtn.classList.remove('is-muted');
        soundToggleBtn.setAttribute('aria-label', '効果音をミュートする');
        if (soundIconWrap) {
          soundIconWrap.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          `;
        }
      }
    }
  }

  /**
   * ヘッダーメニューホバー専用の近未来的高音電子SE「ピキン！✨」をWeb Audio APIで合成・再生
   * 外部音声ファイル不要、ボリュームコントローラー（音量スライダー・ミュート状態）と100%リアルタイム自動連動
   */
  playPiknSound() {
    if (this.isMuted || this.volume <= 0) return;

    this.initContext();
    if (!this.audioCtx || !this.masterGain) return;

    try {
      const ctx = this.audioCtx;
      const t = ctx.currentTime;

      // 1. 基音オシレーター（超高音サイン波: ピキンというクリスタル打音）
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2400, t);
      osc1.frequency.exponentialRampToValueAtTime(3300, t + 0.012);
      osc1.frequency.exponentialRampToValueAtTime(3100, t + 0.16);

      // 2. きらめき倍音オシレーター（高周波のキラキラ成分）
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(4800, t);
      osc2.frequency.exponentialRampToValueAtTime(6600, t + 0.015);
      osc2.frequency.exponentialRampToValueAtTime(5000, t + 0.12);

      // 3. アタックゲイン（鋭いアタック 0.002s、余韻 0.18s）
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, t);
      noteGain.gain.exponentialRampToValueAtTime(0.35, t + 0.003);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      // 4. 倍音用ゲイン
      const harmonicGain = ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.0001, t);
      harmonicGain.gain.exponentialRampToValueAtTime(0.2, t + 0.003);
      harmonicGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);

      // 5. ハイパスフィルター（低域をカットしてクリアな電子感と抜けの良さを極限まで高める）
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, t);

      // 接続ルーティング
      osc1.connect(noteGain);
      osc2.connect(harmonicGain);
      harmonicGain.connect(noteGain);
      noteGain.connect(filter);
      filter.connect(this.masterGain);

      // 発音開始 & 停止
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.20);
      osc2.stop(t + 0.20);

      // ガベージコレクション & 切断
      setTimeout(() => {
        try {
          osc1.disconnect();
          osc2.disconnect();
          harmonicGain.disconnect();
          noteGain.disconnect();
          filter.disconnect();
        } catch (e) {}
      }, 250);
    } catch (err) {
      console.warn('SoundEngine playPiknSound error:', err);
    }
  }

  /**
   * サイト内のインタラクティブ要素にホバー音を自動登録
   */
  bindHoverSoundElements() {
    // ヘッダーメニュー（6個）は専用の近未来電子音「ピキン！✨」をバインド
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(el => {
      if (el.dataset.soundBound) return;
      el.dataset.soundBound = 'true';

      el.addEventListener('mouseenter', () => {
        this.playPiknSound();
      });
    });

    const selectors = [
      '.dock-link-btn',
      '.btn-channel-link',
      '.btn-icon-action',
      '.feature-card',
      '.repertoire-card',
      '.shorts-card',
      '.app-card',
      '.sheet-card',
      '.btn-load-more',
      '.btn-piascore-store',
      '.btn-buy-piascore',
      '.footer-links a',
      '.footer-official-link',
      '.footer-config-btn',
      '.btn-guide-link',
      '.scroll-link',
      '.stat-pill',
      '.theater-close-btn',
      '.config-close-btn',
      '.btn-game-fullscreen-3d',
      '.btn-game-fullscreen-close'
    ];

    const elements = document.querySelectorAll(selectors.join(', '));
    elements.forEach(el => {
      if (el.dataset.soundBound) return;
      el.dataset.soundBound = 'true';

      el.addEventListener('mouseenter', () => {
        this.playHoverSound();
      });
    });
  }
}

// グローバルスコープへ公開
window.SoundEngine = SoundEngine;
