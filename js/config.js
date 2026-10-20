/**
 * ==========================================================================
 *  ANIME MUSIC RESONANCE - CONFIGURATION FILE
 * ==========================================================================
 *  YouTube Data API v3 のキーや対象のチャンネルID、表示件数などを設定します。
 *  ※ APIキーが未設定の場合でも、自動的に高品質なアニソンピアノ演奏デモデータで動作します。
 */

const CONFIG = {
  // ------------------------------------------------------------------------
  // 1. YouTube Data API v3 設定
  // ------------------------------------------------------------------------
  // Google Cloud Console で取得した YouTube Data API v3 の APIキー
  YOUTUBE_API_KEY: '',

  // 対象の YouTube チャンネルID（例: 'UCxxxxxxxxxxxxxxxxxxxxxx'）
  // ※ ハンドル（@xxx）ではなく 'UC' から始まる24文字のIDを指定してください。
  CHANNEL_ID: '',

  // チャンネル名・ピアニスト名（画面上の表示用）
  CHANNEL_NAME: 'MUSIC TECH LAB',
  ARTIST_TAGLINE: '最新アニソン&ゲーム音楽・ピアノCH',

  // ------------------------------------------------------------------------
  // 2. 表示・読み込み件数（Load More）設定
  // ------------------------------------------------------------------------
  // 通常動画（16:9 ワンコーラス メイン動画）
  REGULAR_VIDEOS: {
    INITIAL_COUNT: 3,     // 初回表示件数（横3個×1段）
    LOAD_MORE_COUNT: 3,   // 「もっと見る」で追加される件数（横3個×1段ずつ展開）
  },

  // ショート動画（9:16 サビだけ弾いてみた）
  SHORTS_VIDEOS: {
    INITIAL_COUNT: 6,     // 初回表示件数（横6個×1段）
    LOAD_MORE_COUNT: 6,   // 「もっと見る」で追加される件数（横6個×1段ずつ展開）
  },

  // ------------------------------------------------------------------------
  // 3. システム & フォールバック設定
  // ------------------------------------------------------------------------
  // APIキー未設定時やAPIエラー時に高品質デモデータを使用するか
  USE_DEMO_FALLBACK: true,

  // APIレスポンスをブラウザのキャッシュに保存する時間（分単位）
  CACHE_EXPIRATION_MINUTES: 30,

  // ------------------------------------------------------------------------
  // 4. 公式リンク & 楽譜販売 (Piascore / SNS / メディア)
  // ------------------------------------------------------------------------
  // Piascore出品者ページ・楽曲販売ページのURL
  PIASCORE_STORE_URL: 'https://store.piascore.com/publishers/10366',

  SOCIAL_LINKS: {
    YOUTUBE_A: 'https://youtube.com/@playing_the_piano?si=e8MvdlnGeqiP_H95',
    YOUTUBE_B: 'https://youtube.com/@playing_the_piano_scores?si=7TkMVg_xZuBT7HNc',
    NOTE: 'https://note.com/apt_eel6649',
    X_TWITTER: 'https://x.com/Playing_the_',
    PIASCORE: 'https://store.piascore.com/publishers/10366'
  }
};

// LocalStorageに保存されたユーザー設定があればマージ（ブラウザ設定画面からの変更を反映）
(function loadSavedConfig() {
  try {
    const savedApiKey = localStorage.getItem('piano_site_api_key');
    const savedChannelId = localStorage.getItem('piano_site_channel_id');
    if (savedApiKey) CONFIG.YOUTUBE_API_KEY = savedApiKey;
    if (savedChannelId) CONFIG.CHANNEL_ID = savedChannelId;
  } catch (e) {
    console.warn('LocalStorage is not accessible:', e);
  }
})();

// グローバルスコープに公開
window.CONFIG = CONFIG;
