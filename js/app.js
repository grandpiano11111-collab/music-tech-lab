/**
 * ==========================================================================
 *  PIANO CINEMA - MAIN APPLICATION CONTROLLER
 * ==========================================================================
 *  Handles data hydration, UI rendering, Load More pagination,
 *  cinematic theater modal, and interactive API configuration.
 */

class PianoCinemaApp {
  constructor() {
    this.config = window.CONFIG;
    this.youtubeService = new YouTubeService(this.config);
    this.animationEngine = new AnimationEngine();
    this.soundEngine = new SoundEngine();

    // DOM Elements Cache
    this.repertoireGrid = document.getElementById('repertoireGrid');
    this.shortsGrid = document.getElementById('shortsGrid');
    this.regularLoadMoreBtn = document.getElementById('regularLoadMoreBtn');
    this.shortsLoadMoreBtn = document.getElementById('shortsLoadMoreBtn');
    this.regularLoadStatus = document.getElementById('regularLoadStatus');
    this.shortsLoadStatus = document.getElementById('shortsLoadStatus');

    // Theater Modal Elements
    this.theaterModal = document.getElementById('theaterModal');
    this.theaterIframe = document.getElementById('theaterIframe');
    this.theaterCloseBtn = document.getElementById('theaterCloseBtn');
    this.theaterBackdrop = document.getElementById('theaterBackdrop');
    this.playerAspect = document.getElementById('playerAspect');
    this.modalCategory = document.getElementById('modalCategory');
    this.modalDate = document.getElementById('modalDate');
    this.modalViews = document.getElementById('modalViews');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalDesc = document.getElementById('modalDesc');
    this.modalYoutubeLink = document.getElementById('modalYoutubeLink');

    // Config Modal Elements
    this.configModal = document.getElementById('configModal');
    this.configForm = document.getElementById('configForm');
    this.inputApiKey = document.getElementById('inputApiKey');
    this.inputChannelId = document.getElementById('inputChannelId');
    this.openConfigBtn = document.getElementById('openConfigBtn');
    this.footerConfigBtn = document.getElementById('footerConfigBtn');
    this.configCloseBtn = document.getElementById('configCloseBtn');
    this.configBackdrop = document.getElementById('configBackdrop');
    this.btnConfigReset = document.getElementById('btnConfigReset');
    this.configStatusMsg = document.getElementById('configStatusMsg');

    // Toast
    this.toastNotification = document.getElementById('toastNotification');
    this.toastMsg = document.getElementById('toastMsg');
    this.toastTimeout = null;

    // Realtime Sync Engine (Port 8888)
    this.syncPort = 8888;
    this.lastSyncTimestamp = 0;
    this.isSyncing = false;
  }

  isLocalServerEnvironment() {
    try {
      const proto = window.location.protocol;
      const hn = (window.location.hostname || '').toLowerCase();
      if (proto === 'file:' || hn === '' || hn === 'localhost' || hn === '127.0.0.1' || hn === '::1' || hn === '[::1]') {
        return true;
      }
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hn)) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  getSyncApiUrl(endpoint) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port || this.syncPort || 8888;
    return `${protocol}//${hostname}:${port}${endpoint}`;
  }

  applySyncDataset(dataObj, isStaticFallback = false) {
    if (!dataObj || typeof dataObj !== 'object') return;
    for (const [key, value] of Object.entries(dataObj)) {
      if (value === undefined || value === null) continue;
      if (isStaticFallback && (
        key === 'piano_cinema_request_votes' ||
        key === 'piano_cinema_request2_votes' ||
        key === 'piano_cinema_request3_votes'
      )) {
        const secNum = key.includes('request2') ? 2 : (key.includes('request3') ? 3 : 1);
        const resetKey = `piano_cinema_request_reset_ts_${secNum}`;
        const remoteReset = Number(dataObj[resetKey]) || 0;
        const localReset = Number(localStorage.getItem(resetKey)) || 0;
        if (localReset >= remoteReset) {
          try {
            const localVotes = JSON.parse(localStorage.getItem(key) || 'null');
            if (Array.isArray(localVotes) && Array.isArray(value)) {
              const mergedVotes = value.map((v, idx) => Math.max(Number(v) || 0, Number(localVotes[idx]) || 0));
              localStorage.setItem(key, JSON.stringify(mergedVotes));
              continue;
            }
          } catch (e) {}
        }
      }
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  }

  /**
   * サーバー（ポート8888）またはGitHub Pages静的sync-data.jsonから最新データを取得してlocalStorageに反映
   */
  async syncFromServer() {
    let syncedFromPort8888 = false;
    if (this.isLocalServerEnvironment()) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 1200) : null;
        const res = await fetch(this.getSyncApiUrl('/api/sync'), controller ? { signal: controller.signal } : {});
        if (timer) clearTimeout(timer);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success) {
            if (json.lastModified) {
              this.lastSyncTimestamp = json.lastModified;
            }
            if (json.data && typeof json.data === 'object') {
              this.applySyncDataset(json.data, false);
              syncedFromPort8888 = true;
            }
          }
        }
      } catch (e) {
        console.warn('[Sync Engine] Server port 8888 fetch skipped (offline fallback):', e);
      }
    }

    if (!syncedFromPort8888 && window.location.protocol !== 'file:') {
      try {
        const staticRes = await fetch(`./sync-data.json?t=${Date.now()}`, { cache: 'no-store' });
        if (staticRes.ok) {
          const rawJson = await staticRes.json();
          const dataObj = (rawJson && rawJson.success && rawJson.data && typeof rawJson.data === 'object')
            ? rawJson.data
            : rawJson;
          if (dataObj && typeof dataObj === 'object') {
            this.applySyncDataset(dataObj, true);
          }
        }
      } catch (e) {
        console.warn('[Sync Engine] Static sync-data.json fetch skipped:', e);
      }
    }
  }

  /**
   * サーバー（ポート8888）へ全データを即時送信して永続化（ローカル環境限定）
   */
  async syncToServer(extraData = {}) {
    if (!this.isLocalServerEnvironment()) return;
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 1500) : null;
      const syncUrl = this.getSyncApiUrl('/api/sync');
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extraData),
        ...(controller ? { signal: controller.signal } : {})
      });
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const json = await res.json();
        if (json && json.lastModified) {
          this.lastSyncTimestamp = json.lastModified;
        }
      }
    } catch (e) {
      console.warn('[Sync Engine] Server port 8888 save skipped:', e);
    }
  }

  /**
   * Wi-Fi経由のスマホ・iPadにも1秒で同時に自動反映されるリアルタイム同期監視ループ
   */
  startRealtimeSync() {
    if (!this.isLocalServerEnvironment()) return;
    setInterval(async () => {
      if (this.isSyncing) return;
      try {
        const timestampUrl = this.getSyncApiUrl('/api/sync/timestamp');
        const res = await fetch(timestampUrl, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && json.lastModified && json.lastModified > this.lastSyncTimestamp) {
            if (this.lastSyncTimestamp > 0) {
              console.log('[Piano Cinema] ⚡ サーバーの最新更新を検知。全要素を即座に自動反映します...');
              this.isSyncing = true;
              this.lastSyncTimestamp = json.lastModified;
              await this.syncFromServer();
              await this.refreshAllSections();
              this.isSyncing = false;
            } else {
              this.lastSyncTimestamp = json.lastModified;
            }
          }
        }
      } catch (e) {
        // ネットワーク待機
      }
    }, 1000); // 1秒ごとに更新チェック
  }

  /**
   * 全セクションを最新データで再描画
   */
  async refreshAllSections() {
    try {
      if (this.youtubeService && typeof this.youtubeService.initDemoData === 'function') {
        this.youtubeService.initDemoData();
      }
      await this.loadInitialVideos();
      this.loadSectionHeaders();
      this.loadStoreTexts();
      this.loadSheetMusic();
      this.loadProfileTexts();
      this.loadRequestTexts();
      if (typeof this.updateAllRequestSlots === 'function') {
        this.updateAllRequestSlots();
      }
      this.loadRequest2Texts();
      if (typeof this.updateAllRequest2Slots === 'function') {
        this.updateAllRequest2Slots();
      }
      this.loadRequest3Texts();
      if (typeof this.updateAllRequest3Slots === 'function') {
        this.updateAllRequest3Slots();
      }
      if (typeof this.loadAdminData === 'function') {
        this.loadAdminData();
      }
      this.refreshIcons();
    } catch (err) {
      console.warn('[Piano Cinema] Refresh all sections warning:', err);
    }
  }

  /**
   * アプリケーション初期化
   */
  async init() {
    // ページ起動時は必ず強制的に最上部へリセット
    window.scrollTo(0, 0);

    // サーバー（ポート8888）から最新データを完全同期
    await this.syncFromServer();

    console.log('%c🎹 PIANO CINEMA ARCHIVE INITIALIZING 🎹', 'color: #d4af37; font-size: 14px; font-weight: bold;');

    // アニメーションエンジン初期化（カーソル、ヘッダースクロールなど）
    this.animationEngine.init();

    // YouTubeサービス初期化（API通信 or デモデータ）
    const initResult = await this.youtubeService.initialize();
    this.updateHeaderAndStats(initResult);

    // 初期動画データの読み込み（通常6本、ショート6本）
    await this.loadInitialVideos();

    // 02 MAIN COVERS / 03 SHORTS / 05 STORE / 06 PROFILE / リクエスト（セクション見出し・説明文）の読み込み（管理画面の更新を即時反映）
    this.loadSectionHeaders();
    this.loadStoreTexts();
    this.loadSheetMusic();
    this.loadProfileTexts();
    this.loadRequestTexts();
    this.initRequestSection();
    this.loadRequest2Texts();
    this.initRequest2Section();
    this.loadRequest3Texts();
    this.initRequest3Section();
    this.initGameFullscreen();

    // イベントリスナーのバインド
    this.bindEvents();

    // 管理者モーダルポップアップの初期化（パスワード1234 / 即時反映）
    this.initAdminModal();

    // サウンドエンジン & 固定音量コントローラー初期化
    this.soundEngine.initControllerUI();

    // アイコンの初期描画
    this.refreshIcons();

    // 最上部位置を再確認
    window.scrollTo(0, 0);

    // Wi-Fi経由のスマホ・iPadへ1秒で自動反映させるリアルタイム監視開始
    this.startRealtimeSync();

    // オープニング幕開けアニメーションの実行
    this.animationEngine.playOpeningSequence(() => {
      window.scrollTo(0, 0);
    });
  }

  /**
   * ヘッダー / ヒーローエリア / 01 FEATURES / 02 MAIN COVERS / 03 SHORTS / 04 LAB APPS / フッター セクションの見出し・説明文をDOMに反映
   */
  loadSectionHeaders() {
    // 00. HEADER AREA
    const defaultHeaderInfo = {
      title: 'MUSIC TECH LAB',
      tag: '最新アニソン&ゲーム音楽・ピアノCH'
    };

    let headerInfo = defaultHeaderInfo;
    try {
      const savedHeader = localStorage.getItem('piano_cinema_custom_header_info');
      if (savedHeader) {
        headerInfo = { ...defaultHeaderInfo, ...JSON.parse(savedHeader) };
      }
    } catch (e) {
      console.warn('Failed to parse custom header info:', e);
    }

    const navChannelTitleEl = document.getElementById('navChannelTitle');
    if (navChannelTitleEl && headerInfo.title) {
      navChannelTitleEl.textContent = headerInfo.title;
    }

    const navChannelTagEl = document.getElementById('navChannelTag');
    if (navChannelTagEl && headerInfo.tag) {
      navChannelTagEl.textContent = headerInfo.tag;
    }

    // 0. HERO AREA
    const defaultHeroInfo = {
      title: '最新アニソン＆ゲーム音楽・ピアノCH 【Music Tech Lab】',
      tagline: '88鍵が描き出す、原曲の熱量とシネマティックな音響美学。\n最新アニメ・ゲームの名曲を、初心者から愛好家まで楽しめるハイブリッド仕様でお届けします。',
      metaTag: 'MUSIC TECH LAB / 最新アニソン＆ゲーム音楽・ピアノCH',
      metaSub: 'ANIME & GAME MUSIC PIANO ARCHIVE',
      brandPill: 'OFFICIAL PIANO ARCHIVE',
      statLabel1: 'TOTAL TRACKS',
      statTotal: '130+ Works',
      statLabel2: 'ARRANGEMENTS',
      statArrangements: 'One-Chorus & Virtuoso',
      statLabel3: 'AUDIO MASTERS',
      statAudio: 'Lossless High-Res'
    };

    try {
      const savedHero = localStorage.getItem('piano_cinema_custom_hero_info');
      const heroInfo = savedHero ? { ...defaultHeroInfo, ...JSON.parse(savedHero) } : defaultHeroInfo;
      const heroTitleEl = document.getElementById('heroMainTitle');
      if (heroTitleEl && heroInfo.title) {
        if (heroInfo.title.includes('【') && heroInfo.title.includes('】')) {
          const regex = /【(.*?)】/g;
          let lastIndex = 0;
          let html = '';
          let match;
          while ((match = regex.exec(heroInfo.title)) !== null) {
            const preText = heroInfo.title.substring(lastIndex, match.index);
            if (preText) {
              html += `<span class="title-group-main"><span class="text-white-glow">${this.escapeHtml(preText)}</span></span>`;
            }
            html += `<span class="title-group-brand"><span class="brand-bracket">【</span><span class="brand-name-glow">${this.escapeHtml(match[1])}</span><span class="brand-bracket">】</span></span>`;
            lastIndex = regex.lastIndex;
          }
          if (lastIndex < heroInfo.title.length) {
            html += `<span class="title-group-main"><span class="text-white-glow">${this.escapeHtml(heroInfo.title.substring(lastIndex))}</span></span>`;
          }
          heroTitleEl.innerHTML = html;
        } else {
          heroTitleEl.innerHTML = `<span class="title-group-main"><span class="text-white-glow">${this.escapeHtml(heroInfo.title)}</span></span>`;
        }
      }
      const heroTaglineEl = document.getElementById('heroTagline');
      if (heroTaglineEl && heroInfo.tagline) {
        heroTaglineEl.innerHTML = this.escapeHtml(heroInfo.tagline).replace(/\n/g, '<br>');
      }

      const heroMetaTagTextEl = document.getElementById('heroMetaTagText');
      if (heroMetaTagTextEl && heroInfo.metaTag) heroMetaTagTextEl.textContent = heroInfo.metaTag;

      const heroMetaSubEl = document.getElementById('heroMetaSub');
      if (heroMetaSubEl && heroInfo.metaSub) heroMetaSubEl.textContent = heroInfo.metaSub;

      const heroBrandPillTextEl = document.getElementById('heroBrandPillText');
      if (heroBrandPillTextEl && heroInfo.brandPill) heroBrandPillTextEl.textContent = heroInfo.brandPill;

      const heroStatLabel1El = document.getElementById('heroStatLabel1');
      if (heroStatLabel1El && heroInfo.statLabel1) heroStatLabel1El.textContent = heroInfo.statLabel1;

      const heroTotalVideosEl = document.getElementById('heroTotalVideos');
      if (heroTotalVideosEl && heroInfo.statTotal) heroTotalVideosEl.textContent = heroInfo.statTotal;

      const heroStatLabel2El = document.getElementById('heroStatLabel2');
      if (heroStatLabel2El && heroInfo.statLabel2) heroStatLabel2El.textContent = heroInfo.statLabel2;

      const heroStatArrangementsEl = document.getElementById('heroStatArrangements');
      if (heroStatArrangementsEl && heroInfo.statArrangements) heroStatArrangementsEl.textContent = heroInfo.statArrangements;

      const heroStatLabel3El = document.getElementById('heroStatLabel3');
      if (heroStatLabel3El && heroInfo.statLabel3) heroStatLabel3El.textContent = heroInfo.statLabel3;

      const heroStatAudioEl = document.getElementById('heroStatAudio');
      if (heroStatAudioEl && heroInfo.statAudio) heroStatAudioEl.textContent = heroInfo.statAudio;
    } catch (e) {
      console.warn('Failed to parse custom hero info:', e);
    }

    // 1. 01 FEATURES (動画のこだわり)
    const defaultFeaturesInfo = {
      badge: 'MULTI-LAYERED VISUAL SPECIFICATIONS',
      title: '01 / FEATURES (動画のこだわり)',
      desc: '歌える・学べる・弾ける。すべての動画に施された5層のマルチ情報。\n初心者から海外ファンまで、見るだけで演奏が深まる究極の映像仕様。',
      card1Badge: 'SING ALONG',
      card1En: 'JAPANESE LYRICS',
      card1Ja: '日本語歌詞',
      card1Desc: '一緒に歌える、原曲のニュアンスや感情がダイレクトに伝わる洗練された日本語歌詞。',
      card1Tag: 'ニュアンスが伝わる',
      card2Badge: 'GLOBAL FANS',
      card2En: 'ROMAJI / ENGLISH LYRICS',
      card2Ja: 'アルファベット歌詞',
      card2Desc: '海外のファンも楽しめる英語・ローマ字歌詞。世界中どこからでも一緒に楽しめます。',
      card2Tag: '海外ファンも楽しめる',
      card3Badge: 'EASY TO PLAY',
      card3En: 'DO-RE-MI NOTATION',
      card3Ja: 'ドレミ音階',
      card3Desc: '初心者でもパッと見てすぐに弾けるドレミの案内。鍵盤のどこを弾くか一目で分かります。',
      card3Tag: '初心者もすぐに弾ける',
      card4Badge: 'CHORD & THEORY',
      card4En: 'C-D-E NOTATION',
      card4Ja: 'CDE音階',
      card4Desc: 'コードや国際基準で学べるアルファベット音階。ポピュラー音楽の理論やコード学習に最適。',
      card4Tag: '国際基準で学べる',
      card5Badge: 'PRACTICE COMPANION',
      card5En: 'RIGHT-HAND SHEET MUSIC',
      card5Ja: 'メロディ楽譜',
      card5Desc: '右手の五線譜がついているから、動画を見ながら一緒に練習できる親切な設計。',
      card5Tag: '動画を見ながら練習できる',
      bannerPill: '5-IN-1 MULTI-SPECIFICATION',
      bannerTitle: '観る・歌う・弾ける。',
      bannerHighlight: 'すべての動画が「練習＆鑑賞」のマルチ仕様。',
      bannerDesc: 'ピアノの演奏映像に、日本語歌詞・アルファベット歌詞・ドレミ・CDE・右手五線譜の5つの情報レイヤーを美しく統合。\nただ聴くだけでなく、弾きたい曲を自分のペースでマスターできる映像体験をお届けします。'
    };

    let featInfo = defaultFeaturesInfo;
    try {
      const savedFeat = localStorage.getItem('piano_cinema_custom_features_info');
      if (savedFeat) {
        featInfo = { ...defaultFeaturesInfo, ...JSON.parse(savedFeat) };
      }
    } catch (e) {
      console.warn('Failed to parse custom features section info:', e);
    }

    const featBadgeEl = document.getElementById('featuresSectionBadge');
    if (featBadgeEl && featInfo.badge) featBadgeEl.textContent = featInfo.badge;

    const featTitleEl = document.getElementById('featuresSectionTitle');
    if (featTitleEl && featInfo.title) featTitleEl.textContent = featInfo.title;

    const featDescEl = document.getElementById('featuresSectionDesc');
    if (featDescEl && featInfo.desc) featDescEl.innerHTML = this.escapeHtml(featInfo.desc).replace(/\n/g, '<br>');

    // 01 FEATURES 5 Cards
    for (let i = 1; i <= 5; i++) {
      const bEl = document.getElementById(`featCard${i}Badge`);
      if (bEl && featInfo[`card${i}Badge`]) bEl.textContent = featInfo[`card${i}Badge`];

      const enEl = document.getElementById(`featCard${i}En`);
      if (enEl && featInfo[`card${i}En`]) enEl.textContent = featInfo[`card${i}En`];

      const jaEl = document.getElementById(`featCard${i}Ja`);
      if (jaEl && featInfo[`card${i}Ja`]) jaEl.textContent = featInfo[`card${i}Ja`];

      const descEl = document.getElementById(`featCard${i}Desc`);
      if (descEl && featInfo[`card${i}Desc`]) descEl.innerHTML = this.escapeHtml(featInfo[`card${i}Desc`]).replace(/\n/g, '<br>');

      const tagEl = document.getElementById(`featCard${i}Tag`);
      if (tagEl && featInfo[`card${i}Tag`]) tagEl.textContent = featInfo[`card${i}Tag`];
    }

    // 01 FEATURES Demo Banner
    const bannerPillTextEl = document.getElementById('featBannerPillText');
    if (bannerPillTextEl && featInfo.bannerPill) bannerPillTextEl.textContent = featInfo.bannerPill;

    const bannerTitleEl = document.getElementById('featBannerTitle');
    if (bannerTitleEl) {
      const t = this.escapeHtml(featInfo.bannerTitle || '観る・歌う・弾ける。');
      const h = this.escapeHtml(featInfo.bannerHighlight || 'すべての動画が「練習＆鑑賞」のマルチ仕様。');
      bannerTitleEl.innerHTML = `${t}<span class="gold-gradient-text">${h}</span>`;
    }

    const bannerDescEl = document.getElementById('featBannerDesc');
    if (bannerDescEl && featInfo.bannerDesc) {
      bannerDescEl.innerHTML = this.escapeHtml(featInfo.bannerDesc).replace(/\n/g, '<br class="pc-only">');
    }

    // 2. 02 MAIN COVERS (Regular Videos)
    const defaultRegularInfo = {
      badge: 'FULL HARMONIC ARRANGEMENTS',
      title: '02 / MAIN COVERS (ワンコーラス)',
      desc: 'じっくり聴かせる、原曲の魅力を凝縮したワンコーラス演奏。\nMelodic Depth & Dynamic Range — ピアノならではの豊かな響きを味わうメイン動画。',
      youtubeUrl: ''
    };

    let regInfo = defaultRegularInfo;
    try {
      const savedReg = localStorage.getItem('piano_cinema_custom_regular_info');
      if (savedReg) {
        regInfo = { ...defaultRegularInfo, ...JSON.parse(savedReg) };
      }
    } catch (e) {
      console.warn('Failed to parse custom regular section info:', e);
    }

    const regBadgeEl = document.getElementById('regularSectionBadge');
    if (regBadgeEl && regInfo.badge) {
      regBadgeEl.textContent = regInfo.badge;
    }

    const regTitleEl = document.getElementById('regularSectionTitle');
    if (regTitleEl && regInfo.title) {
      regTitleEl.textContent = regInfo.title;
    }

    const regDescEl = document.getElementById('regularSectionDesc');
    if (regDescEl && regInfo.desc) {
      regDescEl.innerHTML = this.escapeHtml(regInfo.desc).replace(/\n/g, '<br>');
    }

    const regMoreBtn = document.getElementById('regularLoadMoreBtn');
    if (regMoreBtn) {
      regMoreBtn.href = (regInfo.youtubeUrl && regInfo.youtubeUrl !== 'https://youtube.com') ? regInfo.youtubeUrl : '#';
    }

    // 3. 03 SHORTS (Shorts Videos)
    const defaultShortsInfo = {
      badge: 'CHORUS HIGHLIGHTS IN 60s',
      title: '03 / SHORTS (サビだけ弾いてみた)',
      desc: 'サビの爆発力を1分に凝縮した、疾走感あるショート動画。\nInstant Climax & Finger Speed — スマホに最適化された縦長ショート演奏。',
      youtubeUrl: ''
    };

    let shtInfo = defaultShortsInfo;
    try {
      const savedSht = localStorage.getItem('piano_cinema_custom_shorts_info');
      if (savedSht) {
        shtInfo = { ...defaultShortsInfo, ...JSON.parse(savedSht) };
      }
    } catch (e) {
      console.warn('Failed to parse custom shorts section info:', e);
    }

    const shtBadgeEl = document.getElementById('shortsSectionBadge');
    if (shtBadgeEl && shtInfo.badge) {
      shtBadgeEl.textContent = shtInfo.badge;
    }

    const shtTitleEl = document.getElementById('shortsSectionTitle');
    if (shtTitleEl && shtInfo.title) {
      shtTitleEl.textContent = shtInfo.title;
    }

    const shtDescEl = document.getElementById('shortsSectionDesc');
    if (shtDescEl && shtInfo.desc) {
      shtDescEl.innerHTML = this.escapeHtml(shtInfo.desc).replace(/\n/g, '<br>');
    }

    const shtMoreBtn = document.getElementById('shortsLoadMoreBtn');
    if (shtMoreBtn) {
      shtMoreBtn.href = (shtInfo.youtubeUrl && shtInfo.youtubeUrl !== 'https://youtube.com') ? shtInfo.youtubeUrl : '#';
    }

    // 4. 04 LAB APPS (開発アプリ)
    const defaultLabInfo = {
      badge: 'POWERED BY GOOGLE ANTIGRAVITY & AI',
      title: '04 / LAB APPS (開発アプリ)',
      desc: 'Google Antigravity × AIが加速させる、次世代の音楽テクノロジー開発。\nこのWebサイトをはじめ、動画制作を革新するすべてのツールをAntigravity環境上で最速開発。',
      heroBadge: 'NEXT-GEN DEVELOPMENT PIPELINE',
      heroTitle: 'すべては、',
      heroHighlight: 'Google Antigravity × 最先端AI と共に。',
      heroSubtitle: '圧倒的なスピードで生み出される音楽プロダクト群。',
      heroDesc: '当チャンネル「Music Tech Lab」のWebサイト自体はもちろん、動画内で活用しているビジュアライザーや歌詞同期アプリなど、すべてのプロダクトをGoogleが誇る次世代AI開発プラットフォーム「Google Antigravity」を活用して爆速構築しています。音楽と最先端テクノロジーの融合が、かつてない表現体験を切り拓きます。',
      heroStat1Num: 'AI-Native',
      heroStat1Label: 'Google Antigravity Driven',
      heroStat2Num: 'Ultra Fast',
      heroStat2Label: 'Rapid Iteration & Deploy',
      heroStat3Num: 'In The Lab',
      heroStat3Label: 'Multiple AI Tools Under Dev',
      card1Badge: 'VISUAL EFFECT TOOL',
      card1En: 'Audio Visualizer',
      card1Ja: 'オーディオビジュアライザー',
      card1Desc: '音楽の周波数波形や響きを美しくリアルタイム可視化するエフェクトツール。音の強弱に呼応するシネマティックな光彩パーティクルが、演奏動画の没入感を極限まで高めます。',
      card1Tag1: 'WebGL / Canvas',
      card1Tag2: 'Realtime FFT',
      card1Tag3: 'Antigravity Built',
      card1Status: 'Active in Production',
      card1GamePath: 'games/index.html',
      card2Badge: 'KARAOKE SYNC SYSTEM',
      card2En: 'Lrc Sync App',
      card2Ja: '同期型カラオケ歌詞アプリ',
      card2Desc: 'スペースキーを曲に合わせてトントンと叩くだけで歌詞のタイムスタンプを直感的に記憶。カラオケのように歌詞の色が滑らかに変化する動画用テロップを即座に出力する次世代システム。',
      card2Tag1: 'Spacebar Rhythm Input',
      card2Tag2: 'Smooth Color Flow',
      card2Tag3: 'Antigravity Built',
      card2Status: 'Active in Production',
      card2GamePath: '',
      card3Badge: 'REACTIVE 2D/3D ANIMATION',
      card3En: 'Sonic Avatars',
      card3Ja: '音波連動キャラクター',
      card3Desc: '音楽のビートやアタック音に合わせて、リアルタイムにリズミカルに踊り出す犬、猫、ウサギなどの愛らしい動物キャラクター群。動画画面を賑やかに彩るインタラクティブ演出。',
      card3Tag1: 'Beat Reactive',
      card3Tag2: 'Animal Avatars',
      card3Tag3: 'Antigravity Built',
      card3Status: 'Active in Production',
      card3GamePath: '',
      card4Badge: 'FUTURE ECOSYSTEM',
      card4En: 'Music AI Ecosystem',
      card4Ja: '次世代音楽AIツール群',
      card4Desc: '自動楽譜認識・伴奏生成・音源分離など、多数の音楽AIツールをGoogle Antigravity上で現在鋭意開発中。テクノロジーで音楽表現の未来を拡張し続けます。',
      card4Tag1: 'AI Audio Gen',
      card4Tag2: 'Harmonic Engine',
      card4Tag3: 'In Active R&D',
      card4Status: 'In Active Development',
      card4GamePath: ''
    };

    let labInfo = defaultLabInfo;
    try {
      const savedLab = localStorage.getItem('piano_cinema_custom_lab_info');
      if (savedLab) {
        labInfo = { ...defaultLabInfo, ...JSON.parse(savedLab) };
      }
    } catch (e) {
      console.warn('Failed to parse custom lab section info:', e);
    }

    if (!labInfo.card1GamePath || /^games\/AI(?:%20| )OTOGE-10\b/i.test(labInfo.card1GamePath)) {
      labInfo.card1GamePath = 'games/index.html';
    }

    const labBadgeEl = document.getElementById('labSectionBadge');
    if (labBadgeEl && labInfo.badge) labBadgeEl.textContent = labInfo.badge;

    const labTitleEl = document.getElementById('labSectionTitle');
    if (labTitleEl && labInfo.title) labTitleEl.textContent = labInfo.title;

    const labDescEl = document.getElementById('labSectionDesc');
    if (labDescEl && labInfo.desc) labDescEl.innerHTML = this.escapeHtml(labInfo.desc).replace(/\n/g, '<br>');

    // 04 LAB APPS Hero Banner
    const labHeroBadgeEl = document.getElementById('labHeroBadge');
    if (labHeroBadgeEl && labInfo.heroBadge) labHeroBadgeEl.textContent = labInfo.heroBadge;

    const labHeroTitleEl = document.getElementById('labHeroTitle');
    if (labHeroTitleEl) {
      const t = this.escapeHtml(labInfo.heroTitle || 'すべては、');
      const h = this.escapeHtml(labInfo.heroHighlight || 'Google Antigravity × 最先端AI と共に。');
      const s = this.escapeHtml(labInfo.heroSubtitle || '圧倒的なスピードで生み出される音楽プロダクト群。');
      labHeroTitleEl.innerHTML = `${t}<span class="gold-gradient-text">${h}</span><br>${s}`;
    }

    const labHeroDescEl = document.getElementById('labHeroDesc');
    if (labHeroDescEl && labInfo.heroDesc) {
      labHeroDescEl.innerHTML = this.escapeHtml(labInfo.heroDesc)
        .replace(/Google Antigravity/g, '<strong>「Google Antigravity」</strong>')
        .replace(/\n/g, '<br>');
    }

    const labStat1NumEl = document.getElementById('labHeroStat1Num');
    if (labStat1NumEl && labInfo.heroStat1Num) labStat1NumEl.textContent = labInfo.heroStat1Num;
    const labStat1LabelEl = document.getElementById('labHeroStat1Label');
    if (labStat1LabelEl && labInfo.heroStat1Label) labStat1LabelEl.textContent = labInfo.heroStat1Label;

    const labStat2NumEl = document.getElementById('labHeroStat2Num');
    if (labStat2NumEl && labInfo.heroStat2Num) labStat2NumEl.textContent = labInfo.heroStat2Num;
    const labStat2LabelEl = document.getElementById('labHeroStat2Label');
    if (labStat2LabelEl && labInfo.heroStat2Label) labStat2LabelEl.textContent = labInfo.heroStat2Label;

    const labStat3NumEl = document.getElementById('labHeroStat3Num');
    if (labStat3NumEl && labInfo.heroStat3Num) labStat3NumEl.textContent = labInfo.heroStat3Num;
    const labStat3LabelEl = document.getElementById('labHeroStat3Label');
    if (labStat3LabelEl && labInfo.heroStat3Label) labStat3LabelEl.textContent = labInfo.heroStat3Label;

    // 04 LAB APPS 4 Cards (01〜04)
    for (let i = 1; i <= 4; i++) {
      const bEl = document.getElementById(`labCard${i}Badge`);
      if (bEl && labInfo[`card${i}Badge`]) bEl.textContent = labInfo[`card${i}Badge`];

      const enEl = document.getElementById(`labCard${i}En`);
      if (enEl && labInfo[`card${i}En`]) enEl.textContent = labInfo[`card${i}En`];

      const jaEl = document.getElementById(`labCard${i}Ja`);
      if (jaEl && labInfo[`card${i}Ja`]) jaEl.textContent = labInfo[`card${i}Ja`];

      const descEl = document.getElementById(`labCard${i}Desc`);
      if (descEl && labInfo[`card${i}Desc`]) descEl.innerHTML = this.escapeHtml(labInfo[`card${i}Desc`]).replace(/\n/g, '<br>');

      // HTML5ゲーム埋め込み窓枠（iframe）の制御（画面全開フルワイド表示）
      const gameWrap = document.getElementById(`labCard${i}GameContainer`);
      const gamePath = (labInfo[`card${i}GamePath`] || '').trim();
      if (gameWrap) {
        if (gamePath) {
          gameWrap.style.display = 'block';
          let iframe = gameWrap.querySelector('iframe');
          if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.className = 'app-game-iframe';
            iframe.setAttribute('src', gamePath);
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; midi; keyboard-map');
            iframe.setAttribute('allowfullscreen', '');
            iframe.allowFullscreen = true;
            iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals allow-forms');
            iframe.setAttribute('title', `${labInfo[`card${i}En`] || 'Game'} HTML5 Game`);
            gameWrap.appendChild(iframe);
          } else {
            iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; midi; keyboard-map');
            iframe.setAttribute('allowfullscreen', '');
            iframe.allowFullscreen = true;
            iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals allow-forms');
            if (iframe.getAttribute('src') !== gamePath) {
              iframe.src = gamePath;
            }
          }
          if (i === 1) {
            const closeBtn = document.getElementById('btnGameFullscreenClose');
            if (closeBtn) {
              gameWrap.appendChild(closeBtn);
            }
            iframe.addEventListener('load', () => {
              this.syncIframeOverlayButton(iframe);
            });
          }
        } else {
          gameWrap.style.display = 'none';
          gameWrap.innerHTML = '';
        }
      }

      const t1El = document.getElementById(`labCard${i}Tag1`);
      if (t1El && labInfo[`card${i}Tag1`]) t1El.textContent = labInfo[`card${i}Tag1`];

      const t2El = document.getElementById(`labCard${i}Tag2`);
      if (t2El && labInfo[`card${i}Tag2`]) t2El.textContent = labInfo[`card${i}Tag2`];

      const t3El = document.getElementById(`labCard${i}Tag3`);
      if (t3El && labInfo[`card${i}Tag3`]) t3El.textContent = labInfo[`card${i}Tag3`];

      const statusEl = document.getElementById(`labCard${i}Status`);
      if (statusEl && labInfo[`card${i}Status`]) statusEl.textContent = labInfo[`card${i}Status`];
    }

    // 5. FOOTER AREA
    const defaultFooterInfo = {
      title: 'MUSIC TECH LAB',
      logoTag: '最新アニソン&ゲーム音楽・ピアノCH',
      motto: 'Latest Anime & Game Music Meets Modern Piano Resonance.',
      copyright: '© 2025 MUSIC TECH LAB 【最新アニソン&ゲーム音楽・ピアノCH】. All Rights Reserved.',
      designedBy: 'Crafted for Cinematic Music Experiences'
    };

    let footerInfo = defaultFooterInfo;
    try {
      const savedFooter = localStorage.getItem('piano_cinema_custom_footer_info');
      if (savedFooter) {
        footerInfo = { ...defaultFooterInfo, ...JSON.parse(savedFooter) };
      }
    } catch (e) {
      console.warn('Failed to parse custom footer info:', e);
    }

    const footerChannelTitleEl = document.getElementById('footerChannelTitle');
    if (footerChannelTitleEl && footerInfo.title) {
      footerChannelTitleEl.textContent = footerInfo.title;
    }

    const footerLogoTagEl = document.getElementById('footerLogoTag');
    if (footerLogoTagEl && footerInfo.logoTag) {
      footerLogoTagEl.textContent = footerInfo.logoTag;
    }

    const footerMottoEl = document.getElementById('footerMotto');
    if (footerMottoEl && footerInfo.motto) {
      footerMottoEl.innerHTML = this.escapeHtml(footerInfo.motto).replace(/\n/g, '<br>');
    }

    const footerCopyrightEl = document.getElementById('footerCopyright');
    if (footerCopyrightEl && footerInfo.copyright) {
      footerCopyrightEl.innerHTML = this.escapeHtml(footerInfo.copyright).replace(/\n/g, '<br>');
    }

    const footerDesignedByEl = document.getElementById('footerDesignedBy');
    if (footerDesignedByEl && footerInfo.designedBy) {
      footerDesignedByEl.innerHTML = this.escapeHtml(footerInfo.designedBy).replace(/\n/g, '<br>');
    }
  }

  /**
   * 05 STORE セクションのテキスト・見出し・URLをDOMに反映
   */
  loadStoreTexts() {
    const defaultStoreInfo = {
      sectionDesc: '動画で使用しているオリジナルピアノ楽譜をPiascore（ピアスコア）にて好評配信中。\n購入後すぐにPDFでダウンロード＆印刷可能です。',
      bannerTitle: '動画を見ながら一緒に弾ける。',
      bannerHighlight: '公式オリジナルピアノ楽譜。',
      bannerDesc: '当チャンネルの動画内で演奏しているアレンジをそのまま完全再現したオリジナルピアノ楽譜です。国内最大級の楽譜配信プラットフォーム「Piascore」にて安全に即時ダウンロードいただけます。',
      publisherUrl: '',
      guideDesc: 'Piascoreで購入いただいた楽譜は、iPad・iPhone・Android・パソコンですぐに閲覧・印刷いただけます。Piascoreアプリの自動譜めくり機能や書き込み機能にも完全対応しています。'
    };

    let storeInfo = defaultStoreInfo;
    try {
      const saved = localStorage.getItem('piano_cinema_custom_store_info');
      if (saved) {
        storeInfo = { ...defaultStoreInfo, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse custom store info:', e);
    }

    const sectionDescEl = document.getElementById('storeSectionDesc');
    if (sectionDescEl && storeInfo.sectionDesc) {
      sectionDescEl.innerHTML = this.escapeHtml(storeInfo.sectionDesc).replace(/\n/g, '<br>');
    }

    const bannerTitleEl = document.getElementById('storeBannerTitle');
    if (bannerTitleEl) {
      bannerTitleEl.innerHTML = `${this.escapeHtml(storeInfo.bannerTitle || '動画を見ながら一緒に弾ける。')}<br><span class="gold-gradient-text">${this.escapeHtml(storeInfo.bannerHighlight || '公式オリジナルピアノ楽譜。')}</span>`;
    }

    const bannerDescEl = document.getElementById('storeBannerDesc');
    if (bannerDescEl && storeInfo.bannerDesc) {
      bannerDescEl.textContent = storeInfo.bannerDesc;
    }

    const piascoreBtn = document.getElementById('piascorePublisherBtn');
    if (piascoreBtn) {
      piascoreBtn.href = storeInfo.publisherUrl || '#';
    }

    const storeGuideDescEl = document.getElementById('storeGuideDesc');
    if (storeGuideDescEl && storeInfo.guideDesc) {
      storeGuideDescEl.innerHTML = this.escapeHtml(storeInfo.guideDesc).replace(/\n/g, '<br>');
    }
  }

  /**
   * 06 PROFILE（プロフィール）テキストをDOMに反映
   */
  loadProfileTexts() {
    const defaultProfileInfo = {
      topText: 'プロフィール上部テキスト（ここへ1列目の文章が入ります）',
      bottomText1: 'プロフィール下部テキスト1',
      bottomText2: 'プロフィール下部テキスト2'
    };

    let profileInfo = defaultProfileInfo;
    try {
      const savedProfile = localStorage.getItem('piano_cinema_custom_profile_info');
      if (savedProfile) {
        profileInfo = { ...defaultProfileInfo, ...JSON.parse(savedProfile) };
      }
    } catch (e) {
      console.warn('Failed to parse custom profile info:', e);
    }

    const topTextEl = document.getElementById('profileTopText');
    if (topTextEl && profileInfo.topText !== undefined) {
      topTextEl.innerHTML = this.escapeHtml(profileInfo.topText).replace(/\n/g, '<br>');
    }

    const bottomText1El = document.getElementById('profileBottomText1');
    if (bottomText1El && profileInfo.bottomText1 !== undefined) {
      bottomText1El.innerHTML = this.escapeHtml(profileInfo.bottomText1).replace(/\n/g, '<br>');
    }

    const bottomText2El = document.getElementById('profileBottomText2');
    if (bottomText2El && profileInfo.bottomText2 !== undefined) {
      bottomText2El.innerHTML = this.escapeHtml(profileInfo.bottomText2).replace(/\n/g, '<br>');
    }
  }

  /**
   * 新曲リクエストエリア（説明文・STATUS凡例）テキストをDOMに反映
   */
  loadRequestTexts() {
    const defaultRequestInfo = {
      mainTitle: 'アニメ改変期！新曲リクエスト祭り',
      deadline: '【投票期限】〇月〇日 23:59 まで',
      rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: 30,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25,
      songs: [
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
      ]
    };

    let requestInfo = defaultRequestInfo;
    try {
      const saved = localStorage.getItem('piano_cinema_custom_request_info');
      if (saved) {
        requestInfo = { ...defaultRequestInfo, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse custom request info:', e);
    }

    const mainTitleEl = document.getElementById('requestMainTitle');
    if (mainTitleEl && requestInfo.mainTitle !== undefined) {
      mainTitleEl.textContent = requestInfo.mainTitle;
    }

    const deadlineEl = document.getElementById('requestDeadlineText');
    if (deadlineEl && requestInfo.deadline !== undefined) {
      deadlineEl.textContent = requestInfo.deadline;
    }

    const ruleEl = document.getElementById('requestRuleText');
    if (ruleEl && requestInfo.rule !== undefined) {
      ruleEl.innerHTML = this.escapeHtml(requestInfo.rule).replace(/\n/g, '<br>');
    }

    const noteEl = document.getElementById('requestNoteText');
    if (noteEl && requestInfo.note !== undefined) {
      noteEl.innerHTML = this.escapeHtml(requestInfo.note).replace(/\n/g, '<br>');
    }

    // 12曲の曲名テキストのDOM反映
    const songs = Array.isArray(requestInfo.songs) && requestInfo.songs.length >= 12
      ? requestInfo.songs
      : defaultRequestInfo.songs;
    for (let i = 1; i <= 12; i++) {
      const songTitleEl = document.getElementById(`requestSongTitle${i}`);
      const val = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
      if (songTitleEl) {
        songTitleEl.textContent = val;
        songTitleEl.setAttribute('title', val);
      }
    }

    const renderLegendList = (containerId, text) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      const dotColors = ['dot-green', 'dot-orange', 'dot-red', 'dot-green', 'dot-orange'];
      let listHtml = `<div class="legend-card-header">STATUS</div><ul class="legend-list">`;
      lines.forEach((line, idx) => {
        let dotClass = dotColors[idx % dotColors.length];
        if (line.includes('緑') || line.includes('green') || line.includes('Green')) dotClass = 'dot-green';
        else if (line.includes('橙') || line.includes('オレンジ') || line.includes('orange') || line.includes('Orange') || line.includes('黄')) dotClass = 'dot-orange';
        else if (line.includes('赤') || line.includes('red') || line.includes('Red')) dotClass = 'dot-red';
        listHtml += `
          <li class="legend-item">
            <span class="legend-dot ${dotClass}"></span>
            <span class="legend-text">${this.escapeHtml(line)}</span>
          </li>`;
      });
      listHtml += `</ul>`;
      container.innerHTML = listHtml;
    };

    renderLegendList('requestLegendLeft', requestInfo.legendLeft);
    renderLegendList('requestLegendRight', requestInfo.legendRight);

    // 全スロットのグラフ・数字・色・ゴール状態を更新
    this.updateAllRequestSlots();
  }

  /**
   * 新曲リクエスト投票・グラフ連動システムの初期化
   */
  /**
   * 新曲リクエスト投票・グラフ連動システムの初期化
   */
  initRequestSection() {
    for (let i = 1; i <= 12; i++) {
      const btn = document.getElementById(`requestBtn${i}`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRequestVote(i);
        });
      }
    }

    // 管理パネルの数値入力欄（目標数、1日最大投票数、1メモリ票数、第1/第2CP）のリアルタイム変更リスナー＆即座同期
    const numericInputIds = ['popRequestGoalCount', 'popRequestDailyLimit', 'popRequestStepCount', 'popRequestCheckpoint1', 'popRequestCheckpoint2'];
    numericInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          try {
            const saved = localStorage.getItem('piano_cinema_custom_request_info');
            const info = saved ? JSON.parse(saved) : {};
            info.goalCount = Number(document.getElementById('popRequestGoalCount')?.value) || 30;
            info.dailyLimit = Number(document.getElementById('popRequestDailyLimit')?.value) || 1;
            info.stepCount = Number(document.getElementById('popRequestStepCount')?.value) || 1;
            info.checkpoint1 = Number(document.getElementById('popRequestCheckpoint1')?.value) || 10;
            info.checkpoint2 = Number(document.getElementById('popRequestCheckpoint2')?.value) || 25;
            localStorage.setItem('piano_cinema_custom_request_info', JSON.stringify(info));
            this.syncToServer({ piano_cinema_custom_request_info: info });
          } catch (e) {}
          this.updateAllRequestSlots();
        });
      }
    });

    // タブ復帰時や日付変更時に自動で投票ロック状態を再評価
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateAllRequestSlots();
      }
    });

    this.updateAllRequestSlots();
  }

  /**
   * 本日投票されたタイムスタンプ配列を取得（日付が変わるか24時間経過した古い履歴は除外）
   */
  getTodayVoteHistory() {
    try {
      const saved = localStorage.getItem('piano_cinema_request_vote_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const now = new Date();

      let timestamps = [];
      if (Array.isArray(parsed)) {
        timestamps = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        timestamps = Object.values(parsed).filter(v => typeof v === 'number');
      }

      // 年・月・日が同一 かつ 24時間以内のタイムスタンプのみを抽出
      return timestamps.filter(ts => {
        const voteDate = new Date(ts);
        const isSameDate = (
          voteDate.getFullYear() === now.getFullYear() &&
          voteDate.getMonth() === now.getMonth() &&
          voteDate.getDate() === now.getDate()
        );
        const isWithin24Hours = (now.getTime() - voteDate.getTime()) < 24 * 60 * 60 * 1000;
        return isSameDate && isWithin24Hours;
      });
    } catch (e) {
      console.warn('Failed to check today vote history:', e);
      return [];
    }
  }

  /**
   * ユーザーが本日投票できる上限数（1日の最大投票数）に達しているかどうかを判定
   */
  isDailyLimitReached() {
    const config = this.getRequestConfig();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    const todayVotes = this.getTodayVoteHistory();
    return todayVotes.length >= dailyLimit;
  }

  /**
   * 投票完了タイムスタンプを保存
   */
  recordVote() {
    try {
      const todayVotes = this.getTodayVoteHistory();
      todayVotes.push(Date.now());
      localStorage.setItem('piano_cinema_request_vote_history', JSON.stringify(todayVotes));
    } catch (e) {
      console.warn('Failed to record vote history:', e);
    }
  }

  /**
   * 投票データの取得（デバッグ用・12曲分の配列）
   */
  getStoredVotes() {
    const defaultVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      const saved = localStorage.getItem('piano_cinema_request_votes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 12) {
          return parsed.map(v => Number(v) || 0);
        }
      }
    } catch (e) {
      console.warn('Failed to parse request votes:', e);
    }
    return defaultVotes;
  }

  /**
   * リクエスト設定値（目標数・1日最大投票数・1メモリ票数・第1/第2チェックポイント）の確実なリアルタイム取得
   */
  getRequestConfig() {
    const defaultConfig = {
      goalCount: 30,
      dailyLimit: 1,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25
    };

    let config = { ...defaultConfig };

    // 1. ローカルストレージに保存された設定値を最優先取得
    try {
      const saved = localStorage.getItem('piano_cinema_custom_request_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.goalCount !== undefined && parsed.goalCount !== '') config.goalCount = Number(parsed.goalCount);
        if (parsed.dailyLimit !== undefined && parsed.dailyLimit !== '') config.dailyLimit = Number(parsed.dailyLimit);
        if (parsed.stepCount !== undefined && parsed.stepCount !== '') config.stepCount = Number(parsed.stepCount);
        if (parsed.checkpoint1 !== undefined && parsed.checkpoint1 !== '') config.checkpoint1 = Number(parsed.checkpoint1);
        if (parsed.checkpoint2 !== undefined && parsed.checkpoint2 !== '') config.checkpoint2 = Number(parsed.checkpoint2);
      }
    } catch (e) {
      console.warn('Failed to parse request config:', e);
    }

    // 2. 管理画面モーダルが開いており編集中である場合のみ、DOMの入力値を即時反映
    const isAdminActive = this.adminModal?.classList.contains('is-active');
    if (isAdminActive) {
      const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === '' || el.value === null || el.value === undefined) return null;
        const num = Number(el.value);
        return (!isNaN(num) && num > 0) ? num : null;
      };

      const domGoal = getVal('popRequestGoalCount');
      if (domGoal !== null) config.goalCount = domGoal;
      const domDaily = getVal('popRequestDailyLimit');
      if (domDaily !== null) config.dailyLimit = domDaily;
      const domStep = getVal('popRequestStepCount');
      if (domStep !== null) config.stepCount = domStep;
      const domCp1 = getVal('popRequestCheckpoint1');
      if (domCp1 !== null) config.checkpoint1 = domCp1;
      const domCp2 = getVal('popRequestCheckpoint2');
      if (domCp2 !== null) config.checkpoint2 = domCp2;
    }

    // 3. 安全性のための正規化
    config.goalCount = Math.max(1, Number(config.goalCount) || 30);
    config.dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    config.stepCount = Math.max(1, Number(config.stepCount) || 1);
    config.checkpoint1 = Math.max(1, Number(config.checkpoint1) || 10);
    config.checkpoint2 = Math.max(1, Number(config.checkpoint2) || 25);

    return config;
  }

  /**
   * 投票クリックハンドラ（本番用：1日の最大投票数ロック）
   */
  handleRequestVote(slotIndex) {
    const config = this.getRequestConfig();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);

    // 1. 本日の最大投票数に達しているかチェック（1日の最大投票数制限ガード）
    if (this.isDailyLimitReached()) {
      const btn = document.getElementById(`requestBtn${slotIndex}`);
      if (btn) {
        btn.classList.remove('btn-voted-shake');
        void btn.offsetWidth;
        btn.classList.add('btn-voted-shake');
        setTimeout(() => btn.classList.remove('btn-voted-shake'), 400);
      }
      this.showToast(`ℹ️ 本日の投票上限（${dailyLimit}回）に達しています。また明日投票をお願いします！`);
      return;
    }

    // 2. 投票履歴を記録（1回分カウント）
    this.recordVote();

    // 3. 投票数の加算と保存
    const votes = this.getStoredVotes();
    const prevCount = votes[slotIndex - 1] || 0;
    const current = prevCount + 1;
    votes[slotIndex - 1] = current;
    localStorage.setItem('piano_cinema_request_votes', JSON.stringify(votes));
    this.syncToServer({ piano_cinema_request_votes: votes });

    const goal = Math.max(1, config.goalCount || 30);
    const isJustReachedGoal = (prevCount < goal && current >= goal);

    // 4. 効果音（SE）の再生（通常時: se/click.mp3 / 目標到達ジャスト時: se/complete.mp3 ＆ ボリューム完全連動）
    try {
      if (isJustReachedGoal) {
        // 目標達成の瞬間：おめでたい派手な達成効果音（se/complete.mp3 約2秒間）
        if (this.soundEngine && typeof this.soundEngine.playCompleteSound === 'function') {
          this.soundEngine.playCompleteSound('se/complete.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/complete.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      } else {
        // 通常の投票時：心地よい「ポチッ」クリック音（se/click.mp3）
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/click.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Sound error on request vote:', err);
    }

    // 5. カウンター数字の弾けるアニメーション
    const countEl = document.getElementById(`requestCountNum${slotIndex}`);
    if (countEl) {
      countEl.classList.remove('count-pop');
      void countEl.offsetWidth; // リフロー強制で連続アニメーション可能に
      countEl.classList.add('count-pop');
      setTimeout(() => countEl.classList.remove('count-pop'), 200);
    }

    // 6. 全スロット（すべてのボタンのロック状態・数字・グラフ・ゴール演出）のリアルタイム更新
    this.updateAllRequestSlots();

    // 7. 投票完了トースト通知（目標達成時は祝福トースト）
    if (isJustReachedGoal) {
      this.showToast('🎉 リクエスト目標達成！「制作決定！」が確定しました！');
    } else {
      const todayVotes = this.getTodayVoteHistory();
      const remaining = Math.max(0, dailyLimit - todayVotes.length);
      if (remaining > 0) {
        this.showToast(`✨ リクエスト投票完了！（本日あと ${remaining} 票可能）`);
      } else {
        this.showToast(`✨ リクエスト投票を受け付けました！（本日の上限 ${dailyLimit} 票達成）`);
      }
    }
  }

  /**
   * 単一スロットの表示（数値・グラフ高さ・色・ゴール演出・投票ボタン状態）を更新
   */
  updateRequestSlot(slotIndex, count = null) {
    if (count === null) {
      const votes = this.getStoredVotes();
      count = votes[slotIndex - 1] || 0;
    }

    const config = this.getRequestConfig();
    const goal = Math.max(1, config.goalCount || 30);
    const dailyLimit = Math.max(1, config.dailyLimit || 1);
    const step = Math.max(1, config.stepCount || 1);
    const cp1 = config.checkpoint1 || 10;
    const cp2 = config.checkpoint2 || 25;

    // 1. カウンター数字の更新（愚直にクリックごとの正確な投票数）
    const countEl = document.getElementById(`requestCountNum${slotIndex}`);
    if (countEl) {
      countEl.textContent = count;
    }

    // 2. 投票ボタンの本日投票上限ロック状態の反映
    const btn = document.getElementById(`requestBtn${slotIndex}`);
    if (btn) {
      const isLocked = this.isDailyLimitReached();
      if (isLocked) {
        btn.classList.add('is-voted');
        btn.setAttribute('title', `本日の投票枠（${dailyLimit}回）はすべて完了しています`);
      } else {
        btn.classList.remove('is-voted');
        btn.setAttribute('title', `この曲にリクエスト投票する（1日${dailyLimit}回まで）`);
      }
    }

    // 3. グラフ高さの計算（ブロック積み上げ式：現在の投票数 ÷ 1メモリあたりの票数 の小数点切り捨て）
    const barFillEl = document.getElementById(`requestBarFill${slotIndex}`);
    const barTrackEl = document.getElementById(`requestBarTrack${slotIndex}`);
    const goalBadgeEl = document.getElementById(`requestGoalBadge${slotIndex}`);

    let heightPercent = 0;
    if (count >= goal) {
      heightPercent = 100;
    } else if (count > 0) {
      const completedBlocks = Math.floor(count / step);
      const totalBlocks = Math.ceil(goal / step);
      if (totalBlocks > 0) {
        heightPercent = (completedBlocks / totalBlocks) * 100;
      }
      heightPercent = Math.min(100, Math.max(0, heightPercent));
    }

    if (barFillEl) {
      barFillEl.style.height = `${heightPercent}%`;
    }

    // 4. 色変化とゴール演出（裏の管理パネルの数値と100%完全一致判定）
    if (barFillEl) {
      barFillEl.classList.remove('fill-green', 'fill-orange', 'fill-red', 'fill-goal');
    }
    if (barTrackEl) {
      barTrackEl.classList.remove('is-goal');
    }
    if (goalBadgeEl) {
      goalBadgeEl.classList.remove('is-visible');
    }

    if (count >= goal) {
      // 目標到達（裏の目標リクエスト数到達時）：ピカピカ点滅 ＆ 制作決定バナー出現
      barFillEl?.classList.add('fill-goal');
      barTrackEl?.classList.add('is-goal');
      goalBadgeEl?.classList.add('is-visible');
    } else if (count >= cp2) {
      // 第2チェックポイント到達：燃えるような赤
      barFillEl?.classList.add('fill-red');
    } else if (count >= cp1) {
      // 第1チェックポイント到達：オレンジ
      barFillEl?.classList.add('fill-orange');
    } else {
      // 初期状態（第1CP未満）：緑
      barFillEl?.classList.add('fill-green');
    }
  }

  /**
   * 全12スロットの表示を一括更新
   */
  updateAllRequestSlots() {
    const votes = this.getStoredVotes();
    for (let i = 1; i <= 12; i++) {
      this.updateRequestSlot(i, votes[i - 1] || 0);
    }
  }

  /**
   * 第2弾新曲リクエストエリア（説明文・STATUS凡例）テキストをDOMに反映
   */
  loadRequest2Texts() {
    const defaultRequest2Info = {
      mainTitle: '名曲発掘！第2弾リクエスト祭り',
      deadline: '【投票期限】〇月〇日 23:59 まで',
      rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: 30,
      dailyLimit: 1,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25,
      songs: [
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
      ]
    };

    let requestInfo = defaultRequest2Info;
    try {
      const saved = localStorage.getItem('piano_cinema_custom_request2_info');
      if (saved) {
        requestInfo = { ...defaultRequest2Info, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse custom request2 info:', e);
    }

    const mainTitleEl = document.getElementById('request2MainTitle');
    if (mainTitleEl && requestInfo.mainTitle !== undefined) {
      mainTitleEl.textContent = requestInfo.mainTitle;
    }

    const deadlineEl = document.getElementById('request2DeadlineText');
    if (deadlineEl && requestInfo.deadline !== undefined) {
      deadlineEl.textContent = requestInfo.deadline;
    }

    const ruleEl = document.getElementById('request2RuleText');
    if (ruleEl && requestInfo.rule !== undefined) {
      ruleEl.innerHTML = this.escapeHtml(requestInfo.rule).replace(/\n/g, '<br>');
    }

    const noteEl = document.getElementById('request2NoteText');
    if (noteEl && requestInfo.note !== undefined) {
      noteEl.innerHTML = this.escapeHtml(requestInfo.note).replace(/\n/g, '<br>');
    }

    // 12曲の曲名テキストのDOM反映
    const songs = Array.isArray(requestInfo.songs) && requestInfo.songs.length >= 12
      ? requestInfo.songs
      : defaultRequest2Info.songs;
    for (let i = 1; i <= 12; i++) {
      const songTitleEl = document.getElementById(`request2SongTitle${i}`);
      const val = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
      if (songTitleEl) {
        songTitleEl.textContent = val;
        songTitleEl.setAttribute('title', val);
      }
    }

    const renderLegendList = (containerId, text) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      const dotColors = ['dot-green', 'dot-orange', 'dot-red', 'dot-green', 'dot-orange'];
      let listHtml = `<div class="legend-card-header">STATUS</div><ul class="legend-list">`;
      lines.forEach((line, idx) => {
        let dotClass = dotColors[idx % dotColors.length];
        if (line.includes('緑') || line.includes('green') || line.includes('Green')) dotClass = 'dot-green';
        else if (line.includes('橙') || line.includes('オレンジ') || line.includes('orange') || line.includes('Orange') || line.includes('黄')) dotClass = 'dot-orange';
        else if (line.includes('赤') || line.includes('red') || line.includes('Red')) dotClass = 'dot-red';
        listHtml += `
          <li class="legend-item">
            <span class="legend-dot ${dotClass}"></span>
            <span class="legend-text">${this.escapeHtml(line)}</span>
          </li>`;
      });
      listHtml += `</ul>`;
      container.innerHTML = listHtml;
    };

    renderLegendList('request2LegendLeft', requestInfo.legendLeft);
    renderLegendList('request2LegendRight', requestInfo.legendRight);

    // 全スロットのグラフ・数字・色・ゴール状態を更新
    this.updateAllRequest2Slots();
  }

  /**
   * 第2弾新曲リクエスト投票・グラフ連動システムの初期化
   */
  initRequest2Section() {
    for (let i = 1; i <= 12; i++) {
      const btn = document.getElementById(`request2Btn${i}`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRequest2Vote(i);
        });
      }
    }

    // 管理パネルの数値入力欄のリアルタイム変更リスナー＆即座同期
    const numericInputIds = ['popRequest2GoalCount', 'popRequest2DailyLimit', 'popRequest2StepCount', 'popRequest2Checkpoint1', 'popRequest2Checkpoint2'];
    numericInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          try {
            const saved = localStorage.getItem('piano_cinema_custom_request2_info');
            const info = saved ? JSON.parse(saved) : {};
            info.goalCount = Number(document.getElementById('popRequest2GoalCount')?.value) || 30;
            info.dailyLimit = Number(document.getElementById('popRequest2DailyLimit')?.value) || 1;
            info.stepCount = Number(document.getElementById('popRequest2StepCount')?.value) || 1;
            info.checkpoint1 = Number(document.getElementById('popRequest2Checkpoint1')?.value) || 10;
            info.checkpoint2 = Number(document.getElementById('popRequest2Checkpoint2')?.value) || 25;
            localStorage.setItem('piano_cinema_custom_request2_info', JSON.stringify(info));
            this.syncToServer({ piano_cinema_custom_request2_info: info });
          } catch (e) {}
          this.updateAllRequest2Slots();
        });
      }
    });

    // タブ復帰時や日付変更時に自動で投票ロック状態を再評価
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateAllRequest2Slots();
      }
    });

    this.updateAllRequest2Slots();
  }

  /**
   * 第2弾：本日投票されたタイムスタンプ配列を取得
   */
  getTodayVoteHistory2() {
    try {
      const saved = localStorage.getItem('piano_cinema_request2_vote_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const now = new Date();

      let timestamps = [];
      if (Array.isArray(parsed)) {
        timestamps = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        timestamps = Object.values(parsed).filter(v => typeof v === 'number');
      }

      return timestamps.filter(ts => {
        const voteDate = new Date(ts);
        const isSameDate = (
          voteDate.getFullYear() === now.getFullYear() &&
          voteDate.getMonth() === now.getMonth() &&
          voteDate.getDate() === now.getDate()
        );
        const isWithin24Hours = (now.getTime() - voteDate.getTime()) < 24 * 60 * 60 * 1000;
        return isSameDate && isWithin24Hours;
      });
    } catch (e) {
      console.warn('Failed to check today vote history 2:', e);
      return [];
    }
  }

  /**
   * 第2弾：ユーザーが本日投票できる上限数に達しているかどうかを判定
   */
  isDailyLimitReached2() {
    const config = this.getRequest2Config();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    const todayVotes = this.getTodayVoteHistory2();
    return todayVotes.length >= dailyLimit;
  }

  /**
   * 第2弾：投票完了タイムスタンプを保存
   */
  recordVote2() {
    try {
      const todayVotes = this.getTodayVoteHistory2();
      todayVotes.push(Date.now());
      localStorage.setItem('piano_cinema_request2_vote_history', JSON.stringify(todayVotes));
    } catch (e) {
      console.warn('Failed to record vote history 2:', e);
    }
  }

  /**
   * 第2弾：投票データの取得
   */
  getStoredVotes2() {
    const defaultVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      const saved = localStorage.getItem('piano_cinema_request2_votes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 12) {
          return parsed.map(v => Number(v) || 0);
        }
      }
    } catch (e) {
      console.warn('Failed to parse request2 votes:', e);
    }
    return defaultVotes;
  }

  /**
   * 第2弾：リクエスト設定値のリアルタイム取得
   */
  getRequest2Config() {
    const defaultConfig = {
      goalCount: 30,
      dailyLimit: 1,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25
    };

    let config = { ...defaultConfig };

    try {
      const saved = localStorage.getItem('piano_cinema_custom_request2_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.goalCount !== undefined && parsed.goalCount !== '') config.goalCount = Number(parsed.goalCount);
        if (parsed.dailyLimit !== undefined && parsed.dailyLimit !== '') config.dailyLimit = Number(parsed.dailyLimit);
        if (parsed.stepCount !== undefined && parsed.stepCount !== '') config.stepCount = Number(parsed.stepCount);
        if (parsed.checkpoint1 !== undefined && parsed.checkpoint1 !== '') config.checkpoint1 = Number(parsed.checkpoint1);
        if (parsed.checkpoint2 !== undefined && parsed.checkpoint2 !== '') config.checkpoint2 = Number(parsed.checkpoint2);
      }
    } catch (e) {
      console.warn('Failed to parse request2 config:', e);
    }

    // 2. 管理画面モーダルが開いており編集中である場合のみ、DOMの入力値を即時反映
    const isAdminActive = this.adminModal?.classList.contains('is-active');
    if (isAdminActive) {
      const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === '' || el.value === null || el.value === undefined) return null;
        const num = Number(el.value);
        return (!isNaN(num) && num > 0) ? num : null;
      };

      const domGoal = getVal('popRequest2GoalCount');
      if (domGoal !== null) config.goalCount = domGoal;
      const domDaily = getVal('popRequest2DailyLimit');
      if (domDaily !== null) config.dailyLimit = domDaily;
      const domStep = getVal('popRequest2StepCount');
      if (domStep !== null) config.stepCount = domStep;
      const domCp1 = getVal('popRequest2Checkpoint1');
      if (domCp1 !== null) config.checkpoint1 = domCp1;
      const domCp2 = getVal('popRequest2Checkpoint2');
      if (domCp2 !== null) config.checkpoint2 = domCp2;
    }

    config.goalCount = Math.max(1, Number(config.goalCount) || 30);
    config.dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    config.stepCount = Math.max(1, Number(config.stepCount) || 1);
    config.checkpoint1 = Math.max(1, Number(config.checkpoint1) || 10);
    config.checkpoint2 = Math.max(1, Number(config.checkpoint2) || 25);

    return config;
  }

  /**
   * 第2弾：投票クリックハンドラ
   */
  handleRequest2Vote(slotIndex) {
    const config = this.getRequest2Config();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);

    // 1. 本日の最大投票数に達しているかチェック
    if (this.isDailyLimitReached2()) {
      const btn = document.getElementById(`request2Btn${slotIndex}`);
      if (btn) {
        btn.classList.remove('btn-voted-shake');
        void btn.offsetWidth;
        btn.classList.add('btn-voted-shake');
        setTimeout(() => btn.classList.remove('btn-voted-shake'), 400);
      }
      this.showToast(`ℹ️ 第2弾リクエストの本日の投票上限（${dailyLimit}回）に達しています。また明日投票をお願いします！`);
      return;
    }

    // 2. 投票履歴を記録
    this.recordVote2();

    // 3. 投票数の加算と保存
    const votes = this.getStoredVotes2();
    const prevCount = votes[slotIndex - 1] || 0;
    const current = prevCount + 1;
    votes[slotIndex - 1] = current;
    localStorage.setItem('piano_cinema_request2_votes', JSON.stringify(votes));
    this.syncToServer({ piano_cinema_request2_votes: votes });

    const goal = Math.max(1, config.goalCount || 30);
    const isJustReachedGoal = (prevCount < goal && current >= goal);

    // 4. 効果音（SE）の再生
    try {
      if (isJustReachedGoal) {
        if (this.soundEngine && typeof this.soundEngine.playCompleteSound === 'function') {
          this.soundEngine.playCompleteSound('se/complete.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/complete.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      } else {
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/click.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Sound error on request2 vote:', err);
    }

    // 5. カウンター数字のアニメーション
    const countEl = document.getElementById(`request2CountNum${slotIndex}`);
    if (countEl) {
      countEl.classList.remove('count-pop');
      void countEl.offsetWidth;
      countEl.classList.add('count-pop');
      setTimeout(() => countEl.classList.remove('count-pop'), 200);
    }

    // 6. 全スロットのリアルタイム更新
    this.updateAllRequest2Slots();

    // 7. 投票完了トースト通知
    if (isJustReachedGoal) {
      this.showToast('🎉 第2弾リクエスト目標達成！「制作決定！」が確定しました！');
    } else {
      const todayVotes = this.getTodayVoteHistory2();
      const remaining = Math.max(0, dailyLimit - todayVotes.length);
      if (remaining > 0) {
        this.showToast(`✨ 第2弾リクエスト投票完了！（本日あと ${remaining} 票可能）`);
      } else {
        this.showToast(`✨ 第2弾リクエスト投票を受け付けました！（本日の上限 ${dailyLimit} 票達成）`);
      }
    }
  }

  /**
   * 第2弾：単一スロットの表示を更新
   */
  updateRequest2Slot(slotIndex, count = null) {
    if (count === null) {
      const votes = this.getStoredVotes2();
      count = votes[slotIndex - 1] || 0;
    }

    const config = this.getRequest2Config();
    const goal = Math.max(1, config.goalCount || 30);
    const dailyLimit = Math.max(1, config.dailyLimit || 1);
    const step = Math.max(1, config.stepCount || 1);
    const cp1 = config.checkpoint1 || 10;
    const cp2 = config.checkpoint2 || 25;

    // 1. カウンター数字の更新
    const countEl = document.getElementById(`request2CountNum${slotIndex}`);
    if (countEl) {
      countEl.textContent = count;
    }

    // 2. 投票ボタンの本日投票上限ロック状態の反映
    const btn = document.getElementById(`request2Btn${slotIndex}`);
    if (btn) {
      const isLocked = this.isDailyLimitReached2();
      if (isLocked) {
        btn.classList.add('is-voted');
        btn.setAttribute('title', `本日の投票枠（${dailyLimit}回）はすべて完了しています`);
      } else {
        btn.classList.remove('is-voted');
        btn.setAttribute('title', `この曲にリクエスト投票する（1日${dailyLimit}回まで）`);
      }
    }

    // 3. グラフ高さの計算（ブロック積み上げ式）
    const barFillEl = document.getElementById(`request2BarFill${slotIndex}`);
    const barTrackEl = document.getElementById(`request2BarTrack${slotIndex}`);
    const goalBadgeEl = document.getElementById(`request2GoalBadge${slotIndex}`);

    let heightPercent = 0;
    if (count >= goal) {
      heightPercent = 100;
    } else if (count > 0) {
      const completedBlocks = Math.floor(count / step);
      const totalBlocks = Math.ceil(goal / step);
      if (totalBlocks > 0) {
        heightPercent = (completedBlocks / totalBlocks) * 100;
      }
      heightPercent = Math.min(100, Math.max(0, heightPercent));
    }

    if (barFillEl) {
      barFillEl.style.height = `${heightPercent}%`;
    }

    // 4. 色変化とゴール演出
    if (barFillEl) {
      barFillEl.classList.remove('fill-green', 'fill-orange', 'fill-red', 'fill-goal');
    }
    if (barTrackEl) {
      barTrackEl.classList.remove('is-goal');
    }
    if (goalBadgeEl) {
      goalBadgeEl.classList.remove('is-visible');
    }

    if (count >= goal) {
      barFillEl?.classList.add('fill-goal');
      barTrackEl?.classList.add('is-goal');
      goalBadgeEl?.classList.add('is-visible');
    } else if (count >= cp2) {
      barFillEl?.classList.add('fill-red');
    } else if (count >= cp1) {
      barFillEl?.classList.add('fill-orange');
    } else {
      barFillEl?.classList.add('fill-green');
    }
  }

  /**
   * 第2弾：全12スロットの表示を一括更新
   */
  updateAllRequest2Slots() {
    const votes = this.getStoredVotes2();
    for (let i = 1; i <= 12; i++) {
      this.updateRequest2Slot(i, votes[i - 1] || 0);
    }
  }

  /**
   * 第3弾新曲リクエストエリア（説明文・STATUS凡例）テキストをDOMに反映
   */
  loadRequest3Texts() {
    const defaultRequest3Info = {
      mainTitle: '熱狂リクエスト！第3弾リクエスト祭り',
      deadline: '【投票期限】〇月〇日 23:59 まで',
      rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: 30,
      dailyLimit: 1,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25,
      songs: [
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
        'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
      ]
    };

    let requestInfo = defaultRequest3Info;
    try {
      const saved = localStorage.getItem('piano_cinema_custom_request3_info');
      if (saved) {
        requestInfo = { ...defaultRequest3Info, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse custom request3 info:', e);
    }

    const mainTitleEl = document.getElementById('request3MainTitle');
    if (mainTitleEl && requestInfo.mainTitle !== undefined) {
      mainTitleEl.textContent = requestInfo.mainTitle;
    }

    const deadlineEl = document.getElementById('request3DeadlineText');
    if (deadlineEl && requestInfo.deadline !== undefined) {
      deadlineEl.textContent = requestInfo.deadline;
    }

    const ruleEl = document.getElementById('request3RuleText');
    if (ruleEl && requestInfo.rule !== undefined) {
      ruleEl.innerHTML = this.escapeHtml(requestInfo.rule).replace(/\n/g, '<br>');
    }

    const noteEl = document.getElementById('request3NoteText');
    if (noteEl && requestInfo.note !== undefined) {
      noteEl.innerHTML = this.escapeHtml(requestInfo.note).replace(/\n/g, '<br>');
    }

    // 12曲の曲名テキストのDOM反映
    const songs = Array.isArray(requestInfo.songs) && requestInfo.songs.length >= 12
      ? requestInfo.songs
      : defaultRequest3Info.songs;
    for (let i = 1; i <= 12; i++) {
      const songTitleEl = document.getElementById(`request3SongTitle${i}`);
      const val = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
      if (songTitleEl) {
        songTitleEl.textContent = val;
        songTitleEl.setAttribute('title', val);
      }
    }

    const renderLegendList = (containerId, text) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
      const dotColors = ['dot-green', 'dot-orange', 'dot-red', 'dot-green', 'dot-orange'];
      let listHtml = `<div class="legend-card-header">STATUS</div><ul class="legend-list">`;
      lines.forEach((line, idx) => {
        let dotClass = dotColors[idx % dotColors.length];
        if (line.includes('緑') || line.includes('green') || line.includes('Green')) dotClass = 'dot-green';
        else if (line.includes('橙') || line.includes('オレンジ') || line.includes('orange') || line.includes('Orange') || line.includes('黄')) dotClass = 'dot-orange';
        else if (line.includes('赤') || line.includes('red') || line.includes('Red')) dotClass = 'dot-red';
        listHtml += `
          <li class="legend-item">
            <span class="legend-dot ${dotClass}"></span>
            <span class="legend-text">${this.escapeHtml(line)}</span>
          </li>`;
      });
      listHtml += `</ul>`;
      container.innerHTML = listHtml;
    };

    renderLegendList('request3LegendLeft', requestInfo.legendLeft);
    renderLegendList('request3LegendRight', requestInfo.legendRight);

    // 全スロットのグラフ・数字・色・ゴール状態を更新
    this.updateAllRequest3Slots();
  }

  /**
   * 第3弾新曲リクエスト投票・グラフ連動システムの初期化
   */
  initRequest3Section() {
    for (let i = 1; i <= 12; i++) {
      const btn = document.getElementById(`request3Btn${i}`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRequest3Vote(i);
        });
      }
    }

    // 管理パネルの数値入力欄のリアルタイム変更リスナー＆即座同期
    const numericInputIds = ['popRequest3GoalCount', 'popRequest3DailyLimit', 'popRequest3StepCount', 'popRequest3Checkpoint1', 'popRequest3Checkpoint2'];
    numericInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          try {
            const saved = localStorage.getItem('piano_cinema_custom_request3_info');
            const info = saved ? JSON.parse(saved) : {};
            info.goalCount = Number(document.getElementById('popRequest3GoalCount')?.value) || 30;
            info.dailyLimit = Number(document.getElementById('popRequest3DailyLimit')?.value) || 1;
            info.stepCount = Number(document.getElementById('popRequest3StepCount')?.value) || 1;
            info.checkpoint1 = Number(document.getElementById('popRequest3Checkpoint1')?.value) || 10;
            info.checkpoint2 = Number(document.getElementById('popRequest3Checkpoint2')?.value) || 25;
            localStorage.setItem('piano_cinema_custom_request3_info', JSON.stringify(info));
            this.syncToServer({ piano_cinema_custom_request3_info: info });
          } catch (e) {}
          this.updateAllRequest3Slots();
        });
      }
    });

    // タブ復帰時や日付変更時に自動で投票ロック状態を再評価
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.updateAllRequest3Slots();
      }
    });

    this.updateAllRequest3Slots();
  }

  /**
   * 第3弾：本日投票されたタイムスタンプ配列を取得
   */
  getTodayVoteHistory3() {
    try {
      const saved = localStorage.getItem('piano_cinema_request3_vote_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const now = new Date();

      let timestamps = [];
      if (Array.isArray(parsed)) {
        timestamps = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        timestamps = Object.values(parsed).filter(v => typeof v === 'number');
      }

      return timestamps.filter(ts => {
        const voteDate = new Date(ts);
        const isSameDate = (
          voteDate.getFullYear() === now.getFullYear() &&
          voteDate.getMonth() === now.getMonth() &&
          voteDate.getDate() === now.getDate()
        );
        const isWithin24Hours = (now.getTime() - voteDate.getTime()) < 24 * 60 * 60 * 1000;
        return isSameDate && isWithin24Hours;
      });
    } catch (e) {
      console.warn('Failed to check today vote history 3:', e);
      return [];
    }
  }

  /**
   * 第3弾：ユーザーが本日投票できる上限数に達しているかどうかを判定
   */
  isDailyLimitReached3() {
    const config = this.getRequest3Config();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    const todayVotes = this.getTodayVoteHistory3();
    return todayVotes.length >= dailyLimit;
  }

  /**
   * 第3弾：投票完了タイムスタンプを保存
   */
  recordVote3() {
    try {
      const todayVotes = this.getTodayVoteHistory3();
      todayVotes.push(Date.now());
      localStorage.setItem('piano_cinema_request3_vote_history', JSON.stringify(todayVotes));
    } catch (e) {
      console.warn('Failed to record vote history 3:', e);
    }
  }

  /**
   * 第3弾：投票データの取得
   */
  getStoredVotes3() {
    const defaultVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    try {
      const saved = localStorage.getItem('piano_cinema_request3_votes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 12) {
          return parsed.map(v => Number(v) || 0);
        }
      }
    } catch (e) {
      console.warn('Failed to parse request3 votes:', e);
    }
    return defaultVotes;
  }

  /**
   * 第3弾：リクエスト設定値のリアルタイム取得
   */
  getRequest3Config() {
    const defaultConfig = {
      goalCount: 30,
      dailyLimit: 1,
      stepCount: 1,
      checkpoint1: 10,
      checkpoint2: 25
    };

    let config = { ...defaultConfig };

    try {
      const saved = localStorage.getItem('piano_cinema_custom_request3_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.goalCount !== undefined && parsed.goalCount !== '') config.goalCount = Number(parsed.goalCount);
        if (parsed.dailyLimit !== undefined && parsed.dailyLimit !== '') config.dailyLimit = Number(parsed.dailyLimit);
        if (parsed.stepCount !== undefined && parsed.stepCount !== '') config.stepCount = Number(parsed.stepCount);
        if (parsed.checkpoint1 !== undefined && parsed.checkpoint1 !== '') config.checkpoint1 = Number(parsed.checkpoint1);
        if (parsed.checkpoint2 !== undefined && parsed.checkpoint2 !== '') config.checkpoint2 = Number(parsed.checkpoint2);
      }
    } catch (e) {
      console.warn('Failed to parse request3 config:', e);
    }

    // 2. 管理画面モーダルが開いており編集中である場合のみ、DOMの入力値を即時反映
    const isAdminActive = this.adminModal?.classList.contains('is-active');
    if (isAdminActive) {
      const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value === '' || el.value === null || el.value === undefined) return null;
        const num = Number(el.value);
        return (!isNaN(num) && num > 0) ? num : null;
      };

      const domGoal = getVal('popRequest3GoalCount');
      if (domGoal !== null) config.goalCount = domGoal;
      const domDaily = getVal('popRequest3DailyLimit');
      if (domDaily !== null) config.dailyLimit = domDaily;
      const domStep = getVal('popRequest3StepCount');
      if (domStep !== null) config.stepCount = domStep;
      const domCp1 = getVal('popRequest3Checkpoint1');
      if (domCp1 !== null) config.checkpoint1 = domCp1;
      const domCp2 = getVal('popRequest3Checkpoint2');
      if (domCp2 !== null) config.checkpoint2 = domCp2;
    }

    config.goalCount = Math.max(1, Number(config.goalCount) || 30);
    config.dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);
    config.stepCount = Math.max(1, Number(config.stepCount) || 1);
    config.checkpoint1 = Math.max(1, Number(config.checkpoint1) || 10);
    config.checkpoint2 = Math.max(1, Number(config.checkpoint2) || 25);

    return config;
  }

  /**
   * 第3弾：投票クリックハンドラ
   */
  handleRequest3Vote(slotIndex) {
    const config = this.getRequest3Config();
    const dailyLimit = Math.max(1, Number(config.dailyLimit) || 1);

    // 1. 本日の最大投票数に達しているかチェック
    if (this.isDailyLimitReached3()) {
      const btn = document.getElementById(`request3Btn${slotIndex}`);
      if (btn) {
        btn.classList.remove('btn-voted-shake');
        void btn.offsetWidth;
        btn.classList.add('btn-voted-shake');
        setTimeout(() => btn.classList.remove('btn-voted-shake'), 400);
      }
      this.showToast(`ℹ️ 第3弾リクエストの本日の投票上限（${dailyLimit}回）に達しています。また明日投票をお願いします！`);
      return;
    }

    // 2. 投票履歴を記録
    this.recordVote3();

    // 3. 投票数の加算と保存
    const votes = this.getStoredVotes3();
    const prevCount = votes[slotIndex - 1] || 0;
    const current = prevCount + 1;
    votes[slotIndex - 1] = current;
    localStorage.setItem('piano_cinema_request3_votes', JSON.stringify(votes));
    this.syncToServer({ piano_cinema_request3_votes: votes });

    const goal = Math.max(1, config.goalCount || 30);
    const isJustReachedGoal = (prevCount < goal && current >= goal);

    // 4. 効果音（SE）の再生
    try {
      if (isJustReachedGoal) {
        if (this.soundEngine && typeof this.soundEngine.playCompleteSound === 'function') {
          this.soundEngine.playCompleteSound('se/complete.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/complete.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      } else {
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/click.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Sound error on request3 vote:', err);
    }

    // 5. カウンター数字のアニメーション
    const countEl = document.getElementById(`request3CountNum${slotIndex}`);
    if (countEl) {
      countEl.classList.remove('count-pop');
      void countEl.offsetWidth;
      countEl.classList.add('count-pop');
      setTimeout(() => countEl.classList.remove('count-pop'), 200);
    }

    // 6. 全スロットのリアルタイム更新
    this.updateAllRequest3Slots();

    // 7. 投票完了トースト通知
    if (isJustReachedGoal) {
      this.showToast('🎉 第3弾リクエスト目標達成！「制作決定！」が確定しました！');
    } else {
      const todayVotes = this.getTodayVoteHistory3();
      const remaining = Math.max(0, dailyLimit - todayVotes.length);
      if (remaining > 0) {
        this.showToast(`✨ 第3弾リクエスト投票完了！（本日あと ${remaining} 票可能）`);
      } else {
        this.showToast(`✨ 第3弾リクエスト投票を受け付けました！（本日の上限 ${dailyLimit} 票達成）`);
      }
    }
  }

  /**
   * 第3弾：単一スロットの表示を更新
   */
  updateRequest3Slot(slotIndex, count = null) {
    if (count === null) {
      const votes = this.getStoredVotes3();
      count = votes[slotIndex - 1] || 0;
    }

    const config = this.getRequest3Config();
    const goal = Math.max(1, config.goalCount || 30);
    const dailyLimit = Math.max(1, config.dailyLimit || 1);
    const step = Math.max(1, config.stepCount || 1);
    const cp1 = config.checkpoint1 || 10;
    const cp2 = config.checkpoint2 || 25;

    // 1. カウンター数字の更新
    const countEl = document.getElementById(`request3CountNum${slotIndex}`);
    if (countEl) {
      countEl.textContent = count;
    }

    // 2. 投票ボタンの本日投票上限ロック状態の反映
    const btn = document.getElementById(`request3Btn${slotIndex}`);
    if (btn) {
      const isLocked = this.isDailyLimitReached3();
      if (isLocked) {
        btn.classList.add('is-voted');
        btn.setAttribute('title', `本日の投票枠（${dailyLimit}回）はすべて完了しています`);
      } else {
        btn.classList.remove('is-voted');
        btn.setAttribute('title', `この曲にリクエスト投票する（1日${dailyLimit}回まで）`);
      }
    }

    // 3. グラフ高さの計算（ブロック積み上げ式）
    const barFillEl = document.getElementById(`request3BarFill${slotIndex}`);
    const barTrackEl = document.getElementById(`request3BarTrack${slotIndex}`);
    const goalBadgeEl = document.getElementById(`request3GoalBadge${slotIndex}`);

    let heightPercent = 0;
    if (count >= goal) {
      heightPercent = 100;
    } else if (count > 0) {
      const completedBlocks = Math.floor(count / step);
      const totalBlocks = Math.ceil(goal / step);
      if (totalBlocks > 0) {
        heightPercent = (completedBlocks / totalBlocks) * 100;
      }
      heightPercent = Math.min(100, Math.max(0, heightPercent));
    }

    if (barFillEl) {
      barFillEl.style.height = `${heightPercent}%`;
    }

    // 4. 色変化とゴール演出
    if (barFillEl) {
      barFillEl.classList.remove('fill-green', 'fill-orange', 'fill-red', 'fill-goal');
    }
    if (barTrackEl) {
      barTrackEl.classList.remove('is-goal');
    }
    if (goalBadgeEl) {
      goalBadgeEl.classList.remove('is-visible');
    }

    if (count >= goal) {
      barFillEl?.classList.add('fill-goal');
      barTrackEl?.classList.add('is-goal');
      goalBadgeEl?.classList.add('is-visible');
    } else if (count >= cp2) {
      barFillEl?.classList.add('fill-red');
    } else if (count >= cp1) {
      barFillEl?.classList.add('fill-orange');
    } else {
      barFillEl?.classList.add('fill-green');
    }
  }

  /**
   * 第3弾：全12スロットの表示を一括更新
   */
  updateAllRequest3Slots() {
    const votes = this.getStoredVotes3();
    for (let i = 1; i <= 12; i++) {
      this.updateRequest3Slot(i, votes[i - 1] || 0);
    }
  }

  /**
   * 楽譜販売（05 STORE）カード群をDOMに生成
   */
  loadSheetMusic() {
    const grid = document.getElementById('sheetMusicGrid');
    if (!grid) return;

    let sheets = [];
    try {
      const saved = localStorage.getItem('piano_cinema_custom_sheets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) sheets = parsed;
      }
    } catch (e) {
      console.warn('Failed to parse custom sheets:', e);
    }

    if (!sheets || sheets.length === 0) {
      sheets = window.DEMO_DATA?.sheets || [];
    }

    // 5番目セクション（05 STORE）：最新の3個（横3個×1段）のみを表示
    const displaySheets = sheets.slice(0, 3);

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    displaySheets.forEach((sheet) => {
      const card = document.createElement('div');
      card.className = 'sheet-card';
      card.setAttribute('data-magnetic', '');

      const tagClass = sheet.tagType || 'hot';
      const tagText = sheet.tag || 'HOT';

      card.innerHTML = `
        <div class="sheet-thumb-box">
          <img src="${sheet.thumbnail || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop'}" alt="${this.escapeHtml(sheet.title)} ピアノ楽譜" class="sheet-thumb-img" loading="lazy">
          <div class="sheet-badge-overlay">
            <span class="sheet-tag-pill ${tagClass}">${this.escapeHtml(tagText)}</span>
            <span class="sheet-format-pill">PDF</span>
          </div>
        </div>
        <div class="sheet-card-body">
          <span class="sheet-category">${this.escapeHtml(sheet.workTitle || 'PIASCORE SHEET')}</span>
          <h3 class="sheet-title" style="color: ${this.escapeHtml(sheet.titleColor || '#ffffff')}; white-space: pre-wrap;">${this.escapeHtml(sheet.title)}</h3>
          <p class="sheet-desc">${this.escapeHtml(sheet.description || '').replace(/\r?\n/g, '<br>')}</p>
          <div class="sheet-card-footer">
            <div class="sheet-price">
              <span class="price-currency">${sheet.currency || '¥'}</span>
              <span class="price-val">${sheet.price || '440'}</span>
              <span class="price-tax">${sheet.taxIncluded !== false ? '(税込)' : ''}</span>
            </div>
            <a href="${sheet.storeUrl || '#'}" target="_blank" rel="noopener noreferrer" class="btn-buy-piascore" data-magnetic>
              <span>Piascoreで購入</span>
              <i data-lucide="external-link"></i>
            </a>
          </div>
        </div>
      `;
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    this.refreshIcons();
    this.soundEngine?.bindHoverSoundElements();
  }

  /**
   * ヘッダーのステータスバッジや統計数値を更新
   */
  updateHeaderAndStats(initResult) {
    const badge = document.getElementById('apiStatusBadge');
    const statusText = document.getElementById('statusText');
    const navChannelTitle = document.getElementById('navChannelTitle');
    const footerChannelTitle = document.getElementById('footerChannelTitle');
    const statementArtistName = document.getElementById('statementArtistName');
    const youtubeChannelLink = document.getElementById('youtubeChannelLink');
    const heroTotalVideos = document.getElementById('heroTotalVideos');

    const channel = this.youtubeService.channelInfo;
    if (channel) {
      const hasCustomHeader = localStorage.getItem('piano_cinema_custom_header_info');
      if (!hasCustomHeader && navChannelTitle) navChannelTitle.textContent = channel.title || 'MUSIC TECH LAB';
      const hasCustomFooter = localStorage.getItem('piano_cinema_custom_footer_info');
      if (!hasCustomFooter && footerChannelTitle) footerChannelTitle.textContent = channel.title || 'MUSIC TECH LAB';
      if (heroTotalVideos && channel.videoCount) {
        const hasCustomHero = localStorage.getItem('piano_cinema_custom_hero_info');
        if (!hasCustomHero) heroTotalVideos.textContent = `${channel.videoCount} Works`;
      }
      if (youtubeChannelLink && channel.id) {
        youtubeChannelLink.href = `https://www.youtube.com/channel/${channel.id}`;
      }
    }

    // Piascore公式ストアURLの設定
    if (this.config.PIASCORE_STORE_URL) {
      const piascoreBtn = document.getElementById('piascorePublisherBtn');
      if (piascoreBtn) piascoreBtn.href = this.config.PIASCORE_STORE_URL;
    }

    if (initResult.mode === 'live') {
      badge?.classList.add('live');
      if (statusText) statusText.textContent = `LIVE: ${channel?.subscriberCount || 'SYNCED'}`;
      this.showToast('YouTube Data API に接続しました。最新動画を同期中。');
    } else {
      badge?.classList.remove('live');
      if (statusText) statusText.textContent = 'DEMO PREVIEW';
    }
  }

  /**
   * 初期の通常動画（3本）とショート動画（6本）をロード
   */
  async loadInitialVideos() {
    // 1. 通常動画 (16:9)
    const regularResult = await this.youtubeService.getRegularVideos(this.config.REGULAR_VIDEOS.INITIAL_COUNT);
    this.renderRegularVideos(regularResult.items, true);
    this.updateLoadMoreButtonState('regular', regularResult.hasMore, regularResult.totalLoaded, regularResult.poolSize);

    // 2. ショート動画 (9:16)
    const shortsResult = await this.youtubeService.getShortsVideos(this.config.SHORTS_VIDEOS.INITIAL_COUNT);
    this.renderShortsVideos(shortsResult.items, true);
    this.updateLoadMoreButtonState('shorts', shortsResult.hasMore, shortsResult.totalLoaded, shortsResult.poolSize);
  }

  /**
   * 通常動画カード群をDOMに生成・追加
   */
  renderRegularVideos(videos, isInitial = false) {
    if (!this.repertoireGrid) return;
    if (!isInitial) return; // YouTube直リンク化に伴い、追加カード生成を完全遮断
    this.repertoireGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const createdCards = [];

    videos.forEach((video) => {
      const cleanId = this.extractYouTubeId(video.youtubeId || video.id) || video.youtubeId;
      const targetUrl = cleanId ? `https://www.youtube.com/watch?v=${cleanId}` : (video.youtubeId || '#');

      const card = document.createElement('article');
      card.className = 'video-card';
      card.dataset.id = cleanId;
      card.dataset.title = video.title;
      card.dataset.description = video.description || '';
      card.dataset.category = video.category || 'Main Cover';
      card.dataset.date = YouTubeService.formatDate(video.publishedAt);
      card.dataset.views = video.views ? `${video.views} views` : '';
      card.dataset.type = 'regular';

      const thumb = (video.thumbnail && !video.thumbnail.includes('undefined') && !video.thumbnail.includes('/vi/http'))
        ? video.thumbnail
        : `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`;

      card.innerHTML = `
        <div class="video-thumb-box">
          <img src="${thumb}" alt="${this.escapeHtml(video.title)}" class="video-thumb-img" loading="lazy" />
          <div class="thumb-gradient"></div>
          <span class="category-tag">${this.escapeHtml(video.category || 'Main Cover')}</span>
          <span class="duration-badge">${video.duration || '0:00'}</span>
          <div class="play-hover-icon">
            <i data-lucide="play"></i>
          </div>
        </div>
        <div class="video-content">
          <div>
            <div class="video-meta-row">
              <span class="video-date">${YouTubeService.formatDate(video.publishedAt)}</span>
              <span class="video-views"><i data-lucide="eye"></i> ${video.views || ''}</span>
            </div>
            <h3 class="video-title" style="white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word;">${this.escapeHtml(video.title)}</h3>
            <p class="video-desc-preview">${this.escapeHtml(video.description || '')}</p>
          </div>
          <div class="video-card-footer">
            <span>WATCH ON YOUTUBE</span>
            <i data-lucide="external-link"></i>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (targetUrl && targetUrl !== '#') {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      });
      fragment.appendChild(card);
      createdCards.push(card);
    });

    this.repertoireGrid.appendChild(fragment);
    this.refreshIcons();
    this.soundEngine?.bindHoverSoundElements();

    // GSAPアニメーション適用
    if (!isInitial) {
      this.animationEngine.animateNewCards(createdCards);
    }
  }

  /**
   * ショート動画カード群をDOMに生成・追加 (9:16)
   */
  renderShortsVideos(videos, isInitial = false) {
    if (!this.shortsGrid) return;
    if (!isInitial) return; // YouTube直リンク化に伴い、追加カード生成を完全遮断
    this.shortsGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const createdCards = [];

    videos.forEach((video) => {
      const cleanId = this.extractYouTubeId(video.youtubeId || video.id) || video.youtubeId;
      const targetUrl = cleanId ? `https://www.youtube.com/shorts/${cleanId}` : (video.youtubeId || '#');

      const card = document.createElement('article');
      card.className = 'shorts-card';
      card.dataset.id = cleanId;
      card.dataset.title = video.title;
      card.dataset.description = video.description || '';
      card.dataset.category = 'Shorts (サビ弾き)';
      card.dataset.date = YouTubeService.formatDate(video.publishedAt);
      card.dataset.views = video.views ? `${video.views} views` : '';
      card.dataset.type = 'shorts';

      const thumb = (video.thumbnail && !video.thumbnail.includes('undefined') && !video.thumbnail.includes('/vi/http'))
        ? video.thumbnail
        : `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;

      card.innerHTML = `
        <div class="shorts-thumb-box">
          <img src="${thumb}" alt="${this.escapeHtml(video.title)}" class="shorts-thumb-img" loading="lazy" />
          <div class="shorts-badge">
            <i data-lucide="play"></i>
            <span>SHORT</span>
          </div>
          <div class="shorts-overlay-gradient"></div>
          <div class="shorts-content">
            <div class="shorts-meta-row">
              <span><i data-lucide="eye" style="width:11px;height:11px;display:inline;"></i> ${video.views || ''}</span>
              ${video.likes ? `<span>• <i data-lucide="heart" style="width:10px;height:10px;display:inline;"></i> ${video.likes}</span>` : ''}
            </div>
            <h3 class="shorts-title" style="white-space: pre-wrap; word-break: break-all; overflow-wrap: break-word;">${this.escapeHtml(video.title)}</h3>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (targetUrl && targetUrl !== '#') {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      });
      fragment.appendChild(card);
      createdCards.push(card);
    });

    this.shortsGrid.appendChild(fragment);
    this.refreshIcons();
    this.soundEngine?.bindHoverSoundElements();

    // GSAPアニメーション適用
    if (!isInitial) {
      this.animationEngine.animateNewCards(createdCards);
    }
  }

  /**
   * Piascore 楽譜データ一覧をDOMに生成・同期 (将来のPiascore API連携用)
   */
  renderSheetMusic(sheets = null) {
    const sheetGrid = document.getElementById('sheetMusicGrid');
    if (!sheetGrid) return;

    const data = sheets || (window.DEMO_DATA && window.DEMO_DATA.sheets) || [];
    if (!data.length) return;

    sheetGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    data.forEach((sheet) => {
      const card = document.createElement('div');
      card.className = 'sheet-card';
      card.dataset.magnetic = '';

      card.innerHTML = `
        <div class="sheet-thumb-box">
          <img src="${this.escapeHtml(sheet.thumbnail)}" alt="${this.escapeHtml(sheet.title)} 楽譜" class="sheet-thumb-img" loading="lazy" />
          <div class="sheet-badge-overlay">
            <span class="sheet-tag-pill ${sheet.tagType || 'hot'}">${this.escapeHtml(sheet.tag || 'HOT')}</span>
            <span class="sheet-format-pill">PDF</span>
          </div>
        </div>
        <div class="sheet-card-body">
          <span class="sheet-category">${this.escapeHtml(sheet.workTitle || '')}</span>
          <h3 class="sheet-title" style="color: ${this.escapeHtml(sheet.titleColor || '#ffffff')}; white-space: pre-wrap;">${this.escapeHtml(sheet.title)}</h3>
          <p class="sheet-desc">${this.escapeHtml(sheet.description || '').replace(/\r?\n/g, '<br>')}</p>
          <div class="sheet-card-footer">
            <div class="sheet-price">
              <span class="price-currency">${this.escapeHtml(sheet.currency || '¥')}</span>
              <span class="price-val">${this.escapeHtml(sheet.price || '440')}</span>
              <span class="price-tax">(税込)</span>
            </div>
            <a href="${this.escapeHtml(sheet.storeUrl || '#')}" target="_blank" rel="noopener noreferrer" class="btn-buy-piascore" data-magnetic>
              <span>Piascoreで購入</span>
              <i data-lucide="external-link"></i>
            </a>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    });

    sheetGrid.appendChild(fragment);
    this.refreshIcons();
    this.soundEngine?.bindHoverSoundElements();
  }

  /**
   * 「もっと見る（Load More）」ボタンの状態更新
   */
  updateLoadMoreButtonState(type, hasMore, totalLoaded, poolSize) {
    // YouTube直リンク化に伴い、ボタン状態の操作・非表示化・ステータスメッセージ更新を完全無効化
    return;
  }

  /**
   * イベントリスナーの登録
   */
  bindEvents() {
    // 1. 通常動画 Load More - YouTube直リンク化により追加描画リスナーを完全遮断・無効化
    // 2. ショート動画 Load More - YouTube直リンク化により追加描画リスナーを完全遮断・無効化

    // 3. シアターモーダルの閉じる処理
    this.theaterCloseBtn?.addEventListener('click', () => this.closeTheater());
    this.theaterBackdrop?.addEventListener('click', () => this.closeTheater());

    // ナビゲーションおよびページ内アンカーリンクのクリック時のみスムーズスクロール
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#') return;
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /**
   * 管理者ポップアップモーダルの初期化とイベントバインド（パスワード: 1234）
   */
  initAdminModal() {
    this.adminModal = document.getElementById('adminModal');
    this.adminBackdrop = document.getElementById('adminBackdrop');
    this.adminCloseBtn = document.getElementById('adminCloseBtn');
    this.adminAuthView = document.getElementById('adminAuthView');
    this.adminAuthForm = document.getElementById('adminAuthForm');
    this.adminAuthPassInput = document.getElementById('adminAuthPassInput');
    this.adminAuthErrMsg = document.getElementById('adminAuthErrMsg');
    this.adminWorkspaceView = document.getElementById('adminWorkspaceView');
    this.btnAdminLogout = document.getElementById('btnAdminLogout');
    this.footerAdminBtn = document.getElementById('footerAdminBtn');
    this.secretAdminTrigger = document.getElementById('secretAdminTrigger');
    this.btnPopupReset = document.getElementById('btnPopupReset');
    this.btnPopupSave = document.getElementById('btnPopupSave');

    this.adminState = {
      regularVideos: [],
      shortsVideos: [],
      sheets: []
    };

    // フッターのボタン＆秘密の鍵アイコンから起動
    this.footerAdminBtn?.addEventListener('click', () => this.openAdminModal());
    this.secretAdminTrigger?.addEventListener('click', () => this.openAdminModal());

    // キーボードショートカット (Ctrl + Shift + A または Alt + A)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) ||
          (e.altKey && (e.key === 'A' || e.key === 'a'))) {
        e.preventDefault();
        this.openAdminModal();
      }
      if (e.key === 'Escape') {
        this.closeTheater();
        this.closeAdminModal();
      }
    });

    // 閉じるボタン＆背景クリック
    this.adminCloseBtn?.addEventListener('click', () => this.closeAdminModal());
    this.adminBackdrop?.addEventListener('click', () => this.closeAdminModal());

    // 認証フォーム送信 (仮パスワード: 1234)
    this.adminAuthForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = this.adminAuthPassInput?.value.trim();
      if (entered === '1234') {
        sessionStorage.setItem('piano_admin_logged_in', 'true');
        this.showAdminWorkspace();
      } else {
        if (this.adminAuthErrMsg) this.adminAuthErrMsg.style.display = 'block';
        if (this.adminAuthPassInput) {
          this.adminAuthPassInput.value = '';
          this.adminAuthPassInput.focus();
        }
      }
    });

    // ログアウト（ロック）
    this.btnAdminLogout?.addEventListener('click', () => {
      sessionStorage.removeItem('piano_admin_logged_in');
      this.showAdminAuthGate();
    });

    // タブ切り替え
    const tabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabContents = document.querySelectorAll('.admin-tab-content');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('is-active'));
        tabContents.forEach(c => c.classList.remove('is-active'));
        btn.classList.add('is-active');
        const activeContent = document.getElementById(target);
        if (activeContent) {
          activeContent.classList.add('is-active');
          activeContent.scrollTop = 0;
        }
      });
    });

    // 通常動画追加フォーム
    document.getElementById('formAddRegularPopup')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawUrl = document.getElementById('popRegUrl').value;
      const youtubeId = this.extractYouTubeId(rawUrl);
      if (!youtubeId) {
        alert('有効なYouTube URLまたは動画IDを入力してください。');
        return;
      }

      const title = document.getElementById('popRegTitle').value.trim();
      const category = document.getElementById('popRegCat').value.trim() || 'Anime Piano';
      const duration = document.getElementById('popRegDur').value.trim() || '1:45';
      const desc = document.getElementById('popRegDesc').value.trim();

      const newVideo = {
        id: 'custom_reg_' + Date.now(),
        youtubeId: youtubeId,
        title: title,
        description: desc || `${title} のワンコーラスピアノ演奏です。`,
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
        publishedAt: new Date().toISOString(),
        duration: duration,
        views: 'NEW',
        category: category
      };

      // 指定位置への挿入ロジック（フォールバック付き）
      const rawPos = parseInt(document.getElementById('popRegInsertPos')?.value, 10);
      const targetIndex = (!isNaN(rawPos) && rawPos > 1) ? Math.min(rawPos - 1, this.adminState.regularVideos.length) : 0;
      this.adminState.regularVideos.splice(targetIndex, 0, newVideo);
      localStorage.setItem('piano_cinema_custom_channel_a', JSON.stringify(this.adminState.regularVideos));

      this.renderAdminPopupLists();
      document.getElementById('formAddRegularPopup').reset();
      const posInput = document.getElementById('popRegInsertPos');
      if (posInput) posInput.value = '1';
      document.getElementById('popRegCat').value = 'Anime Piano';
      document.getElementById('popRegDur').value = '1:45';
      this.showToast(`通常動画を上から${targetIndex + 1}番目に追加しました！`);
    });

    // Shorts追加フォーム
    document.getElementById('formAddShortsPopup')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawUrl = document.getElementById('popShtUrl').value;
      const youtubeId = this.extractYouTubeId(rawUrl);
      if (!youtubeId) {
        alert('有効なYouTube Shorts URLまたは動画IDを入力してください。');
        return;
      }

      const title = document.getElementById('popShtTitle').value.trim();
      const views = document.getElementById('popShtViews').value.trim() || '1.2M';
      const likes = document.getElementById('popShtLikes').value.trim() || '85K';

      const newShort = {
        id: 'custom_sht_' + Date.now(),
        youtubeId: youtubeId,
        title: title,
        description: 'サビだけ弾いてみた！',
        thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        publishedAt: new Date().toISOString(),
        views: views,
        likes: likes
      };

      // 指定位置への挿入ロジック（フォールバック付き）
      const rawPos = parseInt(document.getElementById('popShtInsertPos')?.value, 10);
      const targetIndex = (!isNaN(rawPos) && rawPos > 1) ? Math.min(rawPos - 1, this.adminState.shortsVideos.length) : 0;
      this.adminState.shortsVideos.splice(targetIndex, 0, newShort);
      localStorage.setItem('piano_cinema_custom_channel_b', JSON.stringify(this.adminState.shortsVideos));

      this.renderAdminPopupLists();
      document.getElementById('formAddShortsPopup').reset();
      const posInput = document.getElementById('popShtInsertPos');
      if (posInput) posInput.value = '1';
      document.getElementById('popShtViews').value = '1.2M';
      document.getElementById('popShtLikes').value = '85K';
      this.showToast(`Shorts動画を上から${targetIndex + 1}番目に追加しました！`);
    });

    // 曲名カラーピッカーのプレビュー連動
    document.getElementById('popSheetTitleColor')?.addEventListener('input', (e) => {
      const valEl = document.getElementById('popSheetTitleColorVal');
      if (valEl) valEl.textContent = e.target.value;
    });

    // 楽譜追加フォーム
    document.getElementById('formAddSheetPopup')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('popSheetTitle').value.trim();
      const titleColor = document.getElementById('popSheetTitleColor')?.value || '#ffffff';
      const workTitle = document.getElementById('popSheetWork').value.trim();
      const price = document.getElementById('popSheetPrice').value.trim() || '440';
      const tag = document.getElementById('popSheetTag').value.trim() || 'HOT';
      const storeUrl = document.getElementById('popSheetUrl').value.trim();
      const customThumb = document.getElementById('popSheetThumb').value.trim();
      const desc = document.getElementById('popSheetDesc').value.trim();

      const newSheet = {
        id: 'custom_sheet_' + Date.now(),
        title: title,
        titleColor: titleColor || '#ffffff',
        workTitle: workTitle,
        description: desc || '右手メロディ五線譜・ドレミ音階・CDEコード付きワンコーラス楽譜。',
        thumbnail: customThumb || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop',
        price: price,
        currency: '¥',
        taxIncluded: true,
        tag: tag,
        tagType: tag.toLowerCase() === 'popular' ? 'popular' : 'hot',
        specs: ['右手五線譜', 'ドレミ付き', 'CDE表記', 'PDF即時DL'],
        storeUrl: storeUrl
      };

      // 指定位置への挿入ロジック（フォールバック付き）
      const rawPos = parseInt(document.getElementById('popSheetInsertPos')?.value, 10);
      const targetIndex = (!isNaN(rawPos) && rawPos > 1) ? Math.min(rawPos - 1, this.adminState.sheets.length) : 0;
      this.adminState.sheets.splice(targetIndex, 0, newSheet);
      localStorage.setItem('piano_cinema_custom_sheets', JSON.stringify(this.adminState.sheets));

      this.renderAdminPopupLists();
      document.getElementById('formAddSheetPopup').reset();
      const posInput = document.getElementById('popSheetInsertPos');
      if (posInput) posInput.value = '1';
      if (document.getElementById('popSheetTitleColor')) document.getElementById('popSheetTitleColor').value = '#ffffff';
      if (document.getElementById('popSheetTitleColorVal')) document.getElementById('popSheetTitleColorVal').textContent = '#ffffff';
      document.getElementById('popSheetPrice').value = '440';
      document.getElementById('popSheetTag').value = 'HOT';
      document.getElementById('popSheetThumb').value = 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop';
      this.showToast(`楽譜データを上から${targetIndex + 1}番目に追加しました！`);
    });

    // 保存ボタン（サイトを更新する）
    this.btnPopupSave?.addEventListener('click', () => {
      this.saveAdminData();
    });

    // リセットボタン（不可侵保護シールド：データ破壊・初期化を完全遮断）
    this.btnPopupReset?.addEventListener('click', () => {
      alert('🛡️【絶対不可侵保護ロック作動中】\nクライアント様の管理パネルデータは神聖な絶対聖域として保護されています。\nAIや誤操作によるデータ初期化・リセットはシステム根本より永久に無効化されています。');
    });

    // リクエスト専用 独立投票カウントリセットボタン（サイト全体には一切触れず投票数とロック履歴のみリセット）
    document.getElementById('btnResetRequestVotes')?.addEventListener('click', async () => {
      if (!confirm('リクエストの投票数をすべて「0」に戻しますか？\n（※他の動画やテキスト、サイト設定には一切影響しません）')) return;
      const zeroVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      localStorage.setItem('piano_cinema_request_votes', JSON.stringify(zeroVotes));
      localStorage.setItem('piano_cinema_request_vote_history', JSON.stringify([]));
      this.updateAllRequestSlots();
      await this.syncToServer({
        piano_cinema_request_votes: zeroVotes,
        piano_cinema_request_vote_history: []
      });
      this.showToast('🧹 リクエストの投票数とロック履歴をすべて0にリセットしました！');
    });

    // 第2弾リクエスト専用 独立投票カウントリセットボタン（サイト全体には一切触れず投票数とロック履歴のみリセット）
    document.getElementById('btnResetRequest2Votes')?.addEventListener('click', async () => {
      if (!confirm('第2弾リクエストの投票数をすべて「0」に戻しますか？\n（※他の動画やテキスト、第1弾の投票には一切影響しません）')) return;
      const zeroVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      localStorage.setItem('piano_cinema_request2_votes', JSON.stringify(zeroVotes));
      localStorage.setItem('piano_cinema_request2_vote_history', JSON.stringify([]));
      this.updateAllRequest2Slots();
      await this.syncToServer({
        piano_cinema_request2_votes: zeroVotes,
        piano_cinema_request2_vote_history: []
      });
      this.showToast('🧹 第2弾リクエストの投票数とロック履歴をすべて0にリセットしました！');
    });

    // 第3弾リクエスト専用 独立投票カウントリセットボタン（サイト全体には一切触れず投票数とロック履歴のみリセット）
    document.getElementById('btnResetRequest3Votes')?.addEventListener('click', async () => {
      if (!confirm('第3弾リクエストの投票数をすべて「0」に戻しますか？\n（※他の動画やテキスト、第1弾・第2弾の投票には一切影響しません）')) return;
      const zeroVotes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      localStorage.setItem('piano_cinema_request3_votes', JSON.stringify(zeroVotes));
      localStorage.setItem('piano_cinema_request3_vote_history', JSON.stringify([]));
      this.updateAllRequest3Slots();
      await this.syncToServer({
        piano_cinema_request3_votes: zeroVotes,
        piano_cinema_request3_vote_history: []
      });
      this.showToast('🧹 第3弾リクエストの投票数とロック履歴をすべて0にリセットしました！');
    });

    // システム安全セーブ（バックアップ）ボタン
    document.getElementById('btnSystemBackup')?.addEventListener('click', () => {
      // 1. 既存のクリックSE再生（se/click.mp3 ボリューム連動）
      try {
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/click.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Sound error on backup click:', err);
      }

      // 2. 指定のアラート（ポップアップ案内）画面を表示
      alert('【セーブポイントを作成します】\nプロジェクトフォルダ内にある「backup.bat」をダブルクリックして実行してください。\n自動的に「backup_日付_時間」のフォルダが作成され、全ファイルが安全に退避されます！');
    });

    // 【Windows用】バックアップ起動ファイルをダウンロード（作成）ボタン
    document.getElementById('btnDownloadBackupBat')?.addEventListener('click', () => {
      // 1. 既存のクリックSE再生（se/click.mp3 ボリューム連動）
      try {
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        } else {
          const savedVol = localStorage.getItem('piano_site_se_vol');
          const isMuted = localStorage.getItem('piano_site_se_muted') === 'true';
          const vol = savedVol !== null ? parseFloat(savedVol) : 0.2;
          if (!isMuted && vol > 0) {
            const audio = new Audio('se/click.mp3');
            audio.volume = Math.max(0, Math.min(1, vol));
            audio.play().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Sound error on download backup bat click:', err);
      }

      // 2. 指定のバッチファイル内容（完全固定）
      const batContent = [
        '@echo off',
        'setlocal enabledelayedexpansion',
        'set "timestamp=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%"',
        'set "timestamp=%timestamp: =0%"',
        'set "BACKUP_DIR=..\\backup_%timestamp%"',
        'echo [MUSIC TECH LAB] バックアップを開始します...',
        'echo バックアップ先: %BACKUP_DIR%',
        'xcopy * "%BACKUP_DIR%" /E /I /Y /H /K',
        'echo [完了] 安全にセーブされました！このウィンドウを閉じてください。',
        'pause\r\n'
      ].join('\r\n');

      // 3. ブラウザから「backup.bat」としてダウンロード
      const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'backup.bat';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('📥 backup.bat をダウンロードしました！');
    });

    this.loadAdminData();
  }

  openAdminModal() {
    if (!this.adminModal) return;
    this.adminModal.classList.add('is-active');

    if (sessionStorage.getItem('piano_admin_logged_in') === 'true') {
      this.showAdminWorkspace();
    } else {
      this.showAdminAuthGate();
    }
  }

  closeAdminModal() {
    this.adminModal?.classList.remove('is-active');
  }

  showAdminAuthGate() {
    if (this.adminAuthView) this.adminAuthView.style.display = 'block';
    if (this.adminWorkspaceView) this.adminWorkspaceView.style.display = 'none';
    if (this.adminAuthErrMsg) this.adminAuthErrMsg.style.display = 'none';
    if (this.adminAuthPassInput) {
      this.adminAuthPassInput.value = '';
      setTimeout(() => this.adminAuthPassInput.focus(), 200);
    }
    this.refreshIcons();
  }

  showAdminWorkspace() {
    if (this.adminAuthView) this.adminAuthView.style.display = 'none';
    if (this.adminWorkspaceView) this.adminWorkspaceView.style.display = 'flex';
    this.loadAdminData();
    this.refreshIcons();
  }

  loadAdminData() {
    const demo = window.DEMO_DATA || { regularVideos: [], shortsVideos: [], sheets: [] };

    try {
      const savedReg = localStorage.getItem('piano_cinema_custom_channel_a');
      const parsedReg = savedReg ? JSON.parse(savedReg) : [...demo.regularVideos];
      this.adminState.regularVideos = parsedReg.map(v => {
        const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
        return {
          ...v,
          youtubeId: cleanId,
          thumbnail: (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`
        };
      });
    } catch (e) { this.adminState.regularVideos = [...demo.regularVideos]; }

    try {
      const savedSht = localStorage.getItem('piano_cinema_custom_channel_b');
      const parsedSht = savedSht ? JSON.parse(savedSht) : [...demo.shortsVideos];
      this.adminState.shortsVideos = parsedSht.map(v => {
        const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
        return {
          ...v,
          youtubeId: cleanId,
          thumbnail: (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`
        };
      });
    } catch (e) { this.adminState.shortsVideos = [...demo.shortsVideos]; }

    try {
      const savedSheets = localStorage.getItem('piano_cinema_custom_sheets');
      const parsedSheets = savedSheets ? JSON.parse(savedSheets) : [...(demo.sheets || [])];
      this.adminState.sheets = parsedSheets.map(s => ({
        ...s,
        titleColor: s.titleColor || '#ffffff'
      }));
    } catch (e) {
      this.adminState.sheets = [...(demo.sheets || [])].map(s => ({ ...s, titleColor: s.titleColor || '#ffffff' }));
    }

    // 00 HERO エリアのテキスト情報の読み込み
    try {
      const defaultHeroInfo = {
        title: '最新アニソン＆ゲーム音楽・ピアノCH 【Music Tech Lab】',
        tagline: '88鍵が描き出す、原曲の熱量とシネマティックな音響美学。\n最新アニメ・ゲームの名曲を、初心者から愛好家まで楽しめるハイブリッド仕様でお届けします。',
        metaTag: 'MUSIC TECH LAB / 最新アニソン＆ゲーム音楽・ピアノCH',
        metaSub: 'ANIME & GAME MUSIC PIANO ARCHIVE',
        brandPill: 'OFFICIAL PIANO ARCHIVE',
        statLabel1: 'TOTAL TRACKS',
        statTotal: '130+ Works',
        statLabel2: 'ARRANGEMENTS',
        statArrangements: 'One-Chorus & Virtuoso',
        statLabel3: 'AUDIO MASTERS',
        statAudio: 'Lossless High-Res'
      };
      const savedHeroInfo = localStorage.getItem('piano_cinema_custom_hero_info');
      const heroInfo = savedHeroInfo ? { ...defaultHeroInfo, ...JSON.parse(savedHeroInfo) } : defaultHeroInfo;

      const popHeroTitle = document.getElementById('popHeroMainTitle');
      if (popHeroTitle) popHeroTitle.value = heroInfo.title || '';
      const popHeroTagline = document.getElementById('popHeroTagline');
      if (popHeroTagline) popHeroTagline.value = heroInfo.tagline || '';
      const popHeroMetaTag = document.getElementById('popHeroMetaTag');
      if (popHeroMetaTag) popHeroMetaTag.value = heroInfo.metaTag || '';
      const popHeroMetaSub = document.getElementById('popHeroMetaSub');
      if (popHeroMetaSub) popHeroMetaSub.value = heroInfo.metaSub || '';
      const popHeroBrandPill = document.getElementById('popHeroBrandPill');
      if (popHeroBrandPill) popHeroBrandPill.value = heroInfo.brandPill || '';
      const popHeroStatLabel1 = document.getElementById('popHeroStatLabel1');
      if (popHeroStatLabel1) popHeroStatLabel1.value = heroInfo.statLabel1 || 'TOTAL TRACKS';
      const popHeroStatTotal = document.getElementById('popHeroStatTotal');
      if (popHeroStatTotal) popHeroStatTotal.value = heroInfo.statTotal || '';
      const popHeroStatLabel2 = document.getElementById('popHeroStatLabel2');
      if (popHeroStatLabel2) popHeroStatLabel2.value = heroInfo.statLabel2 || 'ARRANGEMENTS';
      const popHeroStatArrangements = document.getElementById('popHeroStatArrangements');
      if (popHeroStatArrangements) popHeroStatArrangements.value = heroInfo.statArrangements || '';
      const popHeroStatLabel3 = document.getElementById('popHeroStatLabel3');
      if (popHeroStatLabel3) popHeroStatLabel3.value = heroInfo.statLabel3 || 'AUDIO MASTERS';
      const popHeroStatAudio = document.getElementById('popHeroStatAudio');
      if (popHeroStatAudio) popHeroStatAudio.value = heroInfo.statAudio || '';
    } catch (e) {
      console.warn('Failed to load hero info in admin modal:', e);
    }

    // 01 FEATURES セクションのテキスト情報の読み込み
    try {
      const defaultFeaturesInfo = {
        badge: 'MULTI-LAYERED VISUAL SPECIFICATIONS',
        title: '01 / FEATURES (動画のこだわり)',
        desc: '歌える・学べる・弾ける。すべての動画に施された5層のマルチ情報。\n初心者から海外ファンまで、見るだけで演奏が深まる究極の映像仕様。',
        card1Badge: 'SING ALONG',
        card1En: 'JAPANESE LYRICS',
        card1Ja: '日本語歌詞',
        card1Desc: '一緒に歌える、原曲のニュアンスや感情がダイレクトに伝わる洗練された日本語歌詞。',
        card1Tag: 'ニュアンスが伝わる',
        card2Badge: 'GLOBAL FANS',
        card2En: 'ROMAJI / ENGLISH LYRICS',
        card2Ja: 'アルファベット歌詞',
        card2Desc: '海外のファンも楽しめる英語・ローマ字歌詞。世界中どこからでも一緒に楽しめます。',
        card2Tag: '海外ファンも楽しめる',
        card3Badge: 'EASY TO PLAY',
        card3En: 'DO-RE-MI NOTATION',
        card3Ja: 'ドレミ音階',
        card3Desc: '初心者でもパッと見てすぐに弾けるドレミの案内。鍵盤のどこを弾くか一目で分かります。',
        card3Tag: '初心者もすぐに弾ける',
        card4Badge: 'CHORD & THEORY',
        card4En: 'C-D-E NOTATION',
        card4Ja: 'CDE音階',
        card4Desc: 'コードや国際基準で学べるアルファベット音階。ポピュラー音楽の理論やコード学習に最適。',
        card4Tag: '国際基準で学べる',
        card5Badge: 'PRACTICE COMPANION',
        card5En: 'RIGHT-HAND SHEET MUSIC',
        card5Ja: 'メロディ楽譜',
        card5Desc: '右手の五線譜がついているから、動画を見ながら一緒に練習できる親切な設計。',
        card5Tag: '動画を見ながら練習できる',
        bannerPill: '5-IN-1 MULTI-SPECIFICATION',
        bannerTitle: '観る・歌う・弾ける。',
        bannerHighlight: 'すべての動画が「練習＆鑑賞」のマルチ仕様。',
        bannerDesc: 'ピアノの演奏映像に、日本語歌詞・アルファベット歌詞・ドレミ・CDE・右手五線譜の5つの情報レイヤーを美しく統合。\nただ聴くだけでなく、弾きたい曲を自分のペースでマスターできる映像体験をお届けします。'
      };
      const savedFeatInfo = localStorage.getItem('piano_cinema_custom_features_info');
      const featInfo = savedFeatInfo ? { ...defaultFeaturesInfo, ...JSON.parse(savedFeatInfo) } : defaultFeaturesInfo;

      const popFeatBadge = document.getElementById('popFeaturesSectionBadge');
      if (popFeatBadge) popFeatBadge.value = featInfo.badge || '';
      const popFeatTitle = document.getElementById('popFeaturesSectionTitle');
      if (popFeatTitle) popFeatTitle.value = featInfo.title || '';
      const popFeatDesc = document.getElementById('popFeaturesSectionDesc');
      if (popFeatDesc) popFeatDesc.value = featInfo.desc || '';

      for (let i = 1; i <= 5; i++) {
        const b = document.getElementById(`popFeatCard${i}Badge`);
        if (b) b.value = featInfo[`card${i}Badge`] || '';
        const en = document.getElementById(`popFeatCard${i}En`);
        if (en) en.value = featInfo[`card${i}En`] || '';
        const ja = document.getElementById(`popFeatCard${i}Ja`);
        if (ja) ja.value = featInfo[`card${i}Ja`] || '';
        const desc = document.getElementById(`popFeatCard${i}Desc`);
        if (desc) desc.value = featInfo[`card${i}Desc`] || '';
        const tag = document.getElementById(`popFeatCard${i}Tag`);
        if (tag) tag.value = featInfo[`card${i}Tag`] || '';
      }

      const pPill = document.getElementById('popFeatBannerPill');
      if (pPill) pPill.value = featInfo.bannerPill || '';
      const pTitle = document.getElementById('popFeatBannerTitle');
      if (pTitle) pTitle.value = featInfo.bannerTitle || '';
      const pHl = document.getElementById('popFeatBannerHighlight');
      if (pHl) pHl.value = featInfo.bannerHighlight || '';
      const pDesc = document.getElementById('popFeatBannerDesc');
      if (pDesc) pDesc.value = featInfo.bannerDesc || '';
    } catch (e) {
      console.warn('Failed to load features section info in admin modal:', e);
    }

    // 02 MAIN COVERS セクションのテキスト情報の読み込み
    try {
      const defaultRegularInfo = {
        badge: 'FULL HARMONIC ARRANGEMENTS',
        title: '02 / MAIN COVERS (ワンコーラス)',
        desc: 'じっくり聴かせる、原曲の魅力を凝縮したワンコーラス演奏。\nMelodic Depth & Dynamic Range — ピアノならではの豊かな響きを味わうメイン動画。',
        youtubeUrl: ''
      };
      const savedRegInfo = localStorage.getItem('piano_cinema_custom_regular_info');
      const regInfo = savedRegInfo ? { ...defaultRegularInfo, ...JSON.parse(savedRegInfo) } : defaultRegularInfo;

      const popBadge = document.getElementById('popRegSectionBadge');
      if (popBadge) popBadge.value = regInfo.badge || '';
      const popTitle = document.getElementById('popRegSectionTitle');
      if (popTitle) popTitle.value = regInfo.title || '';
      const popRegYtUrl = document.getElementById('popRegYoutubeUrl');
      if (popRegYtUrl) popRegYtUrl.value = (regInfo.youtubeUrl && regInfo.youtubeUrl !== 'https://youtube.com') ? regInfo.youtubeUrl : '';
      const popDesc = document.getElementById('popRegSectionDesc');
      if (popDesc) popDesc.value = regInfo.desc || '';
    } catch (e) {
      console.warn('Failed to load regular section info in admin modal:', e);
    }

    // 03 SHORTS セクションのテキスト情報の読み込み
    try {
      const defaultShortsInfo = {
        badge: 'CHORUS HIGHLIGHTS IN 60s',
        title: '03 / SHORTS (サビだけ弾いてみた)',
        desc: 'サビの爆発力を1分に凝縮した、疾走感あるショート動画。\nInstant Climax & Finger Speed — スマホに最適化された縦長ショート演奏。',
        youtubeUrl: ''
      };
      const savedShtInfo = localStorage.getItem('piano_cinema_custom_shorts_info');
      const shtInfo = savedShtInfo ? { ...defaultShortsInfo, ...JSON.parse(savedShtInfo) } : defaultShortsInfo;

      const popBadge = document.getElementById('popShtSectionBadge');
      if (popBadge) popBadge.value = shtInfo.badge || '';
      const popTitle = document.getElementById('popShtSectionTitle');
      if (popTitle) popTitle.value = shtInfo.title || '';
      const popShtYtUrl = document.getElementById('popShtYoutubeUrl');
      if (popShtYtUrl) popShtYtUrl.value = (shtInfo.youtubeUrl && shtInfo.youtubeUrl !== 'https://youtube.com') ? shtInfo.youtubeUrl : '';
      const popDesc = document.getElementById('popShtSectionDesc');
      if (popDesc) popDesc.value = shtInfo.desc || '';
    } catch (e) {
      console.warn('Failed to load shorts section info in admin modal:', e);
    }

    // 04 LAB APPS セクションのテキスト情報の読み込み
    try {
      const defaultLabInfo = {
        badge: 'POWERED BY GOOGLE ANTIGRAVITY & AI',
        title: '04 / LAB APPS (開発アプリ)',
        desc: 'Google Antigravity × AIが加速させる、次世代の音楽テクノロジー開発。\nこのWebサイトをはじめ、動画制作を革新するすべてのツールをAntigravity環境上で最速開発。',
        heroBadge: 'NEXT-GEN DEVELOPMENT PIPELINE',
        heroTitle: 'すべては、',
        heroHighlight: 'Google Antigravity × 最先端AI と共に。',
        heroSubtitle: '圧倒的なスピードで生み出される音楽プロダクト群。',
        heroDesc: '当チャンネル「Music Tech Lab」のWebサイト自体はもちろん、動画内で活用しているビジュアライザーや歌詞同期アプリなど、すべてのプロダクトをGoogleが誇る次世代AI開発プラットフォーム「Google Antigravity」を活用して爆速構築しています。音楽と最先端テクノロジーの融合が、かつてない表現体験を切り拓きます。',
        heroStat1Num: 'AI-Native',
        heroStat1Label: 'Google Antigravity Driven',
        heroStat2Num: 'Ultra Fast',
        heroStat2Label: 'Rapid Iteration & Deploy',
        heroStat3Num: 'In The Lab',
        heroStat3Label: 'Multiple AI Tools Under Dev',
        card1Badge: 'VISUAL EFFECT TOOL',
        card1En: 'Audio Visualizer',
        card1Ja: 'オーディオビジュアライザー',
        card1Desc: '音楽の周波数波形や響きを美しくリアルタイム可視化するエフェクトツール。音の強弱に呼応するシネマティックな光彩パーティクルが、演奏動画の没入感を極限まで高めます。',
        card1Tag1: 'WebGL / Canvas',
        card1Tag2: 'Realtime FFT',
        card1Tag3: 'Antigravity Built',
        card1Status: 'Active in Production',
        card2Badge: 'KARAOKE SYNC SYSTEM',
        card2En: 'Lrc Sync App',
        card2Ja: '同期型カラオケ歌詞アプリ',
        card2Desc: 'スペースキーを曲に合わせてトントンと叩くだけで歌詞のタイムスタンプを直感的に記憶。カラオケのように歌詞の色が滑らかに変化する動画用テロップを即座に出力する次世代システム。',
        card2Tag1: 'Spacebar Rhythm Input',
        card2Tag2: 'Smooth Color Flow',
        card2Tag3: 'Antigravity Built',
        card2Status: 'Active in Production',
        card3Badge: 'REACTIVE 2D/3D ANIMATION',
        card3En: 'Sonic Avatars',
        card3Ja: '音波連動キャラクター',
        card3Desc: '音楽のビートやアタック音に合わせて、リアルタイムにリズミカルに踊り出す犬、猫、ウサギなどの愛らしい動物キャラクター群。動画画面を賑やかに彩るインタラクティブ演出。',
        card3Tag1: 'Beat Reactive',
        card3Tag2: 'Animal Avatars',
        card3Tag3: 'Antigravity Built',
        card3Status: 'Active in Production',
        card4Badge: 'FUTURE ECOSYSTEM',
        card4En: 'Music AI Ecosystem',
        card4Ja: '次世代音楽AIツール群',
        card4Desc: '自動楽譜認識・伴奏生成・音源分離など、多数の音楽AIツールをGoogle Antigravity上で現在鋭意開発中。テクノロジーで音楽表現の未来を拡張し続けます。',
        card4Tag1: 'AI Audio Gen',
        card4Tag2: 'Harmonic Engine',
        card4Tag3: 'In Active R&D',
        card4Status: 'In Active Development'
      };
      const savedLabInfo = localStorage.getItem('piano_cinema_custom_lab_info');
      const labInfo = savedLabInfo ? { ...defaultLabInfo, ...JSON.parse(savedLabInfo) } : defaultLabInfo;

      const popLabBadge = document.getElementById('popLabSectionBadge');
      if (popLabBadge) popLabBadge.value = labInfo.badge || '';
      const popLabTitle = document.getElementById('popLabSectionTitle');
      if (popLabTitle) popLabTitle.value = labInfo.title || '';
      const popLabDesc = document.getElementById('popLabSectionDesc');
      if (popLabDesc) popLabDesc.value = labInfo.desc || '';

      const popHeroBadge = document.getElementById('popLabHeroBadge');
      if (popHeroBadge) popHeroBadge.value = labInfo.heroBadge || '';
      const popHeroTitle = document.getElementById('popLabHeroTitle');
      if (popHeroTitle) popHeroTitle.value = labInfo.heroTitle || '';
      const popHeroHighlight = document.getElementById('popLabHeroHighlight');
      if (popHeroHighlight) popHeroHighlight.value = labInfo.heroHighlight || '';
      const popHeroSubtitle = document.getElementById('popLabHeroSubtitle');
      if (popHeroSubtitle) popHeroSubtitle.value = labInfo.heroSubtitle || '';
      const popHeroDesc = document.getElementById('popLabHeroDesc');
      if (popHeroDesc) popHeroDesc.value = labInfo.heroDesc || '';

      const popHeroStat1Num = document.getElementById('popLabHeroStat1Num');
      if (popHeroStat1Num) popHeroStat1Num.value = labInfo.heroStat1Num || '';
      const popHeroStat1Label = document.getElementById('popLabHeroStat1Label');
      if (popHeroStat1Label) popHeroStat1Label.value = labInfo.heroStat1Label || '';
      const popHeroStat2Num = document.getElementById('popLabHeroStat2Num');
      if (popHeroStat2Num) popHeroStat2Num.value = labInfo.heroStat2Num || '';
      const popHeroStat2Label = document.getElementById('popLabHeroStat2Label');
      if (popHeroStat2Label) popHeroStat2Label.value = labInfo.heroStat2Label || '';
      const popHeroStat3Num = document.getElementById('popLabHeroStat3Num');
      if (popHeroStat3Num) popHeroStat3Num.value = labInfo.heroStat3Num || '';
      const popHeroStat3Label = document.getElementById('popLabHeroStat3Label');
      if (popHeroStat3Label) popHeroStat3Label.value = labInfo.heroStat3Label || '';

      for (let i = 1; i <= 4; i++) {
        const b = document.getElementById(`popLabCard${i}Badge`);
        if (b) b.value = labInfo[`card${i}Badge`] || '';
        const en = document.getElementById(`popLabCard${i}En`);
        if (en) en.value = labInfo[`card${i}En`] || '';
        const ja = document.getElementById(`popLabCard${i}Ja`);
        if (ja) ja.value = labInfo[`card${i}Ja`] || '';
        const status = document.getElementById(`popLabCard${i}Status`);
        if (status) status.value = labInfo[`card${i}Status`] || '';
        const tag1 = document.getElementById(`popLabCard${i}Tag1`);
        if (tag1) tag1.value = labInfo[`card${i}Tag1`] || '';
        const tag2 = document.getElementById(`popLabCard${i}Tag2`);
        if (tag2) tag2.value = labInfo[`card${i}Tag2`] || '';
        const tag3 = document.getElementById(`popLabCard${i}Tag3`);
        if (tag3) tag3.value = labInfo[`card${i}Tag3`] || '';
        const desc = document.getElementById(`popLabCard${i}Desc`);
        if (desc) desc.value = labInfo[`card${i}Desc`] || '';
        const gamePath = document.getElementById(`popLabCard${i}GamePath`);
        if (gamePath) gamePath.value = labInfo[`card${i}GamePath`] || '';
      }
    } catch (e) {
      console.warn('Failed to load lab section info in admin modal:', e);
    }

    // 05 STORE セクションのテキスト情報の読み込み
    try {
      const defaultStoreInfo = {
        sectionDesc: '動画で使用しているオリジナルピアノ楽譜をPiascore（ピアスコア）にて好評配信中。\n購入後すぐにPDFでダウンロード＆印刷可能です。',
        bannerTitle: '動画を見ながら一緒に弾ける。',
        bannerHighlight: '公式オリジナルピアノ楽譜。',
        bannerDesc: '当チャンネルの動画内で演奏しているアレンジをそのまま完全再現したオリジナルピアノ楽譜です。国内最大級の楽譜配信プラットフォーム「Piascore」にて安全に即時ダウンロードいただけます。',
        publisherUrl: '',
        guideDesc: 'Piascoreで購入いただいた楽譜は、iPad・iPhone・Android・パソコンですぐに閲覧・印刷いただけます。Piascoreアプリの自動譜めくり機能や書き込み機能にも完全対応しています。'
      };
      const savedStore = localStorage.getItem('piano_cinema_custom_store_info');
      const storeInfo = savedStore ? { ...defaultStoreInfo, ...JSON.parse(savedStore) } : defaultStoreInfo;

      const popSecDesc = document.getElementById('popStoreSectionDesc');
      if (popSecDesc) popSecDesc.value = storeInfo.sectionDesc || '';
      const popBanTitle = document.getElementById('popStoreBannerTitle');
      if (popBanTitle) popBanTitle.value = storeInfo.bannerTitle || '';
      const popBanHl = document.getElementById('popStoreBannerHighlight');
      if (popBanHl) popBanHl.value = storeInfo.bannerHighlight || '';
      const popBanDesc = document.getElementById('popStoreBannerDesc');
      if (popBanDesc) popBanDesc.value = storeInfo.bannerDesc || '';
      const popPubUrl = document.getElementById('popStorePublisherUrl');
      if (popPubUrl) popPubUrl.value = storeInfo.publisherUrl || '';
      const popGuideDesc = document.getElementById('popStoreGuideDesc');
      if (popGuideDesc) popGuideDesc.value = storeInfo.guideDesc || '';
    } catch (e) {
      console.warn('Failed to load store info in admin modal:', e);
    }

    // 00 HEADER エリアのテキスト情報の読み込み
    try {
      const defaultHeaderInfo = {
        title: 'MUSIC TECH LAB',
        tag: '最新アニソン&ゲーム音楽・ピアノCH'
      };
      const savedHeader = localStorage.getItem('piano_cinema_custom_header_info');
      const headerInfo = savedHeader ? { ...defaultHeaderInfo, ...JSON.parse(savedHeader) } : defaultHeaderInfo;

      const popNavTitle = document.getElementById('popNavChannelTitle');
      if (popNavTitle) popNavTitle.value = headerInfo.title || '';
      const popNavTag = document.getElementById('popNavChannelTag');
      if (popNavTag) popNavTag.value = headerInfo.tag || '';
    } catch (e) {
      console.warn('Failed to load header info in admin modal:', e);
    }

    // 06 PROFILE セクションのテキスト情報の読み込み
    try {
      const defaultProfileInfo = {
        topText: 'プロフィール上部テキスト（ここへ1列目の文章が入ります）',
        bottomText1: 'プロフィール下部テキスト1',
        bottomText2: 'プロフィール下部テキスト2'
      };
      const savedProfile = localStorage.getItem('piano_cinema_custom_profile_info');
      const profileInfo = savedProfile ? { ...defaultProfileInfo, ...JSON.parse(savedProfile) } : defaultProfileInfo;

      const popProfTop = document.getElementById('popProfileTopText');
      if (popProfTop) popProfTop.value = profileInfo.topText || '';
      const popProfB1 = document.getElementById('popProfileBottomText1');
      if (popProfB1) popProfB1.value = profileInfo.bottomText1 || '';
      const popProfB2 = document.getElementById('popProfileBottomText2');
      if (popProfB2) popProfB2.value = profileInfo.bottomText2 || '';
    } catch (e) {
      console.warn('Failed to load profile info in admin modal:', e);
    }

    // 新曲リクエストエリアのテキスト情報の読み込み
    try {
      const defaultRequestInfo = {
        mainTitle: 'アニメ改変期！新曲リクエスト祭り',
        deadline: '【投票期限】〇月〇日 23:59 まで',
        rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
        note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
        legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
        legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
        goalCount: 30,
        dailyLimit: 1,
        stepCount: 1,
        checkpoint1: 10,
        checkpoint2: 25,
        songs: [
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
        ]
      };
      const savedRequest = localStorage.getItem('piano_cinema_custom_request_info');
      const requestInfo = savedRequest ? { ...defaultRequestInfo, ...JSON.parse(savedRequest) } : defaultRequestInfo;

      const popReqTitle = document.getElementById('popRequestMainTitle');
      if (popReqTitle) popReqTitle.value = requestInfo.mainTitle || '';
      const popReqDl = document.getElementById('popRequestDeadline');
      if (popReqDl) popReqDl.value = requestInfo.deadline || '';
      const popReqRule = document.getElementById('popRequestRule');
      if (popReqRule) popReqRule.value = requestInfo.rule || '';
      const popReqNote = document.getElementById('popRequestNote');
      if (popReqNote) popReqNote.value = requestInfo.note || '';
      const popReqLegL = document.getElementById('popRequestLegendLeft');
      if (popReqLegL) popReqLegL.value = requestInfo.legendLeft || '';
      const popReqLegR = document.getElementById('popRequestLegendRight');
      if (popReqLegR) popReqLegR.value = requestInfo.legendRight || '';

      const popGoal = document.getElementById('popRequestGoalCount');
      if (popGoal) popGoal.value = requestInfo.goalCount !== undefined ? requestInfo.goalCount : 30;
      const popDaily = document.getElementById('popRequestDailyLimit');
      if (popDaily) popDaily.value = requestInfo.dailyLimit !== undefined ? requestInfo.dailyLimit : 1;
      const popStep = document.getElementById('popRequestStepCount');
      if (popStep) popStep.value = requestInfo.stepCount !== undefined ? requestInfo.stepCount : 1;
      const popCp1 = document.getElementById('popRequestCheckpoint1');
      if (popCp1) popCp1.value = requestInfo.checkpoint1 !== undefined ? requestInfo.checkpoint1 : 10;
      const popCp2 = document.getElementById('popRequestCheckpoint2');
      if (popCp2) popCp2.value = requestInfo.checkpoint2 !== undefined ? requestInfo.checkpoint2 : 25;

      const songs = Array.isArray(requestInfo.songs) && requestInfo.songs.length >= 12
        ? requestInfo.songs
        : defaultRequestInfo.songs;
      for (let i = 1; i <= 12; i++) {
        const inputEl = document.getElementById(`popRequestSong${i}`);
        if (inputEl) {
          inputEl.value = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
        }
      }
    } catch (e) {
      console.warn('Failed to load request info in admin modal:', e);
    }

    // 第2弾新曲リクエストエリアのテキスト情報の読み込み
    try {
      const defaultRequest2Info = {
        mainTitle: '名曲発掘！第2弾リクエスト祭り',
        deadline: '【投票期限】〇月〇日 23:59 まで',
        rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
        note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
        legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
        legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
        goalCount: 30,
        dailyLimit: 1,
        stepCount: 1,
        checkpoint1: 10,
        checkpoint2: 25,
        songs: [
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
        ]
      };
      const savedRequest2 = localStorage.getItem('piano_cinema_custom_request2_info');
      const request2Info = savedRequest2 ? { ...defaultRequest2Info, ...JSON.parse(savedRequest2) } : defaultRequest2Info;

      const popReqTitle = document.getElementById('popRequest2MainTitle');
      if (popReqTitle) popReqTitle.value = request2Info.mainTitle || '';
      const popReqDl = document.getElementById('popRequest2Deadline');
      if (popReqDl) popReqDl.value = request2Info.deadline || '';
      const popReqRule = document.getElementById('popRequest2Rule');
      if (popReqRule) popReqRule.value = request2Info.rule || '';
      const popReqNote = document.getElementById('popRequest2Note');
      if (popReqNote) popReqNote.value = request2Info.note || '';
      const popReqLegL = document.getElementById('popRequest2LegendLeft');
      if (popReqLegL) popReqLegL.value = request2Info.legendLeft || '';
      const popReqLegR = document.getElementById('popRequest2LegendRight');
      if (popReqLegR) popReqLegR.value = request2Info.legendRight || '';

      const popGoal = document.getElementById('popRequest2GoalCount');
      if (popGoal) popGoal.value = request2Info.goalCount !== undefined ? request2Info.goalCount : 30;
      const popDaily = document.getElementById('popRequest2DailyLimit');
      if (popDaily) popDaily.value = request2Info.dailyLimit !== undefined ? request2Info.dailyLimit : 1;
      const popStep = document.getElementById('popRequest2StepCount');
      if (popStep) popStep.value = request2Info.stepCount !== undefined ? request2Info.stepCount : 1;
      const popCp1 = document.getElementById('popRequest2Checkpoint1');
      if (popCp1) popCp1.value = request2Info.checkpoint1 !== undefined ? request2Info.checkpoint1 : 10;
      const popCp2 = document.getElementById('popRequest2Checkpoint2');
      if (popCp2) popCp2.value = request2Info.checkpoint2 !== undefined ? request2Info.checkpoint2 : 25;

      const songs = Array.isArray(request2Info.songs) && request2Info.songs.length >= 12
        ? request2Info.songs
        : defaultRequest2Info.songs;
      for (let i = 1; i <= 12; i++) {
        const inputEl = document.getElementById(`popRequest2Song${i}`);
        if (inputEl) {
          inputEl.value = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
        }
      }
    } catch (e) {
      console.warn('Failed to load request2 info in admin modal:', e);
    }

    // 第3弾新曲リクエストエリアのテキスト情報の読み込み
    try {
      const defaultRequest3Info = {
        mainTitle: '熱狂リクエスト！第3弾リクエスト祭り',
        deadline: '【投票期限】〇月〇日 23:59 まで',
        rule: '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
        note: '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
        legendLeft: '緑：募集中\n橙：チャンス\n赤：制作決定',
        legendRight: '緑：募集中\n橙：チャンス\n赤：制作決定',
        goalCount: 30,
        dailyLimit: 1,
        stepCount: 1,
        checkpoint1: 10,
        checkpoint2: 25,
        songs: [
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名',
          'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名', 'リクエスト曲名'
        ]
      };
      const savedRequest3 = localStorage.getItem('piano_cinema_custom_request3_info');
      const request3Info = savedRequest3 ? { ...defaultRequest3Info, ...JSON.parse(savedRequest3) } : defaultRequest3Info;

      const popReqTitle = document.getElementById('popRequest3MainTitle');
      if (popReqTitle) popReqTitle.value = request3Info.mainTitle || '';
      const popReqDl = document.getElementById('popRequest3Deadline');
      if (popReqDl) popReqDl.value = request3Info.deadline || '';
      const popReqRule = document.getElementById('popRequest3Rule');
      if (popReqRule) popReqRule.value = request3Info.rule || '';
      const popReqNote = document.getElementById('popRequest3Note');
      if (popReqNote) popReqNote.value = request3Info.note || '';
      const popReqLegL = document.getElementById('popRequest3LegendLeft');
      if (popReqLegL) popReqLegL.value = request3Info.legendLeft || '';
      const popReqLegR = document.getElementById('popRequest3LegendRight');
      if (popReqLegR) popReqLegR.value = request3Info.legendRight || '';

      const popGoal = document.getElementById('popRequest3GoalCount');
      if (popGoal) popGoal.value = request3Info.goalCount !== undefined ? request3Info.goalCount : 30;
      const popDaily = document.getElementById('popRequest3DailyLimit');
      if (popDaily) popDaily.value = request3Info.dailyLimit !== undefined ? request3Info.dailyLimit : 1;
      const popStep = document.getElementById('popRequest3StepCount');
      if (popStep) popStep.value = request3Info.stepCount !== undefined ? request3Info.stepCount : 1;
      const popCp1 = document.getElementById('popRequest3Checkpoint1');
      if (popCp1) popCp1.value = request3Info.checkpoint1 !== undefined ? request3Info.checkpoint1 : 10;
      const popCp2 = document.getElementById('popRequest3Checkpoint2');
      if (popCp2) popCp2.value = request3Info.checkpoint2 !== undefined ? request3Info.checkpoint2 : 25;

      const songs = Array.isArray(request3Info.songs) && request3Info.songs.length >= 12
        ? request3Info.songs
        : defaultRequest3Info.songs;
      for (let i = 1; i <= 12; i++) {
        const inputEl = document.getElementById(`popRequest3Song${i}`);
        if (inputEl) {
          inputEl.value = songs[i - 1] !== undefined ? songs[i - 1] : 'リクエスト曲名';
        }
      }
    } catch (e) {
      console.warn('Failed to load request3 info in admin modal:', e);
    }

    // 06 FOOTER エリアのテキスト情報の読み込み
    try {
      const defaultFooterInfo = {
        title: 'MUSIC TECH LAB',
        logoTag: '最新アニソン&ゲーム音楽・ピアノCH',
        motto: 'Latest Anime & Game Music Meets Modern Piano Resonance.',
        copyright: '© 2025 MUSIC TECH LAB 【最新アニソン&ゲーム音楽・ピアノCH】. All Rights Reserved.',
        designedBy: 'Crafted for Cinematic Music Experiences'
      };
      const savedFooter = localStorage.getItem('piano_cinema_custom_footer_info');
      const footerInfo = savedFooter ? { ...defaultFooterInfo, ...JSON.parse(savedFooter) } : defaultFooterInfo;

      const popFooterTitle = document.getElementById('popFooterChannelTitle');
      if (popFooterTitle) popFooterTitle.value = footerInfo.title || '';
      const popFooterTag = document.getElementById('popFooterLogoTag');
      if (popFooterTag) popFooterTag.value = footerInfo.logoTag || '';
      const popFooterMotto = document.getElementById('popFooterMotto');
      if (popFooterMotto) popFooterMotto.value = footerInfo.motto || '';
      const popFooterCopyright = document.getElementById('popFooterCopyright');
      if (popFooterCopyright) popFooterCopyright.value = footerInfo.copyright || '';
      const popFooterDesignedBy = document.getElementById('popFooterDesignedBy');
      if (popFooterDesignedBy) popFooterDesignedBy.value = footerInfo.designedBy || '';
    } catch (e) {
      console.warn('Failed to load footer info in admin modal:', e);
    }

    this.renderAdminPopupLists();
  }

  renderAdminPopupLists() {
    // 1. Regular
    const regList = document.getElementById('popListRegular');
    if (regList) {
      regList.innerHTML = '';
      this.adminState.regularVideos.forEach((v, index) => {
        const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
        const targetUrl = cleanId ? `https://www.youtube.com/watch?v=${cleanId}` : '#';
        const row = document.createElement('div');
        row.className = 'pop-item-row';
        const thumb = (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
        row.innerHTML = `
          <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" title="YouTubeで動画を開く">
            <img src="${thumb}" alt="${this.escapeHtml(v.title)}" class="pop-thumb">
          </a>
          <div class="pop-info">
            <span class="pop-tag">${this.escapeHtml(v.category || 'Main Cover')}</span>
            <div class="pop-title"><a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${this.escapeHtml(v.title)} <i data-lucide="external-link" style="width:11px;height:11px;display:inline;"></i></a></div>
            <div class="pop-meta">
              <span>ID: ${this.escapeHtml(cleanId)}</span>
              <span>時間: ${this.escapeHtml(v.duration || '1:45')}</span>
            </div>
          </div>
          <button type="button" class="btn-pop-del" title="削除" onclick="window.pianoApp.deletePopupRegular(${index})">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        `;
        regList.appendChild(row);
      });
    }

    // 2. Shorts
    const shtList = document.getElementById('popListShorts');
    if (shtList) {
      shtList.innerHTML = '';
      this.adminState.shortsVideos.forEach((v, index) => {
        const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
        const targetUrl = cleanId ? `https://www.youtube.com/shorts/${cleanId}` : '#';
        const row = document.createElement('div');
        row.className = 'pop-item-row';
        const thumb = (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
        row.innerHTML = `
          <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" title="YouTubeでShortsを開く">
            <img src="${thumb}" alt="${this.escapeHtml(v.title)}" class="pop-thumb shorts">
          </a>
          <div class="pop-info">
            <span class="pop-tag">Shorts</span>
            <div class="pop-title"><a href="${targetUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${this.escapeHtml(v.title)} <i data-lucide="external-link" style="width:11px;height:11px;display:inline;"></i></a></div>
            <div class="pop-meta">
              <span>ID: ${this.escapeHtml(cleanId)}</span>
              <span>再生: ${this.escapeHtml(v.views || '')}</span>
            </div>
          </div>
          <button type="button" class="btn-pop-del" title="削除" onclick="window.pianoApp.deletePopupShorts(${index})">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        `;
        shtList.appendChild(row);
      });
    }

    // 3. Sheets
    const sheetList = document.getElementById('popListSheets');
    if (sheetList) {
      sheetList.innerHTML = '';
      this.adminState.sheets.forEach((s, index) => {
        const row = document.createElement('div');
        row.className = 'pop-item-row';
        const thumb = s.thumbnail || 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=800&auto=format&fit=crop';
        const titleCol = s.titleColor || '#ffffff';
        row.innerHTML = `
          <img src="${thumb}" alt="${this.escapeHtml(s.title)}" class="pop-thumb">
          <div class="pop-info">
            <span class="pop-tag">${this.escapeHtml(s.tag || 'HOT')} / ¥${this.escapeHtml(s.price || '440')}</span>
            <div class="pop-title" style="color: ${this.escapeHtml(titleCol)}; white-space: pre-wrap;">${this.escapeHtml(s.title)} <small style="color:var(--text-muted);">(${this.escapeHtml(s.workTitle || '')})</small></div>
            <div class="pop-meta">
              <span>購入リンク設定済み</span>
              <span style="display:inline-flex;align-items:center;gap:4px;margin-left:8px;font-family:monospace;font-size:0.75rem;color:var(--gold-light);"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${this.escapeHtml(titleCol)};border:1px solid rgba(255,255,255,0.3);"></span>${this.escapeHtml(titleCol)}</span>
            </div>
          </div>
          <button type="button" class="btn-pop-del" title="削除" onclick="window.pianoApp.deletePopupSheet(${index})">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        `;
        sheetList.appendChild(row);
      });
    }

    this.refreshIcons();
  }

  deletePopupRegular(index) {
    this.adminState.regularVideos.splice(index, 1);
    this.renderAdminPopupLists();
  }

  deletePopupShorts(index) {
    this.adminState.shortsVideos.splice(index, 1);
    this.renderAdminPopupLists();
  }

  deletePopupSheet(index) {
    this.adminState.sheets.splice(index, 1);
    this.renderAdminPopupLists();
  }

  async saveAdminData(showNotification = true) {
    // 保存前に全ての動画IDを確実にサニタイズ
    this.adminState.regularVideos = this.adminState.regularVideos.map(v => {
      const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
      return {
        ...v,
        youtubeId: cleanId,
        thumbnail: (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`
      };
    });

    this.adminState.shortsVideos = this.adminState.shortsVideos.map(v => {
      const cleanId = this.extractYouTubeId(v.youtubeId || v.id) || v.youtubeId;
      return {
        ...v,
        youtubeId: cleanId,
        thumbnail: (v.thumbnail && !v.thumbnail.includes('/vi/http')) ? v.thumbnail : `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`
      };
    });

    // クライアント様が管理パネルから入力されたテキスト（空白スペース・改行含む）を1ミリも削らず素直に出力・保存するヘルパー
    const getRawVal = (id, fallback) => {
      const el = document.getElementById(id);
      if (!el) return fallback;
      const v = el.value;
      return (v !== undefined && v !== null && v !== '') ? v : fallback;
    };

    // 00 HEADER エリアのテキスト情報の保存
    const headerInfo = {
      title: getRawVal('popNavChannelTitle', 'MUSIC TECH LAB'),
      tag: getRawVal('popNavChannelTag', '最新アニソン&ゲーム音楽・ピアノCH')
    };

    // 00 HERO エリアのテキスト情報の保存（管理パネル入力通り100%素直に保存）
    const heroInfo = {
      title: getRawVal('popHeroMainTitle', '最新アニソン＆ゲーム音楽・ピアノCH 【Music Tech Lab】'),
      tagline: getRawVal('popHeroTagline', '88鍵が描き出す、原曲の熱量とシネマティックな音響美学。\n最新アニメ・ゲームの名曲を、初心者から愛好家まで楽しめるハイブリッド仕様でお届けします。'),
      metaTag: getRawVal('popHeroMetaTag', 'MUSIC TECH LAB / 最新アニソン＆ゲーム音楽・ピアノCH'),
      metaSub: getRawVal('popHeroMetaSub', 'ANIME & GAME MUSIC PIANO ARCHIVE'),
      brandPill: getRawVal('popHeroBrandPill', 'OFFICIAL PIANO ARCHIVE'),
      statLabel1: getRawVal('popHeroStatLabel1', 'TOTAL TRACKS'),
      statTotal: getRawVal('popHeroStatTotal', '130+ Works'),
      statLabel2: getRawVal('popHeroStatLabel2', 'ARRANGEMENTS'),
      statArrangements: getRawVal('popHeroStatArrangements', 'One-Chorus & Virtuoso'),
      statLabel3: getRawVal('popHeroStatLabel3', 'AUDIO MASTERS'),
      statAudio: getRawVal('popHeroStatAudio', 'Lossless High-Res')
    };

    // 01 FEATURES セクションのテキスト情報の保存
    const featuresInfo = {
      badge: document.getElementById('popFeaturesSectionBadge')?.value.trim() || 'MULTI-LAYERED VISUAL SPECIFICATIONS',
      title: document.getElementById('popFeaturesSectionTitle')?.value.trim() || '01 / FEATURES (動画のこだわり)',
      desc: document.getElementById('popFeaturesSectionDesc')?.value.trim() || '歌える・学べる・弾ける。すべての動画に施された5層のマルチ情報。\n初心者から海外ファンまで、見るだけで演奏が深まる究極の映像仕様。',
      card1Badge: document.getElementById('popFeatCard1Badge')?.value.trim() || 'SING ALONG',
      card1En: document.getElementById('popFeatCard1En')?.value.trim() || 'JAPANESE LYRICS',
      card1Ja: document.getElementById('popFeatCard1Ja')?.value.trim() || '日本語歌詞',
      card1Desc: document.getElementById('popFeatCard1Desc')?.value.trim() || '一緒に歌える、原曲のニュアンスや感情がダイレクトに伝わる洗練された日本語歌詞。',
      card1Tag: document.getElementById('popFeatCard1Tag')?.value.trim() || 'ニュアンスが伝わる',
      card2Badge: document.getElementById('popFeatCard2Badge')?.value.trim() || 'GLOBAL FANS',
      card2En: document.getElementById('popFeatCard2En')?.value.trim() || 'ROMAJI / ENGLISH LYRICS',
      card2Ja: document.getElementById('popFeatCard2Ja')?.value.trim() || 'アルファベット歌詞',
      card2Desc: document.getElementById('popFeatCard2Desc')?.value.trim() || '海外のファンも楽しめる英語・ローマ字歌詞。世界中どこからでも一緒に楽しめます。',
      card2Tag: document.getElementById('popFeatCard2Tag')?.value.trim() || '海外ファンも楽しめる',
      card3Badge: document.getElementById('popFeatCard3Badge')?.value.trim() || 'EASY TO PLAY',
      card3En: document.getElementById('popFeatCard3En')?.value.trim() || 'DO-RE-MI NOTATION',
      card3Ja: document.getElementById('popFeatCard3Ja')?.value.trim() || 'ドレミ音階',
      card3Desc: document.getElementById('popFeatCard3Desc')?.value.trim() || '初心者でもパッと見てすぐに弾けるドレミの案内。鍵盤のどこを弾くか一目で分かります。',
      card3Tag: document.getElementById('popFeatCard3Tag')?.value.trim() || '初心者もすぐに弾ける',
      card4Badge: document.getElementById('popFeatCard4Badge')?.value.trim() || 'CHORD & THEORY',
      card4En: document.getElementById('popFeatCard4En')?.value.trim() || 'C-D-E NOTATION',
      card4Ja: document.getElementById('popFeatCard4Ja')?.value.trim() || 'CDE音階',
      card4Desc: document.getElementById('popFeatCard4Desc')?.value.trim() || 'コードや国際基準で学べるアルファベット音階。ポピュラー音楽の理論やコード学習に最適。',
      card4Tag: document.getElementById('popFeatCard4Tag')?.value.trim() || '国際基準で学べる',
      card5Badge: document.getElementById('popFeatCard5Badge')?.value.trim() || 'PRACTICE COMPANION',
      card5En: document.getElementById('popFeatCard5En')?.value.trim() || 'RIGHT-HAND SHEET MUSIC',
      card5Ja: document.getElementById('popFeatCard5Ja')?.value.trim() || 'メロディ楽譜',
      card5Desc: document.getElementById('popFeatCard5Desc')?.value.trim() || '右手の五線譜がついているから、動画を見ながら一緒に練習できる親切な設計。',
      card5Tag: document.getElementById('popFeatCard5Tag')?.value.trim() || '動画を見ながら練習できる',
      bannerPill: document.getElementById('popFeatBannerPill')?.value.trim() || '5-IN-1 MULTI-SPECIFICATION',
      bannerTitle: document.getElementById('popFeatBannerTitle')?.value.trim() || '観る・歌う・弾ける。',
      bannerHighlight: document.getElementById('popFeatBannerHighlight')?.value.trim() || 'すべての動画が「練習＆鑑賞」のマルチ仕様。',
      bannerDesc: document.getElementById('popFeatBannerDesc')?.value.trim() || 'ピアノの演奏映像に、日本語歌詞・アルファベット歌詞・ドレミ・CDE・右手五線譜の5つの情報レイヤーを美しく統合。\nただ聴くだけでなく、弾きたい曲を自分のペースでマスターできる映像体験をお届けします。'
    };

    // 02 MAIN COVERS セクションのテキスト情報の保存
    const popRegYtInput = document.getElementById('popRegYoutubeUrl')?.value.trim();
    const regularInfo = {
      badge: document.getElementById('popRegSectionBadge')?.value.trim() || 'FULL HARMONIC ARRANGEMENTS',
      title: document.getElementById('popRegSectionTitle')?.value.trim() || '02 / MAIN COVERS (ワンコーラス)',
      youtubeUrl: (popRegYtInput && popRegYtInput !== 'https://youtube.com') ? popRegYtInput : '',
      desc: document.getElementById('popRegSectionDesc')?.value.trim() || 'じっくり聴かせる、原曲の魅力を凝縮したワンコーラス演奏。\nMelodic Depth & Dynamic Range — ピアノならではの豊かな響きを味わうメイン動画。'
    };

    // 03 SHORTS セクションのテキスト情報の保存
    const popShtYtInput = document.getElementById('popShtYoutubeUrl')?.value.trim();
    const shortsInfo = {
      badge: document.getElementById('popShtSectionBadge')?.value.trim() || 'CHORUS HIGHLIGHTS IN 60s',
      title: document.getElementById('popShtSectionTitle')?.value.trim() || '03 / SHORTS (サビだけ弾いてみた)',
      youtubeUrl: (popShtYtInput && popShtYtInput !== 'https://youtube.com') ? popShtYtInput : '',
      desc: document.getElementById('popShtSectionDesc')?.value.trim() || 'サビの爆発力を1分に凝縮した、疾走感あるショート動画。\nInstant Climax & Finger Speed — スマホに最適化された縦長ショート演奏。'
    };

    // 04 LAB APPS セクションのテキスト情報の保存
    const labInfo = {
      badge: document.getElementById('popLabSectionBadge')?.value.trim() || 'POWERED BY GOOGLE ANTIGRAVITY & AI',
      title: document.getElementById('popLabSectionTitle')?.value.trim() || '04 / LAB APPS (開発アプリ)',
      desc: document.getElementById('popLabSectionDesc')?.value.trim() || 'Google Antigravity × AIが加速させる、次世代の音楽テクノロジー開発。\nこのWebサイトをはじめ、動画制作を革新するすべてのツールをAntigravity環境上で最速開発。',
      heroBadge: document.getElementById('popLabHeroBadge')?.value.trim() || 'NEXT-GEN DEVELOPMENT PIPELINE',
      heroTitle: document.getElementById('popLabHeroTitle')?.value.trim() || 'すべては、',
      heroHighlight: document.getElementById('popLabHeroHighlight')?.value.trim() || 'Google Antigravity × 最先端AI と共に。',
      heroSubtitle: document.getElementById('popLabHeroSubtitle')?.value.trim() || '圧倒的なスピードで生み出される音楽プロダクト群。',
      heroDesc: document.getElementById('popLabHeroDesc')?.value.trim() || '当チャンネル「Music Tech Lab」のWebサイト自体はもちろん、動画内で活用しているビジュアライザーや歌詞同期アプリなど、すべてのプロダクトをGoogleが誇る次世代AI開発プラットフォーム「Google Antigravity」を活用して爆速構築しています。音楽と最先端テクノロジーの融合が、かつてない表現体験を切り拓きます。',
      heroStat1Num: document.getElementById('popLabHeroStat1Num')?.value.trim() || 'AI-Native',
      heroStat1Label: document.getElementById('popLabHeroStat1Label')?.value.trim() || 'Google Antigravity Driven',
      heroStat2Num: document.getElementById('popLabHeroStat2Num')?.value.trim() || 'Ultra Fast',
      heroStat2Label: document.getElementById('popLabHeroStat2Label')?.value.trim() || 'Rapid Iteration & Deploy',
      heroStat3Num: document.getElementById('popLabHeroStat3Num')?.value.trim() || 'In The Lab',
      heroStat3Label: document.getElementById('popLabHeroStat3Label')?.value.trim() || 'Multiple AI Tools Under Dev',
      card1Badge: document.getElementById('popLabCard1Badge')?.value.trim() || 'VISUAL EFFECT TOOL',
      card1En: document.getElementById('popLabCard1En')?.value.trim() || 'Audio Visualizer',
      card1Ja: document.getElementById('popLabCard1Ja')?.value.trim() || 'オーディオビジュアライザー',
      card1Status: document.getElementById('popLabCard1Status')?.value.trim() || 'Active in Production',
      card1Tag1: document.getElementById('popLabCard1Tag1')?.value.trim() || 'WebGL / Canvas',
      card1Tag2: document.getElementById('popLabCard1Tag2')?.value.trim() || 'Realtime FFT',
      card1Tag3: document.getElementById('popLabCard1Tag3')?.value.trim() || 'Antigravity Built',
      card1Desc: document.getElementById('popLabCard1Desc')?.value.trim() || '音楽の周波数波形や響きを美しくリアルタイム可視化するエフェクトツール。音の強弱に呼応するシネマティックな光彩パーティクルが、演奏動画の没入感を極限まで高めます。',
      card1GamePath: document.getElementById('popLabCard1GamePath')?.value.trim() || '',
      card2Badge: document.getElementById('popLabCard2Badge')?.value.trim() || 'KARAOKE SYNC SYSTEM',
      card2En: document.getElementById('popLabCard2En')?.value.trim() || 'Lrc Sync App',
      card2Ja: document.getElementById('popLabCard2Ja')?.value.trim() || '同期型カラオケ歌詞アプリ',
      card2Status: document.getElementById('popLabCard2Status')?.value.trim() || 'Active in Production',
      card2Tag1: document.getElementById('popLabCard2Tag1')?.value.trim() || 'Spacebar Rhythm Input',
      card2Tag2: document.getElementById('popLabCard2Tag2')?.value.trim() || 'Smooth Color Flow',
      card2Tag3: document.getElementById('popLabCard2Tag3')?.value.trim() || 'Antigravity Built',
      card2Desc: document.getElementById('popLabCard2Desc')?.value.trim() || 'スペースキーを曲に合わせてトントンと叩くだけで歌詞のタイムスタンプを直感的に記憶。カラオケのように歌詞の色が滑らかに変化する動画用テロップを即座に出力する次世代システム。',
      card2GamePath: document.getElementById('popLabCard2GamePath')?.value.trim() || '',
      card3Badge: document.getElementById('popLabCard3Badge')?.value.trim() || 'REACTIVE 2D/3D ANIMATION',
      card3En: document.getElementById('popLabCard3En')?.value.trim() || 'Sonic Avatars',
      card3Ja: document.getElementById('popLabCard3Ja')?.value.trim() || '音波連動キャラクター',
      card3Status: document.getElementById('popLabCard3Status')?.value.trim() || 'Active in Production',
      card3Tag1: document.getElementById('popLabCard3Tag1')?.value.trim() || 'Beat Reactive',
      card3Tag2: document.getElementById('popLabCard3Tag2')?.value.trim() || 'Animal Avatars',
      card3Tag3: document.getElementById('popLabCard3Tag3')?.value.trim() || 'Antigravity Built',
      card3Desc: document.getElementById('popLabCard3Desc')?.value.trim() || '音楽のビートやアタック音に合わせて、リアルタイムにリズミカルに踊り出す犬、猫、ウサギなどの愛らしい動物キャラクター群。動画画面を賑やかに彩るインタラクティブ演出。',
      card3GamePath: document.getElementById('popLabCard3GamePath')?.value.trim() || '',
      card4Badge: document.getElementById('popLabCard4Badge')?.value.trim() || 'FUTURE ECOSYSTEM',
      card4En: document.getElementById('popLabCard4En')?.value.trim() || 'Music AI Ecosystem',
      card4Ja: document.getElementById('popLabCard4Ja')?.value.trim() || '次世代音楽AIツール群',
      card4Status: document.getElementById('popLabCard4Status')?.value.trim() || 'In Active Development',
      card4Tag1: document.getElementById('popLabCard4Tag1')?.value.trim() || 'AI Audio Gen',
      card4Tag2: document.getElementById('popLabCard4Tag2')?.value.trim() || 'Harmonic Engine',
      card4Tag3: document.getElementById('popLabCard4Tag3')?.value.trim() || 'In Active R&D',
      card4Desc: document.getElementById('popLabCard4Desc')?.value.trim() || '自動楽譜認識・伴奏生成・音源分離など、多数の音楽AIツールをGoogle Antigravity上で現在鋭意開発中。テクノロジーで音楽表現の未来を拡張し続けます。',
      card4GamePath: document.getElementById('popLabCard4GamePath')?.value.trim() || ''
    };

    // 05 STORE セクションのテキスト情報の保存
    const storeInfo = {
      sectionDesc: document.getElementById('popStoreSectionDesc')?.value.trim() || '動画で使用しているオリジナルピアノ楽譜をPiascore（ピアスコア）にて好評配信中。\n購入後すぐにPDFでダウンロード＆印刷可能です。',
      bannerTitle: document.getElementById('popStoreBannerTitle')?.value.trim() || '動画を見ながら一緒に弾ける。',
      bannerHighlight: document.getElementById('popStoreBannerHighlight')?.value.trim() || '公式オリジナルピアノ楽譜。',
      bannerDesc: document.getElementById('popStoreBannerDesc')?.value.trim() || '当チャンネルの動画内で演奏しているアレンジをそのまま完全再現したオリジナルピアノ楽譜です。国内最大級の楽譜配信プラットフォーム「Piascore」にて安全に即時ダウンロードいただけます。',
      publisherUrl: document.getElementById('popStorePublisherUrl')?.value.trim() || '',
      guideDesc: document.getElementById('popStoreGuideDesc')?.value.trim() || 'Piascoreで購入いただいた楽譜は、iPad・iPhone・Android・パソコンですぐに閲覧・印刷いただけます。Piascoreアプリの自動譜めくり機能や書き込み機能にも完全対応しています。'
    };

    // 06 PROFILE セクションのテキスト情報の保存
    const profileInfo = {
      topText: document.getElementById('popProfileTopText')?.value.trim() || 'プロフィール上部テキスト（ここへ1列目の文章が入ります）',
      bottomText1: document.getElementById('popProfileBottomText1')?.value.trim() || 'プロフィール下部テキスト1',
      bottomText2: document.getElementById('popProfileBottomText2')?.value.trim() || 'プロフィール下部テキスト2'
    };

    // 新曲リクエストエリアのテキスト・数値情報の保存
    const requestSongs = [];
    for (let i = 1; i <= 12; i++) {
      const val = document.getElementById(`popRequestSong${i}`)?.value.trim() || 'リクエスト曲名';
      requestSongs.push(val);
    }

    const parseReqNum = (id, fallback) => {
      const el = document.getElementById(id);
      if (!el) return fallback;
      const val = parseInt(el.value, 10);
      return isNaN(val) ? fallback : val;
    };

    const requestInfo = {
      mainTitle: document.getElementById('popRequestMainTitle')?.value.trim() || 'アニメ改変期！新曲リクエスト祭り',
      deadline: document.getElementById('popRequestDeadline')?.value.trim() || '【投票期限】〇月〇日 23:59 まで',
      rule: document.getElementById('popRequestRule')?.value.trim() || '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: document.getElementById('popRequestNote')?.value.trim() || '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: document.getElementById('popRequestLegendLeft')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: document.getElementById('popRequestLegendRight')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: parseReqNum('popRequestGoalCount', 30),
      dailyLimit: parseReqNum('popRequestDailyLimit', 1),
      stepCount: parseReqNum('popRequestStepCount', 1),
      checkpoint1: parseReqNum('popRequestCheckpoint1', 10),
      checkpoint2: parseReqNum('popRequestCheckpoint2', 25),
      songs: requestSongs
    };

    // 第2弾新曲リクエストエリアのテキスト・数値情報の保存
    const request2Songs = [];
    for (let i = 1; i <= 12; i++) {
      const val = document.getElementById(`popRequest2Song${i}`)?.value.trim() || 'リクエスト曲名';
      request2Songs.push(val);
    }

    const request2Info = {
      mainTitle: document.getElementById('popRequest2MainTitle')?.value.trim() || '名曲発掘！第2弾リクエスト祭り',
      deadline: document.getElementById('popRequest2Deadline')?.value.trim() || '【投票期限】〇月〇日 23:59 まで',
      rule: document.getElementById('popRequest2Rule')?.value.trim() || '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: document.getElementById('popRequest2Note')?.value.trim() || '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: document.getElementById('popRequest2LegendLeft')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: document.getElementById('popRequest2LegendRight')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: parseReqNum('popRequest2GoalCount', 30),
      dailyLimit: parseReqNum('popRequest2DailyLimit', 1),
      stepCount: parseReqNum('popRequest2StepCount', 1),
      checkpoint1: parseReqNum('popRequest2Checkpoint1', 10),
      checkpoint2: parseReqNum('popRequest2Checkpoint2', 25),
      songs: request2Songs
    };

    // 第3弾新曲リクエストエリアのテキスト・数値情報の保存
    const request3Songs = [];
    for (let i = 1; i <= 12; i++) {
      const val = document.getElementById(`popRequest3Song${i}`)?.value.trim() || 'リクエスト曲名';
      request3Songs.push(val);
    }

    const request3Info = {
      mainTitle: document.getElementById('popRequest3MainTitle')?.value.trim() || '熱狂リクエスト！第3弾リクエスト祭り',
      deadline: document.getElementById('popRequest3Deadline')?.value.trim() || '【投票期限】〇月〇日 23:59 まで',
      rule: document.getElementById('popRequest3Rule')?.value.trim() || '目標カウントに達した楽曲は、即座に動画＆楽譜化を決定します！',
      note: document.getElementById('popRequest3Note')?.value.trim() || '※期限までに届かなかった楽曲はカウントをリセットして次の新曲と入れ替わります',
      legendLeft: document.getElementById('popRequest3LegendLeft')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      legendRight: document.getElementById('popRequest3LegendRight')?.value.trim() || '緑：募集中\n橙：チャンス\n赤：制作決定',
      goalCount: parseReqNum('popRequest3GoalCount', 30),
      dailyLimit: parseReqNum('popRequest3DailyLimit', 1),
      stepCount: parseReqNum('popRequest3StepCount', 1),
      checkpoint1: parseReqNum('popRequest3Checkpoint1', 10),
      checkpoint2: parseReqNum('popRequest3Checkpoint2', 25),
      songs: request3Songs
    };

    // 06 FOOTER エリアのテキスト情報の保存
    const footerInfo = {
      title: document.getElementById('popFooterChannelTitle')?.value.trim() || 'MUSIC TECH LAB',
      logoTag: document.getElementById('popFooterLogoTag')?.value.trim() || '最新アニソン&ゲーム音楽・ピアノCH',
      motto: document.getElementById('popFooterMotto')?.value.trim() || 'Latest Anime & Game Music Meets Modern Piano Resonance.',
      copyright: document.getElementById('popFooterCopyright')?.value.trim() || '© 2025 MUSIC TECH LAB 【最新アニソン&ゲーム音楽・ピアノCH】. All Rights Reserved.',
      designedBy: document.getElementById('popFooterDesignedBy')?.value.trim() || 'Crafted for Cinematic Music Experiences'
    };

    localStorage.setItem('piano_cinema_custom_header_info', JSON.stringify(headerInfo));
    localStorage.setItem('piano_cinema_custom_hero_info', JSON.stringify(heroInfo));
    localStorage.setItem('piano_cinema_custom_features_info', JSON.stringify(featuresInfo));
    localStorage.setItem('piano_cinema_custom_regular_info', JSON.stringify(regularInfo));
    localStorage.setItem('piano_cinema_custom_shorts_info', JSON.stringify(shortsInfo));
    localStorage.setItem('piano_cinema_custom_lab_info', JSON.stringify(labInfo));
    localStorage.setItem('piano_cinema_custom_store_info', JSON.stringify(storeInfo));
    localStorage.setItem('piano_cinema_custom_profile_info', JSON.stringify(profileInfo));
    localStorage.setItem('piano_cinema_custom_request_info', JSON.stringify(requestInfo));
    localStorage.setItem('piano_cinema_custom_request2_info', JSON.stringify(request2Info));
    localStorage.setItem('piano_cinema_custom_request3_info', JSON.stringify(request3Info));
    localStorage.setItem('piano_cinema_custom_footer_info', JSON.stringify(footerInfo));
    localStorage.setItem('piano_cinema_custom_channel_a', JSON.stringify(this.adminState.regularVideos));
    localStorage.setItem('piano_cinema_custom_channel_b', JSON.stringify(this.adminState.shortsVideos));
    this.adminState.sheets = (this.adminState.sheets || []).map(s => ({
      ...s,
      titleColor: s.titleColor || '#ffffff'
    }));
    localStorage.setItem('piano_cinema_custom_sheets', JSON.stringify(this.adminState.sheets));

    // ポート8888へ即時送信（Wi-Fi全端末へのリアルタイム完全同期）
    const syncPayload = {
      piano_cinema_custom_header_info: headerInfo,
      piano_cinema_custom_hero_info: heroInfo,
      piano_cinema_custom_features_info: featuresInfo,
      piano_cinema_custom_regular_info: regularInfo,
      piano_cinema_custom_shorts_info: shortsInfo,
      piano_cinema_custom_lab_info: labInfo,
      piano_cinema_custom_store_info: storeInfo,
      piano_cinema_custom_profile_info: profileInfo,
      piano_cinema_custom_request_info: requestInfo,
      piano_cinema_custom_request2_info: request2Info,
      piano_cinema_custom_request3_info: request3Info,
      piano_cinema_custom_footer_info: footerInfo,
      piano_cinema_custom_channel_a: this.adminState.regularVideos,
      piano_cinema_custom_channel_b: this.adminState.shortsVideos,
      piano_cinema_custom_sheets: this.adminState.sheets
    };
    this.syncToServer(syncPayload);

    // メインサイトのデータを再初期化 & 即時再描画
    this.youtubeService.initDemoData();
    await this.loadInitialVideos();
    this.loadSectionHeaders();
    this.loadStoreTexts();
    this.loadSheetMusic();
    this.loadProfileTexts();
    this.loadRequestTexts();
    this.updateAllRequestSlots();
    this.loadRequest2Texts();
    this.updateAllRequest2Slots();
    this.loadRequest3Texts();
    this.updateAllRequest3Slots();

    if (showNotification) {
      this.showToast('✨ サイトを更新しました！メイン画面に即座に反映されました。');
      setTimeout(() => {
        this.closeAdminModal();
      }, 1000);
    }
  }

  /**
   * あらゆる形式のYouTube URL（youtu.be, shorts, watch, studio, live, embed等）から動画IDを抽出
   */
  extractYouTubeId(urlOrId) {
    if (typeof YouTubeService !== 'undefined' && YouTubeService.extractYouTubeId) {
      return YouTubeService.extractYouTubeId(urlOrId);
    }
    if (!urlOrId) return '';
    let input = String(urlOrId).trim();
    const srcMatch = input.match(/src=["']([^"']+)["']/i);
    if (srcMatch) input = srcMatch[1].trim();
    input = input.replace(/^["']|["']$/g, '');
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const vParamMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&#?].*)?$/);
    if (vParamMatch && vParamMatch[1]) return vParamMatch[1];
    const pathPatterns = [
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|v\/|live\/|video\/))([a-zA-Z0-9_-]{11})/i,
      /(?:studio\.youtube\.com\/video\/)([a-zA-Z0-9_-]{11})/i,
      /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/i
    ];
    for (const pattern of pathPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) return match[1];
    }
    const genericMatch = input.match(/(?:[/?=])([a-zA-Z0-9_-]{11})(?:[/?#&]|$)/);
    if (genericMatch && genericMatch[1] && genericMatch[1] !== 'watch' && genericMatch[1] !== 'video') {
      return genericMatch[1];
    }
    return '';
  }

  /**
   * YouTube動画ページを別タブ（target="_blank"）で開く
   */
  openTheater(video, type = 'regular') {
    const isShorts = type === 'shorts' || video?.isShorts;
    const cleanId = this.extractYouTubeId(video?.youtubeId || video?.id) || video?.youtubeId;
    if (!cleanId) {
      console.error('[Piano Cinema] Could not resolve a valid YouTube video ID for:', video);
      this.showToast('⚠️ 有効な動画リンクが見つかりませんでした');
      return;
    }

    const targetUrl = isShorts
      ? `https://www.youtube.com/shorts/${cleanId}`
      : `https://www.youtube.com/watch?v=${cleanId}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * シアターモーダルを閉じる
   */
  closeTheater() {
    if (!this.theaterModal || !this.theaterIframe) return;
    this.theaterModal.classList.remove('is-active');
    this.theaterIframe.src = '';
    document.body.style.overflow = '';
  }

  /**
   * トースト通知の表示
   */
  showToast(message) {
    if (!this.toastNotification || !this.toastMsg) return;
    this.toastMsg.textContent = message;
    this.toastNotification.classList.add('is-active');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastNotification.classList.remove('is-active');
    }, 3800);
  }

  /**
   * フルスクリーン時戻るボタンのインラインスタイル（style属性）強制直接適用
   */
  applyOverlayCloseButtonStyles(btn) {
    if (!btn) return;
    btn.style.backgroundColor = '#ff0055'; // 鮮やかな赤で下の文字を完全に塗りつぶす
    btn.style.color = '#ffff00'; // 文字色は鮮やかな黄色
    btn.style.padding = '12px 24px'; // 縦横を物理的に2倍以上に広げる余白
    btn.style.fontSize = '18px'; // 大きく見やすい文字サイズ
    btn.style.fontWeight = 'bold'; // 太字
    btn.style.border = '2px solid #ffff00'; // 黄色の太い枠線でゲーム風にする
    btn.style.borderRadius = '8px'; // 角丸
    btn.style.position = 'fixed'; // 画面右上に固定
    btn.style.top = '10px'; // 上からの位置（ゲームの全画面文字が100%隠れるように適宜調整）
    btn.style.right = '10px'; // 右からの位置
    btn.style.zIndex = '2147483647'; // 絶対最前面
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    btn.style.outline = 'none';
    btn.style.boxShadow = '0 4px 0 #990033, 0 8px 24px rgba(0, 0, 0, 0.85)';
    btn.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    btn.style.letterSpacing = '1px';
    btn.style.lineHeight = '1.3';
    btn.style.textAlign = 'center';
    btn.style.boxSizing = 'border-box';
    btn.style.opacity = '1';
    btn.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s ease';

    // 3D立体アニメーション（クリック・タップ時に奥へ沈み込む）
    if (!btn.dataset.pressBound) {
      btn.dataset.pressBound = 'true';
      btn.addEventListener('mousedown', () => {
        btn.style.transform = 'scale(0.95) translate(2px, 2px)';
        btn.style.boxShadow = '0 1px 0 #990033, 0 2px 8px rgba(0, 0, 0, 0.9)';
      });
      btn.addEventListener('mouseup', () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 4px 0 #990033, 0 8px 24px rgba(0, 0, 0, 0.85)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 4px 0 #990033, 0 8px 24px rgba(0, 0, 0, 0.85)';
      });
      btn.addEventListener('touchstart', () => {
        btn.style.transform = 'scale(0.95) translate(2px, 2px)';
        btn.style.boxShadow = '0 1px 0 #990033, 0 2px 8px rgba(0, 0, 0, 0.9)';
      }, { passive: true });
      btn.addEventListener('touchend', () => {
        btn.style.transform = 'none';
        btn.style.boxShadow = '0 4px 0 #990033, 0 8px 24px rgba(0, 0, 0, 0.85)';
      }, { passive: true });
    }
  }

  /**
   * ゲームiframe内部への戻るボタン（目隠し構造）の同期注入
   */
  syncIframeOverlayButton(iframe) {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body) return;

      let iframeCloseBtn = doc.getElementById('iframeGameFullscreenClose');
      if (!iframeCloseBtn) {
        iframeCloseBtn = doc.createElement('button');
        iframeCloseBtn.id = 'iframeGameFullscreenClose';
        iframeCloseBtn.type = 'button';
        iframeCloseBtn.className = 'iframe-game-fs-close';
        iframeCloseBtn.setAttribute('aria-label', '全画面を閉じる (Esc)');
        iframeCloseBtn.innerHTML = `
          <span style="position:relative;display:inline-flex;align-items:center;gap:8px;">
            <span style="font-size:20px;font-weight:bold;color:#ffff00;">✕</span>
            <span style="font-size:18px;font-weight:bold;color:#ffff00;text-shadow:0 1px 3px rgba(0,0,0,0.8);">閉じる (Esc)</span>
          </span>
        `;
        this.applyOverlayCloseButtonStyles(iframeCloseBtn);
        iframeCloseBtn.style.setProperty('display', 'none', 'important');
        doc.body.appendChild(iframeCloseBtn);

        iframeCloseBtn.addEventListener('mouseenter', () => {
          if (this.soundEngine && typeof this.soundEngine.playHoverSound === 'function') {
            this.soundEngine.playHoverSound();
          }
        });

        iframeCloseBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
            this.soundEngine.playClickSound('se/click.mp3');
          }

          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(() => {});
          }
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          }
        });
      }

      const updateIframeFs = () => {
        const isFs = !!(
          doc.fullscreenElement ||
          doc.webkitFullscreenElement ||
          doc.mozFullScreenElement ||
          doc.msFullscreenElement ||
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        );
        if (isFs) {
          doc.body.classList.add('in-fullscreen');
          if (iframeCloseBtn) {
            iframeCloseBtn.style.setProperty('display', 'inline-flex', 'important');
            this.applyOverlayCloseButtonStyles(iframeCloseBtn);
          }
        } else {
          doc.body.classList.remove('in-fullscreen');
          if (iframeCloseBtn) {
            iframeCloseBtn.style.setProperty('display', 'none', 'important');
          }
        }
      };

      ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
        doc.addEventListener(evtName, updateIframeFs);
      });
      updateIframeFs();
    } catch (e) {
      console.warn('Iframe overlay button sync error:', e);
    }
  }

  /**
   * 04 LAB APPS ゲーム単体フルスクリーン化機能 & フルスクリーン時専用戻るボタン（目隠し構造）の初期化
   */
  initGameFullscreen() {
    const btn = document.getElementById('btnGameFullscreen');
    const gameContainer = document.getElementById('labCard1GameContainer');
    if (!btn || !gameContainer) return;

    // 閉じる（戻る）ボタンDOMの取得または安全な自動生成
    let closeBtn = document.getElementById('btnGameFullscreenClose');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-game-fullscreen-close';
      closeBtn.id = 'btnGameFullscreenClose';
      closeBtn.setAttribute('aria-label', '全画面を閉じる (Esc)');
      closeBtn.style.setProperty('display', 'none', 'important');
      closeBtn.innerHTML = `
        <span class="btn-fs-close-content">
          <span class="btn-fs-close-icon">✕</span>
          <span class="btn-fs-close-text">閉じる <span class="btn-fs-close-key">(Esc)</span></span>
        </span>
      `;
      gameContainer.appendChild(closeBtn);
    }

    if (closeBtn) {
      this.applyOverlayCloseButtonStyles(closeBtn);
      closeBtn.style.setProperty('display', 'none', 'important');
    }

    // ホバーSE登録
    btn.addEventListener('mouseenter', () => {
      if (this.soundEngine && typeof this.soundEngine.playHoverSound === 'function') {
        this.soundEngine.playHoverSound();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('mouseenter', () => {
        if (this.soundEngine && typeof this.soundEngine.playHoverSound === 'function') {
          this.soundEngine.playHoverSound();
        }
      });
    }

    const setupIframeSync = (iframe) => {
      if (!iframe) return;
      iframe.addEventListener('load', () => {
        this.syncIframeOverlayButton(iframe);
      });
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        this.syncIframeOverlayButton(iframe);
      }
    };

    let initialIframe = gameContainer.querySelector('iframe');
    if (initialIframe) {
      setupIframeSync(initialIframe);
    }

    // フルスクリーン開始（全画面でプレイボタン）
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
        this.soundEngine.playClickSound('se/click.mp3');
      }

      gameContainer.style.display = 'block';

      let iframe = gameContainer.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.className = 'app-game-iframe';
        iframe.setAttribute('src', 'games/index.html');
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; midi; keyboard-map');
        iframe.setAttribute('allowfullscreen', '');
        iframe.allowFullscreen = true;
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals allow-forms');
        iframe.setAttribute('title', 'AI OTOGE-10 HTML5 Game');
        gameContainer.appendChild(iframe);
        setupIframeSync(iframe);
      } else {
        iframe.setAttribute('allow', 'fullscreen; autoplay; gamepad; midi; keyboard-map');
        iframe.setAttribute('allowfullscreen', '');
        iframe.allowFullscreen = true;
        setupIframeSync(iframe);
      }

      // 閉じるボタンを常にコンテナ内の最上位要素（DOMの末尾）に再配置
      if (closeBtn) {
        this.applyOverlayCloseButtonStyles(closeBtn);
        gameContainer.appendChild(closeBtn);
      }

      // コンテナ全体をフルスクリーン化（iframe＋右上の戻るボタンを目隠し重層表示）
      const target = gameContainer;
      const reqFs = target.requestFullscreen ||
                    target.webkitRequestFullscreen ||
                    target.mozRequestFullScreen ||
                    target.msRequestFullscreen;

      if (reqFs) {
        reqFs.call(target).then(() => {
          try {
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.focus();
            }
          } catch (err) {}
          if (iframe) this.syncIframeOverlayButton(iframe);
        }).catch(() => {
          // フォールバック: iframe単体でフルスクリーン
          const iFs = iframe.requestFullscreen ||
                      iframe.webkitRequestFullscreen ||
                      iframe.mozRequestFullScreen ||
                      iframe.msRequestFullscreen;
          if (iFs) {
            iFs.call(iframe).then(() => {
              if (iframe) this.syncIframeOverlayButton(iframe);
            }).catch(() => {});
          }
        });
      }
    });

    // フルスクリーン解除（目隠し戻るボタン クリック時）
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.soundEngine && typeof this.soundEngine.playClickSound === 'function') {
          this.soundEngine.playClickSound('se/click.mp3');
        }

        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      });
    }

    // フルスクリーン状態変化の監視・戻るボタンの表示/非表示同期
    const updateFsState = () => {
      const isFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      const targetCloseBtn = document.getElementById('btnGameFullscreenClose');

      if (isFs) {
        gameContainer.classList.add('in-fullscreen');
        document.body.classList.add('in-game-fullscreen');
        if (targetCloseBtn) {
          targetCloseBtn.style.setProperty('display', 'inline-flex', 'important');
          this.applyOverlayCloseButtonStyles(targetCloseBtn);
          gameContainer.appendChild(targetCloseBtn);
        }
      } else {
        gameContainer.classList.remove('in-fullscreen');
        document.body.classList.remove('in-game-fullscreen');
        if (targetCloseBtn) {
          targetCloseBtn.style.setProperty('display', 'none', 'important');
        }
      }

      const curIframe = gameContainer.querySelector('iframe');
      if (curIframe) {
        this.syncIframeOverlayButton(curIframe);
      }
    };

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
      document.addEventListener(evtName, updateFsState);
    });
  }

  /**
   * Lucide アイコンのリフレッシュ
   */
  refreshIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  /**
   * HTMLエスケープユーティリティ
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// DOM読み込み完了時にアプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new PianoCinemaApp();
  app.init();
  window.pianoApp = app;
});
