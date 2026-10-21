const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// =========================================================================
// 自動復帰シールド (CRASH SHIELD & SELF-RECOVERY)
// ファイルロックや予期せぬ例外が発生してもサーバーを絶対に落とさない防壁
// =========================================================================
process.on('uncaughtException', (err) => {
  console.error('[Shield Active] Uncaught Exception intercepted (Server Survives):', err.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Shield Active] Unhandled Rejection intercepted (Server Survives):', reason);
});

const PORT = process.env.PORT || 8888; // 配信ポート番号: 8888
const ROOT_DIR = path.resolve(__dirname);

// =========================================================================
// 🛡️ ISOLATED EXTERNAL VAULT (AI完全遮断・独立階層「データ保護金庫」直結ルート)
// 「最高ウェブサイト」フォルダ外（C:\ウェブサイト外装\データ保護金庫\）に完全隔離し、
// AIパッチや自動同期による旧データ巻き戻しを構造の根本から100%永久遮断
// =========================================================================
const ISOLATED_VAULT_DIR = path.resolve(ROOT_DIR, '..', 'データ保護金庫');
const SYNC_DATA_FILE = path.join(ISOLATED_VAULT_DIR, 'sync-data.json');
const SYNC_DATA_BACKUP_FILE = path.join(ISOLATED_VAULT_DIR, 'sync-data.backup.json');
const SYNC_DATA_VAULT_FILE = path.join(ISOLATED_VAULT_DIR, 'sync-data.vault.json');

// 旧フォルダ内の参照パス（初回起動時に万一独立金庫が未作成だった場合の初期吸い上げ用のみ）
const LEGACY_SYNC_FILE = path.join(ROOT_DIR, 'sync-data.json');
const LEGACY_VAULT_FILE = path.join(ROOT_DIR, 'data-vault', 'sync-data.vault.json');
const LEGACY_BACKUP_FILE = path.join(ROOT_DIR, 'sync-data.backup.json');

// =========================================================================
// 🛡️ DATA INTEGRITY VAULT SHIELD (データ不可侵・絶対保護シールド)
// クライアント様が管理パネルから入力・蓄積したデータを上書き・初期化・リセットから永久保護
// =========================================================================
let syncLastModified = 0;
try {
  if (!fs.existsSync(ISOLATED_VAULT_DIR)) {
    fs.mkdirSync(ISOLATED_VAULT_DIR, { recursive: true });
  }

  let hasValidMain = false;
  if (fs.existsSync(SYNC_DATA_FILE)) {
    const stat = fs.statSync(SYNC_DATA_FILE);
    if (stat.size > 20) {
      try {
        JSON.parse(fs.readFileSync(SYNC_DATA_FILE, 'utf8'));
        hasValidMain = true;
        syncLastModified = stat.mtimeMs;
        // 独立金庫内の正常データを二重バックアップ（backup & vault）および公開用sync-data.jsonに同期保護
        fs.copyFileSync(SYNC_DATA_FILE, SYNC_DATA_BACKUP_FILE);
        fs.copyFileSync(SYNC_DATA_FILE, SYNC_DATA_VAULT_FILE);
        try { fs.copyFileSync(SYNC_DATA_FILE, LEGACY_SYNC_FILE); } catch (e) {}
        try { fs.copyFileSync(SYNC_DATA_FILE, LEGACY_BACKUP_FILE); } catch (e) {}
        try { fs.copyFileSync(SYNC_DATA_FILE, LEGACY_VAULT_FILE); } catch (e) {}
        console.log('[Isolated Data Vault] Client data verified in C:\\ウェブサイト外装\\データ保護金庫\\sync-data.json');
      } catch (e) {}
    }
  }

  // 万一のメイン金庫ファイル欠損・破損時は独立金庫内バックアップ（または初回のみ旧ファイル）から即時完全復元
  if (!hasValidMain) {
    const candidates = [
      SYNC_DATA_VAULT_FILE,
      SYNC_DATA_BACKUP_FILE,
      LEGACY_SYNC_FILE,
      LEGACY_VAULT_FILE,
      LEGACY_BACKUP_FILE
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const stat = fs.statSync(candidate);
          if (stat.size > 20) {
            JSON.parse(fs.readFileSync(candidate, 'utf8'));
            fs.copyFileSync(candidate, SYNC_DATA_FILE);
            fs.copyFileSync(candidate, SYNC_DATA_BACKUP_FILE);
            fs.copyFileSync(candidate, SYNC_DATA_VAULT_FILE);
            syncLastModified = Date.now();
            console.log('[Isolated Data Vault] Main data safely initialized/restored into isolated vault.');
            break;
          }
        } catch (e) {}
      }
    }
  }

  if (syncLastModified === 0) {
    syncLastModified = Date.now();
  }
} catch (e) {
  syncLastModified = Date.now();
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.mem': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.weba': 'audio/webm',
  '.caf': 'audio/x-caf',
  '.flac': 'audio/flac',
  '.opus': 'audio/opus',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogv': 'video/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.map': 'application/json; charset=utf-8'
};

const DEFAULT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Cross-Origin-Embedder-Policy': 'unsafe-none'
};

// =========================================================================
// 🛠️ MAINTENANCE MODE SYSTEM (Windows PC 管理パネル限定・メンテナンス切替機能)
// 初期状態: false (OFF / 通常公開モード)
// =========================================================================
let isMaintenanceMode = false;

function isLocalhostRequest(req) {
  const remoteAddr = String((req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '');
  const hostHeader = String(req.headers.host || '').split(':')[0].toLowerCase();
  const isLoopbackIp = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
  const isLocalHostHeader = hostHeader === 'localhost' || hostHeader === '127.0.0.1' || hostHeader === '[::1]';
  return isLoopbackIp && isLocalHostHeader;
}

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>メンテナンス中 | MUSIC TECH LAB</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Shippori+Mincho:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #060608;
      --bg-surface: #0e0e14;
      --gold-primary: #d4af37;
      --gold-light: #f5e3a9;
      --gold-glow: rgba(212, 175, 55, 0.25);
      --text-ivory: #f8f6f0;
      --text-subtle: #b8b8c8;
      --border-gold: rgba(212, 175, 55, 0.4);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-deep);
      color: var(--text-ivory);
      font-family: 'Shippori Mincho', 'Plus Jakarta Sans', serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image:
        radial-gradient(circle at 50% 25%, rgba(212, 175, 55, 0.08) 0%, transparent 55%),
        radial-gradient(circle at 50% 85%, rgba(30, 41, 59, 0.25) 0%, transparent 60%);
      overflow-x: hidden;
    }
    .maintenance-card {
      max-width: 680px;
      width: 100%;
      background: rgba(14, 14, 20, 0.92);
      border: 1px solid var(--border-gold);
      border-radius: 20px;
      padding: 56px 40px;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 40px var(--gold-glow);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      position: relative;
    }
    .maintenance-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 15%;
      right: 15%;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--gold-light), var(--gold-primary), var(--gold-light), transparent);
    }
    .piano-emblem {
      width: 68px;
      height: 68px;
      margin: 0 auto 24px;
      border-radius: 50%;
      background: rgba(212, 175, 55, 0.1);
      border: 1px solid var(--border-gold);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 24px rgba(212, 175, 55, 0.2);
    }
    .brand-label {
      font-family: 'Cinzel', serif;
      font-size: 0.85rem;
      letter-spacing: 0.25em;
      color: var(--gold-primary);
      margin-bottom: 12px;
      display: block;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 18px;
      border-radius: 999px;
      background: rgba(212, 175, 55, 0.12);
      border: 1px solid rgba(212, 175, 55, 0.35);
      color: var(--gold-light);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      margin-bottom: 28px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--gold-primary);
      box-shadow: 0 0 10px var(--gold-primary);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }
    .maintenance-message {
      font-size: clamp(1.1rem, 2.8vw, 1.38rem);
      line-height: 2.1;
      color: var(--text-ivory);
      font-weight: 500;
      letter-spacing: 0.04em;
      margin-bottom: 32px;
      padding: 0 8px;
    }
    .divider {
      width: 80px;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold-primary), transparent);
      margin: 0 auto 20px;
    }
    .sub-footer {
      font-family: 'Cinzel', serif;
      font-size: 0.75rem;
      color: var(--text-subtle);
      letter-spacing: 0.18em;
      opacity: 0.8;
    }
    @media (max-width: 600px) {
      .maintenance-card {
        padding: 40px 24px;
      }
      .maintenance-message {
        line-height: 1.95;
      }
    }
  </style>
</head>
<body>
  <div class="maintenance-card">
    <div class="piano-emblem">
      <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
        <rect x="6" y="4" width="4" height="24" rx="1" fill="#f8f6f0"/>
        <rect x="14" y="4" width="4" height="24" rx="1" fill="#f8f6f0"/>
        <rect x="22" y="4" width="4" height="24" rx="1" fill="#f8f6f0"/>
        <rect x="10" y="4" width="4" height="16" rx="1" fill="#d4af37"/>
        <rect x="18" y="4" width="4" height="16" rx="1" fill="#d4af37"/>
      </svg>
    </div>
    <span class="brand-label">MUSIC TECH LAB</span>
    <div class="status-badge">
      <span class="status-dot"></span>
      <span>MAINTENANCE IN PROGRESS</span>
    </div>
    <p class="maintenance-message">
      ただいま更新中（メンテナンス中）のため、1時間ほどウェブサイトに繋げません。作業完了まで今しばらくのんびりとお待ちください
    </p>
    <div class="divider"></div>
    <p class="sub-footer">ANIME &amp; GAME MUSIC PIANO ARCHIVE</p>
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, Object.assign({}, DEFAULT_HEADERS, {
      'Access-Control-Max-Age': '86400'
    }));
    res.end();
    return;
  }

  let cleanUrl = req.url.split('?')[0].split('#')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(cleanUrl);
  } catch (e) {
    decodedPath = cleanUrl;
  }

  // =========================================================================
  // 🛠️ MAINTENANCE MODE API & GATEKEEPER (Windowsローカル管理パネル限定)
  // =========================================================================
  if (decodedPath === '/api/maintenance' || decodedPath === '/api/maintenance/') {
    if (req.method === 'GET') {
      res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
        'Content-Type': 'application/json; charset=utf-8'
      }));
      res.end(JSON.stringify({ success: true, maintenance: isMaintenanceMode }));
      return;
    }

    if (req.method === 'POST') {
      // Windows PC（localhost / 127.0.0.1）からのみ切替を許可
      if (!isLocalhostRequest(req)) {
        res.writeHead(403, Object.assign({}, DEFAULT_HEADERS, {
          'Content-Type': 'application/json; charset=utf-8'
        }));
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Localhost Admin Only' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 64) {
          req.connection.destroy();
        }
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (typeof payload.maintenance === 'boolean') {
            isMaintenanceMode = payload.maintenance;
          } else {
            isMaintenanceMode = !isMaintenanceMode;
          }
          console.log(`[Maintenance System] Mode switched to: ${isMaintenanceMode ? 'ON (LOCKED)' : 'OFF (PUBLIC)'}`);
          res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
            'Content-Type': 'application/json; charset=utf-8'
          }));
          res.end(JSON.stringify({ success: true, maintenance: isMaintenanceMode }));
        } catch (err) {
          res.writeHead(400, Object.assign({}, DEFAULT_HEADERS, {
            'Content-Type': 'application/json; charset=utf-8'
          }));
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // メンテナンスモードが「ON」の時の強制遮断ゲート
  // ただし、ローカルのWindows PC (localhost / 127.0.0.1) からリクエストされる
  // 「管理パネル（ADMIN）」およびその同期・操作用ルートだけは100%完全に生かしたまま維持する
  if (isMaintenanceMode) {
    const isLocalWin = isLocalhostRequest(req);
    const isAdminRoute =
      decodedPath === '/admin' ||
      decodedPath === '/admin/' ||
      decodedPath === '/admin.html' ||
      decodedPath === '/js/demo-data.js' ||
      decodedPath === '/favicon.ico' ||
      decodedPath.startsWith('/api/sync') ||
      decodedPath.startsWith('/api/maintenance');

    if (!(isLocalWin && isAdminRoute)) {
      const htmlBuf = Buffer.from(MAINTENANCE_HTML, 'utf8');
      res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': htmlBuf.length
      }));
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(htmlBuf);
      }
      return;
    }
  }

  // =========================================================================
  // REAL-TIME SYNC API (PORT 8888)
  // =========================================================================
  if (decodedPath === '/api/sync' || decodedPath === '/api/sync/') {
    if (req.method === 'GET') {
      try {
        let syncData = {};
        if (fs.existsSync(SYNC_DATA_FILE)) {
          const raw = fs.readFileSync(SYNC_DATA_FILE, 'utf8');
          syncData = JSON.parse(raw);
          try {
            syncLastModified = fs.statSync(SYNC_DATA_FILE).mtimeMs;
          } catch (e) {}
        }
        res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
          'Content-Type': 'application/json; charset=utf-8'
        }));
        res.end(JSON.stringify({ success: true, lastModified: syncLastModified, data: syncData }));
      } catch (err) {
        res.writeHead(500, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'application/json; charset=utf-8' }));
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) {
          req.connection.destroy();
        }
      });
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body || '{}');
          if (!incoming || typeof incoming !== 'object' || Object.keys(incoming).length === 0) {
            // 空データや不正リクエストによる既存データ破壊を完全遮断
            res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
              'Content-Type': 'application/json; charset=utf-8'
            }));
            res.end(JSON.stringify({ success: true, message: 'No change (Vault Protected)', lastModified: syncLastModified }));
            return;
          }

          // 書き込み先（独立データ保護金庫）ディレクトリの存在保証
          if (!fs.existsSync(ISOLATED_VAULT_DIR)) {
            fs.mkdirSync(ISOLATED_VAULT_DIR, { recursive: true });
          }

          let currentData = {};
          if (fs.existsSync(SYNC_DATA_FILE)) {
            try {
              currentData = JSON.parse(fs.readFileSync(SYNC_DATA_FILE, 'utf8'));
            } catch (e) {}
          }

          // 書き込み直前：既存の安全データを独立金庫内のバックアップに退避
          if (Object.keys(currentData).length > 0) {
            try {
              fs.writeFileSync(SYNC_DATA_BACKUP_FILE, JSON.stringify(currentData, null, 2), 'utf8');
            } catch (e) {}
          }

          // Windows PC (localhost) 以外の外部・スマホ端末からは管理パネル設定キーの書き換えを完全遮断
          if (!isLocalhostRequest(req)) {
            for (const key of Object.keys(incoming)) {
              if (key.startsWith('piano_cinema_custom_') || key.startsWith('piano_cinema_request_reset_ts_')) {
                delete incoming[key];
              }
            }
            if (Object.keys(incoming).length === 0) {
              res.writeHead(403, Object.assign({}, DEFAULT_HEADERS, {
                'Content-Type': 'application/json; charset=utf-8'
              }));
              res.end(JSON.stringify({ success: false, error: 'Forbidden: Windows PC Localhost Admin Only' }));
              return;
            }
          }

          // クライアント様が入力・保存した最新データのみを安全にマージ（空欄も100%尊重）
          const mergedData = Object.assign({}, currentData, incoming);

          const serialized = JSON.stringify(mergedData, null, 2);
          // 独立階層「C:\ウェブサイト外装\データ保護金庫\」へ最優先でリアルタイム自動上書き保存
          fs.writeFileSync(SYNC_DATA_FILE, serialized, 'utf8');
          fs.writeFileSync(SYNC_DATA_BACKUP_FILE, serialized, 'utf8');
          try {
            fs.writeFileSync(SYNC_DATA_VAULT_FILE, serialized, 'utf8');
          } catch (e) {}
          // GitHub Pages公開用の直下 sync-data.json へも最新状態を自動ミラーリング
          try { fs.writeFileSync(LEGACY_SYNC_FILE, serialized, 'utf8'); } catch (e) {}
          try { fs.writeFileSync(LEGACY_BACKUP_FILE, serialized, 'utf8'); } catch (e) {}
          try { fs.writeFileSync(LEGACY_VAULT_FILE, serialized, 'utf8'); } catch (e) {}

          // Windows PC管理パネルからの更新時、公開URL（GitHub Pages）へも裏側で自動プッシュ反映
          if (isLocalhostRequest(req)) {
            exec(
              'git add sync-data.json sync-data.backup.json data-vault/sync-data.vault.json && git commit -m "Sync latest admin panel data" && git push origin main',
              { cwd: ROOT_DIR, windowsHide: true },
              () => {}
            );
          }

          try {
            syncLastModified = fs.statSync(SYNC_DATA_FILE).mtimeMs;
          } catch (e) {
            syncLastModified = Date.now();
          }
          res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
            'Content-Type': 'application/json; charset=utf-8'
          }));
          res.end(JSON.stringify({ success: true, lastModified: syncLastModified }));
        } catch (err) {
          res.writeHead(400, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'application/json; charset=utf-8' }));
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }
  }

  // 軽量タイムスタンプ取得API（1秒ごとのリアルタイム検知用）
  if (decodedPath === '/api/sync/timestamp' || decodedPath === '/api/sync/timestamp/') {
    try {
      if (fs.existsSync(SYNC_DATA_FILE)) {
        syncLastModified = fs.statSync(SYNC_DATA_FILE).mtimeMs;
      }
    } catch (e) {}
    res.writeHead(200, Object.assign({}, DEFAULT_HEADERS, {
      'Content-Type': 'application/json; charset=utf-8'
    }));
    res.end(JSON.stringify({ success: true, lastModified: syncLastModified }));
    return;
  }

  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  } else if (decodedPath === '/admin' || decodedPath === '/admin/' || decodedPath === '/admin.html') {
    if (!isLocalhostRequest(req)) {
      res.writeHead(403, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('403 Forbidden: Admin Panel is restricted to local Windows PC only.');
      return;
    }
    decodedPath = '/admin.html';
  } else if (decodedPath === '/games' || decodedPath === '/games/') {
    decodedPath = '/games/index.html';
  } else if (/^\/games\/AI(?:%20| )OTOGE-10\b/i.test(decodedPath)) {
    // 旧音ゲーのパスへのアクセスを新ブロック崩しゲームへ自動ルート接続
    const sub = decodedPath.replace(/^\/games\/AI(?:%20| )OTOGE-10\/?/i, '');
    decodedPath = '/games/' + (sub || 'index.html');
  }

  let filePath = path.normalize(path.join(ROOT_DIR, decodedPath));
  const normalizedRoot = ROOT_DIR.toLowerCase();
  const normalizedFile = filePath.toLowerCase();

  if (!normalizedFile.startsWith(normalizedRoot)) {
    res.writeHead(403, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
    res.end('403 Forbidden');
    return;
  }

  if (fs.existsSync(filePath)) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const indexFile = path.join(filePath, 'index.html');
        if (fs.existsSync(indexFile)) {
          if (!cleanUrl.endsWith('/')) {
            res.writeHead(301, Object.assign({}, DEFAULT_HEADERS, {
              'Location': encodeURI(decodedPath) + '/'
            }));
            res.end();
            return;
          }
          filePath = indexFile;
        }
      }
    } catch (e) {}
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
        res.end('404 Not Found');
      } else {
        res.writeHead(500, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }

    if (stats.isDirectory()) {
      res.writeHead(403, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end('403 Directory Listing Denied');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // gamesフォルダ内のファイルは常に最新状態を強制取得（静的キャッシュ完全破棄）
    const isGameAsset = decodedPath.startsWith('/games/');
    const responseHeaders = Object.assign({}, DEFAULT_HEADERS, {
      'Content-Type': contentType,
      'Last-Modified': stats.mtime.toUTCString()
    });
    if (isGameAsset) {
      responseHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0';
      responseHeaders['Pragma'] = 'no-cache';
      responseHeaders['Expires'] = '0';
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, Object.assign({}, responseHeaders, {
        'Content-Length': totalSize
      }));
      res.end();
      return;
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const rangeSpec = rangeHeader.substring(6).trim();
      const parts = rangeSpec.split('-');
      let start, end;

      if (parts[0] === '' && parts[1] !== '') {
        const suffix = parseInt(parts[1], 10);
        if (isNaN(suffix) || suffix <= 0) {
          start = 0;
          end = totalSize - 1;
        } else {
          start = Math.max(0, totalSize - suffix);
          end = totalSize - 1;
        }
      } else if (parts[0] !== '' && parts[1] === '') {
        start = parseInt(parts[0], 10);
        end = totalSize - 1;
      } else if (parts[0] !== '' && parts[1] !== '') {
        start = parseInt(parts[0], 10);
        end = parseInt(parts[1], 10);
      } else {
        start = 0;
        end = totalSize - 1;
      }

      if (isNaN(start) || isNaN(end) || start < 0 || start >= totalSize || end >= totalSize || start > end) {
        res.writeHead(416, Object.assign({}, DEFAULT_HEADERS, {
          'Content-Range': `bytes */${totalSize}`
        }));
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, Object.assign({}, responseHeaders, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize
      }));

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => { res.end(); });
      stream.pipe(res);
    } else {
      res.writeHead(200, Object.assign({}, responseHeaders, {
        'Content-Length': totalSize
      }));

      const stream = fs.createReadStream(filePath);
      stream.on('error', (streamErr) => {
        console.error('[Shield Active] Read stream error intercepted:', streamErr.message || streamErr);
        try {
          if (!res.headersSent) {
            res.writeHead(500, Object.assign({}, DEFAULT_HEADERS, { 'Content-Type': 'text/plain; charset=utf-8' }));
          }
          res.end('Server Stream Error');
        } catch(e) {}
      });
      stream.pipe(res);
    }
  });
});

// =========================================================================
// サーバー通信エラー・ソケットエラーの自動防壁
// =========================================================================
server.on('error', (err) => {
  console.error('[Shield Active] Server error intercepted:', err.message || err);
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Shield Recovery] Port ${PORT} occupied. Retrying in 1s...`);
    setTimeout(() => {
      try {
        server.close();
      } catch (e) {}
      server.listen(PORT, '0.0.0.0');
    }, 1000);
  }
});

server.on('clientError', (err, socket) => {
  if (err.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Piano Cinema Server running at:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`  Network: http://${iface.address}:${PORT}`);
        }
      }
    }
  } catch (e) {}
});
