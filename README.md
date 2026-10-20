# NOCTURNE — Cinematic Piano Repertoire & Shorts

YouTubeのピアノ「弾いてみた」チャンネルの最新動画を自動表示する、Awwwards受賞作品レベルの最高峰シネマティックWebサイトです。

---

## ✨ 主な特徴とデザイン美学

- **漆黒とゴールドの美学（Deep Noir & Champagne Gold）**:
  - グランドピアノのピアノブラック塗装、象牙（アイボリー）の白、控えめで気品あるシャンパンゴールドを融合。
  - レタースペース（文字間隔）を広くとり、映画のタイトルのような品格あるタイポグラフィ（`Cinzel` / `Cormorant Garamond` / `Shippori Mincho`）。
  - 圧倒的な「引き算の美学（贅沢な余白）」によるミニマルかつ洗練された空間構成。

- **シネマティック・インタラクション（GSAP & ScrollTrigger）**:
  - **オープニング幕開け演出**: ページを開いた瞬間、上下のカーテンパネルが滑らかに開き、シネマティックにタイトルがフェードイン。
  - **カスタムラグジュアリーカーソル**: マウスの動きに滑らかに追従し、動画カードにホバーすると「PLAY」サークルにモーフィング。
  - **マグネティックUI**: ボタンやロゴにマウスを近づけると微かに吸い付く高級エフェクト。
  - **パララックス & スクロールリビール**: スクロールに合わせてカードやテキストが時間差（スタッガー）で浮き上がる。
  - **サムネイルホバーズーム**: サムネイルが滑らかにズームし、ゴールドリムが発光。

- **YouTube Data API v3 自動連携 & インテリジェント分類**:
  - チャンネルの動画を自動取得し、**通常動画（16:9）** と **Shorts動画（9:16）** に自動分類してそれぞれ最適な比率でレイアウト。
  - **Load More（もっと見る）機能**: 最初は通常動画6本、ショート動画12本を表示。ボタンを押すと滑らかなアニメーションと共に追加読み込み。
  - **シアターモーダル**: 動画をクリックすると、大画面のシネマティックモーダルプレイヤーで即座に再生。
  - **デモフォールバック完備**: APIキー未設定時でも、実在する名演奏の高品質デモデータでサイトの全機能を100%体験可能。
  - **ブラウザ上での簡単設定**: 画面右上の設定アイコンから、APIキーとチャンネルIDを直接入力・即時同期・LocalStorage保存が可能。

---

## 📁 ディレクトリ構成

```
piano-cinema-site/
├── index.html              # メインHTML（セマンティック構造、GSAP/Font CDN）
├── css/
│   └── style.css           # Awwwards級デザインシステム、グリッド、アニメーション
├── js/
│   ├── config.js           # APIキー・チャンネルID・表示件数の設定ファイル
│   ├── demo-data.js        # 高品質ピアノ演奏動画デモデータ（通常18本、Shorts 24本）
│   ├── youtube-service.js  # YouTube Data API v3 通信、Shorts分類、ページネーション
│   ├── animations.js       # GSAP幕開け、カスタムカーソル、パララックス
│   └── app.js              # メインコントローラー、DOMレンダリング、モーダル制御
├── server.js               # ローカル動作用の軽量Node.js静的サーバー
└── README.md               # 本ドキュメント
```

---

## 🚀 使い方・動かし方

### 1. ローカルサーバーで起動する場合
プロジェクトフォルダ内で以下のコマンドを実行すると、ローカルサーバーが立ち上がります。

```bash
node server.js
```
ブラウザで `http://localhost:3000` にアクセスしてください。

※ 通常の静的HTMLファイルのため、`index.html` をダブルクリックして直接ブラウザで開くことも可能です。

---

## 🔑 YouTube Data API v3 の設定方法

### 方法 A: ブラウザ画面から直接設定（最も簡単）
1. サイトを開き、右上の **「歯車アイコン（設定）」** をクリックします。
2. ご自身の **YouTube Data API Key** と **チャンネルID（UC...）** を入力します。
3. **「保存して再同期」** をクリックすると、即座にあなたのYouTubeチャンネルの最新動画が自動取得されます。

### 方法 B: 設定ファイル（`js/config.js`）で直接指定
[`js/config.js`](file:///C:/Users/PC/.gemini/antigravity/scratch/piano-cinema-site/js/config.js) を開き、上部の設定項目を書き換えてください。

```javascript
const CONFIG = {
  // Google Cloud Console で取得した YouTube Data API v3 の APIキー
  YOUTUBE_API_KEY: 'あなたのAPIキー',

  // 対象の YouTube チャンネルID（UCから始まる24文字）
  CHANNEL_ID: 'UCxxxxxxxxxxxxxxxxxxxxxx',

  // チャンネル名・ピアニスト名
  CHANNEL_NAME: 'NOCTURNE PIANO',
  
  REGULAR_VIDEOS: {
    INITIAL_COUNT: 3,     // 初回表示件数（横3個×1段）
    LOAD_MORE_COUNT: 3,   // 「もっと見る」で追加される件数（横3個×1段ずつ展開）
  },
  SHORTS_VIDEOS: {
    INITIAL_COUNT: 6,     // 初回表示件数（横6個×1段）
    LOAD_MORE_COUNT: 6,   // 「もっと見る」で追加される件数（横6個×1段ずつ展開）
  },
};
```

---

## 🌐 公開（デプロイ）について
本サイトは静的HTML/CSS/JavaScriptのみで構成されているため、以下のような無料ホスティングサービスにドラッグ＆ドロップまたはGitプッシュするだけで数秒で世界中に公開できます。

- **Vercel** / **Netlify** / **Cloudflare Pages** / **GitHub Pages**
