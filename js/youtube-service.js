/**
 * ==========================================================================
 *  PIANO CINEMA - YOUTUBE DATA API V3 SERVICE
 * ==========================================================================
 *  YouTube Data API v3 通信、通常動画とShortsの自動判定・分類、
 *  ページネーション（Load More）、キャッシュ、モックフォールバックを統括します。
 */

class YouTubeService {
  constructor(config = window.CONFIG) {
    this.config = config;
    this.isLiveMode = false;
    this.channelInfo = null;

    // 通常動画とショート動画の内部プール
    this.regularVideosPool = [];
    this.shortsVideosPool = [];

    // 現在表示済みのインデックス
    this.regularIndex = 0;
    this.shortsIndex = 0;

    // YouTube API ページネーショントークン
    this.apiNextPageToken = null;
    this.hasMoreApiVideos = true;
    this.isLoadingApi = false;
  }

  /**
   * 初期化：APIキーとチャンネルIDの有効性を検証し、初期データを準備
   */
  async initialize() {
    const hasCredentials = this.config.YOUTUBE_API_KEY && 
                           this.config.CHANNEL_ID && 
                           this.config.YOUTUBE_API_KEY.trim() !== '' && 
                           this.config.CHANNEL_ID.trim() !== '';

    if (!hasCredentials) {
      console.info('%c[Piano Cinema]%c No YouTube API credentials provided. Initializing in Demo / Fallback Mode.', 
        'color: #d4af37; font-weight: bold;', 'color: #8e8e99;');
      this.initDemoData();
      this.isLiveMode = false;
      return { mode: 'demo', message: 'Demo Mode Activated' };
    }

    try {
      console.info('%c[Piano Cinema]%c Connecting to YouTube Data API v3...', 
        'color: #d4af37; font-weight: bold;', 'color: #8e8e99;');
      
      // チャンネル基本情報を取得
      await this.fetchChannelDetails();
      
      // 最初の動画バッチを取得・分類
      await this.fetchAndClassifyVideosFromApi(30);

      this.isLiveMode = true;
      return { 
        mode: 'live', 
        channel: this.channelInfo, 
        message: 'Connected to YouTube Live API' 
      };
    } catch (error) {
      console.error('[Piano Cinema] YouTube API Error, falling back to Demo Mode:', error);
      this.initDemoData();
      this.isLiveMode = false;
      return { 
        mode: 'demo', 
        error: error.message, 
        message: 'API error encountered. Switched to high-fidelity demo dataset.' 
      };
    }
  }

  /**
   * デモデータおよび管理画面（LocalStorage）からの手動更新データを読み込み
   */
  initDemoData() {
    const demo = window.DEMO_DATA || { regularVideos: [], shortsVideos: [] };
    
    // 管理画面から保存されたカスタム動画データの読み込み
    let customRegular = [];
    let customShorts = [];
    try {
      const savedReg = localStorage.getItem('piano_cinema_custom_channel_a');
      if (savedReg) {
        const parsed = JSON.parse(savedReg);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customRegular = parsed.map(v => {
            const cleanId = YouTubeService.extractYouTubeId(v.youtubeId || v.id);
            return {
              ...v,
              youtubeId: cleanId || v.youtubeId,
              thumbnail: v.thumbnail || `https://img.youtube.com/vi/${cleanId}/maxresdefault.jpg`
            };
          });
        }
      }
      const savedSht = localStorage.getItem('piano_cinema_custom_channel_b');
      if (savedSht) {
        const parsed = JSON.parse(savedSht);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customShorts = parsed.map(v => {
            const cleanId = YouTubeService.extractYouTubeId(v.youtubeId || v.id);
            return {
              ...v,
              youtubeId: cleanId || v.youtubeId,
              thumbnail: v.thumbnail || `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`
            };
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse custom videos from localStorage:', e);
    }

    // カスタム動画を最優先（先頭）に配置し、重複のないデモ動画をフォールバックとして結合
    if (customRegular.length > 0) {
      this.regularVideosPool = [
        ...customRegular,
        ...demo.regularVideos.filter(dv => !customRegular.some(cr => cr.youtubeId === dv.youtubeId))
      ];
    } else {
      this.regularVideosPool = [...demo.regularVideos];
    }

    if (customShorts.length > 0) {
      this.shortsVideosPool = [
        ...customShorts,
        ...demo.shortsVideos.filter(ds => !customShorts.some(cs => cs.youtubeId === ds.youtubeId))
      ];
    } else {
      this.shortsVideosPool = [...demo.shortsVideos];
    }

    this.regularIndex = 0;
    this.shortsIndex = 0;
    this.channelInfo = {
      title: this.config.CHANNEL_NAME || 'MUSIC TECH LAB',
      customUrl: '@MusicTechLab',
      subscriberCount: '185,000',
      videoCount: (this.regularVideosPool.length + this.shortsVideosPool.length).toString(),
      viewCount: '24,500,000',
      avatarUrl: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?q=80&w=400&auto=format&fit=crop',
      bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop'
    };
  }

  /**
   * チャンネルの詳細情報（タイトル、登録者数、アイコン等）を取得
   */
  async fetchChannelDetails() {
    const apiKey = this.config.YOUTUBE_API_KEY;
    const channelId = this.config.CHANNEL_ID;
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status} fetching channel info`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error(`Channel ID "${channelId}" not found on YouTube.`);
    }

    const item = data.items[0];
    this.channelInfo = {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      customUrl: item.snippet.customUrl || '',
      subscriberCount: this.formatNumber(item.statistics.subscriberCount),
      videoCount: item.statistics.videoCount,
      viewCount: this.formatNumber(item.statistics.viewCount),
      avatarUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      bannerUrl: item.brandingSettings?.image?.bannerExternalUrl || null
    };

    return this.channelInfo;
  }

  /**
   * YouTube APIから動画バッチを取得し、通常動画とShortsに分類してプールに追加
   */
  async fetchAndClassifyVideosFromApi(maxResults = 25) {
    if (this.isLoadingApi || (!this.hasMoreApiVideos && this.apiNextPageToken === null && this.regularVideosPool.length > 0)) {
      return;
    }

    this.isLoadingApi = true;
    const apiKey = this.config.YOUTUBE_API_KEY;
    const channelId = this.config.CHANNEL_ID;

    try {
      // アップロードプレイリストID（UC... -> UU...）
      const uploadsPlaylistId = channelId.replace(/^UC/, 'UU');

      let playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=${maxResults}&key=${encodeURIComponent(apiKey)}`;
      if (this.apiNextPageToken) {
        playlistUrl += `&pageToken=${encodeURIComponent(this.apiNextPageToken)}`;
      }

      const playlistRes = await fetch(playlistUrl);
      if (!playlistRes.ok) {
        const errJson = await playlistRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${playlistRes.status} on playlistItems`);
      }

      const playlistData = await playlistRes.json();
      this.apiNextPageToken = playlistData.nextPageToken || null;
      if (!this.apiNextPageToken) {
        this.hasMoreApiVideos = false;
      }

      const videoIds = playlistData.items
        .map(it => it.contentDetails?.videoId || it.snippet?.resourceId?.videoId)
        .filter(Boolean);

      if (videoIds.length === 0) {
        this.isLoadingApi = false;
        return;
      }

      // Videos API で動画長（duration）や詳細統計を一括取得
      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}&key=${encodeURIComponent(apiKey)}`;
      const videosRes = await fetch(videosUrl);
      if (!videosRes.ok) {
        throw new Error(`HTTP ${videosRes.status} on videos detail API`);
      }

      const videosData = await videosRes.json();

      // 各動画を通常動画かShortsかに振り分け
      videosData.items.forEach(item => {
        const durationIso = item.contentDetails.duration || 'PT0S';
        const durationSec = this.parseIsoDuration(durationIso);
        const formattedDuration = this.formatDuration(durationSec);

        const title = item.snippet.title || '';
        const description = item.snippet.description || '';
        const isShorts = durationSec <= 61 || 
                         title.toLowerCase().includes('#shorts') || 
                         description.toLowerCase().includes('#shorts');

        const thumbnail = item.snippet.thumbnails.maxres?.url || 
                          item.snippet.thumbnails.standard?.url || 
                          item.snippet.thumbnails.high?.url || 
                          item.snippet.thumbnails.medium?.url;

        const videoObj = {
          id: item.id,
          youtubeId: item.id,
          title: title,
          description: description,
          thumbnail: thumbnail,
          publishedAt: item.snippet.publishedAt,
          duration: formattedDuration,
          durationSec: durationSec,
          views: this.formatNumber(item.statistics.viewCount),
          likes: this.formatNumber(item.statistics.likeCount || 0),
          category: isShorts ? 'Shorts (サビ弾き)' : 'Main Cover (ワンコーラス)',
          isShorts: isShorts
        };

        if (isShorts) {
          // 重複チェック
          if (!this.shortsVideosPool.some(v => v.youtubeId === videoObj.youtubeId)) {
            this.shortsVideosPool.push(videoObj);
          }
        } else {
          if (!this.regularVideosPool.some(v => v.youtubeId === videoObj.youtubeId)) {
            this.regularVideosPool.push(videoObj);
          }
        }
      });
    } finally {
      this.isLoadingApi = false;
    }
  }

  /**
   * 通常動画の読み込み（初回 or Load More）
   */
  async getRegularVideos(count = this.config.REGULAR_VIDEOS.LOAD_MORE_COUNT) {
    if (this.isLiveMode && (this.regularIndex + count > this.regularVideosPool.length) && this.hasMoreApiVideos) {
      await this.fetchAndClassifyVideosFromApi(30);
    }

    const startIndex = this.regularIndex;
    const endIndex = Math.min(startIndex + count, this.regularVideosPool.length);
    const items = this.regularVideosPool.slice(startIndex, endIndex);
    this.regularIndex = endIndex;

    const hasMore = this.isLiveMode 
      ? (this.regularIndex < this.regularVideosPool.length || this.hasMoreApiVideos)
      : (this.regularIndex < this.regularVideosPool.length);

    return {
      items,
      hasMore,
      totalLoaded: this.regularIndex,
      poolSize: this.regularVideosPool.length
    };
  }

  /**
   * ショート動画の読み込み（初回 or Load More）
   */
  async getShortsVideos(count = this.config.SHORTS_VIDEOS.LOAD_MORE_COUNT) {
    if (this.isLiveMode && (this.shortsIndex + count > this.shortsVideosPool.length) && this.hasMoreApiVideos) {
      await this.fetchAndClassifyVideosFromApi(30);
    }

    const startIndex = this.shortsIndex;
    const endIndex = Math.min(startIndex + count, this.shortsVideosPool.length);
    const items = this.shortsVideosPool.slice(startIndex, endIndex);
    this.shortsIndex = endIndex;

    const hasMore = this.isLiveMode 
      ? (this.shortsIndex < this.shortsVideosPool.length || this.hasMoreApiVideos)
      : (this.shortsIndex < this.shortsVideosPool.length);

    return {
      items,
      hasMore,
      totalLoaded: this.shortsIndex,
      poolSize: this.shortsVideosPool.length
    };
  }

  /**
   * ISO 8601 形式の動画時間（PT1H2M3Sなど）を秒数にパース
   */
  parseIsoDuration(isoDuration) {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  /**
   * 秒数を mm:ss または h:mm:ss 形式にフォーマット
   */
  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    if (h > 0) {
      const mStr = m < 10 ? `0${m}` : `${m}`;
      return `${h}:${mStr}:${sStr}`;
    }
    return `${m}:${sStr}`;
  }

  /**
   * 数字を読みやすい形式（1.2M, 840K, カンマ区切り）にフォーマット
   */
  formatNumber(num) {
    if (!num) return '0';
    const n = typeof num === 'string' ? parseInt(num, 10) : num;
    if (isNaN(n)) return num;
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (n >= 10000) {
      return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return n.toLocaleString();
  }

  /**
   * 公開日のフォーマット（例: "MAY 18, 2025" or "2 days ago"）
   */
  static formatDate(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const date = new Date(isoDateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).toUpperCase();
    } catch {
      return isoDateStr;
    }
  }

  /**
   * あらゆる形式のYouTube URL（youtu.be, shorts, watch, studio, live, embed等）から
   * 確実にクリーンな11文字の動画IDを抽出
   */
  static extractYouTubeId(urlOrId) {
    if (!urlOrId) return '';
    let input = String(urlOrId).trim();

    // HTML埋め込みコード（<iframe src="..."> 等）からsrc属性を抽出
    const srcMatch = input.match(/src=["']([^"']+)["']/i);
    if (srcMatch) input = srcMatch[1].trim();

    // 前後の引用符を削除
    input = input.replace(/^["']|["']$/g, '');

    // 既に純粋な11文字のYouTube動画IDの場合
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    // 1. クエリパラメータ v= の抽出（watch?v=, watch?feature=share&v= 等）
    const vParamMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&#?].*)?$/);
    if (vParamMatch && vParamMatch[1]) return vParamMatch[1];

    // 2. パスベースの抽出（youtu.be/, shorts/, embed/, v/, live/, video/, studio, etc.）
    const pathPatterns = [
      /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|v\/|live\/|video\/))([a-zA-Z0-9_-]{11})/i,
      /(?:studio\.youtube\.com\/video\/)([a-zA-Z0-9_-]{11})/i,
      /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/i
    ];

    for (const pattern of pathPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) return match[1];
    }

    // 3. フォールバック：スラッシュや等号の直後にある11文字トークン
    const genericMatch = input.match(/(?:[/?=])([a-zA-Z0-9_-]{11})(?:[/?#&]|$)/);
    if (genericMatch && genericMatch[1] && genericMatch[1] !== 'watch' && genericMatch[1] !== 'video') {
      return genericMatch[1];
    }

    return '';
  }
}

// グローバルスコープに公開
window.YouTubeService = YouTubeService;
