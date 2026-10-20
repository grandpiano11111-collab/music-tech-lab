/**
 * ==========================================================================
 *  PIANO CINEMA - 端末識別個別ロックシステム（相互不可侵シールド）パッチ
 *  File: js/vote-lock-patch.js
 * ==========================================================================
 *  【機能概要】
 *  1. 各端末（Windows PC, iPhone, iPad, Android等）に高エントロピーな
 *     ブラウザ固有識別ID（Fingerprint / UUID）を恒久発行・強固に維持。
 *  2. サーバー（ポート8888 / sync-data.json）内に端末専用の「個別記憶引き出し」
 *     （piano_device_lock_[端末ID]）を構築し、端末ごとに完全独立して投票ロックを管理。
 *  3. 他端末（スマホやiPad等）からのアクセスやサーバー定期同期（リアルタイム検知）が
 *     走っても、Windows側の制限ロック（チェック状態）を1ミリも上書きクリアさせない
 *     「相互不可侵シールド（Mutual Non-Aggression Shield）」を実現。
 *  4. 管理画面のリクエスト投票数0リセット命令時は、全端末の投票ロックを安全に初期化。
 *  5. 音響システム、ホバーSE、ボリューム同期、その他既存ロジックには一切干渉せず完全死守。
 * ==========================================================================
 */

(function() {
  'use strict';

  console.log('%c🛡️ [VOTE-LOCK-PATCH] 端末識別個別ロックシステム（相互不可侵シールド）起動中...', 'color: #10b981; font-weight: bold;');

  // =========================================================================
  // 1. 端末固有識別ID（Browser Fingerprint / UUID）の発行・維持
  // =========================================================================
  const DEVICE_STORAGE_KEY = 'piano_cinema_device_uuid_v2';
  const DEVICE_COOKIE_KEY = 'p_cinema_dev_id_v2';

  function resolveDeviceId() {
    let id = null;

    // 1.1 LocalStorage からの読み出し
    try {
      id = localStorage.getItem(DEVICE_STORAGE_KEY);
    } catch (e) {}

    // 1.2 Cookie バックアップからの読み出し
    if (!id) {
      try {
        const match = document.cookie.match(new RegExp('(^|;\\s*)' + DEVICE_COOKIE_KEY + '=([^;]+)'));
        if (match && match[2]) {
          id = decodeURIComponent(match[2]);
        }
      } catch (e) {}
    }

    // 1.3 未発行または破損している場合は高エントロピーな固有識別IDを自動生成
    if (!id || typeof id !== 'string' || id.length < 10) {
      const ua = navigator.userAgent || '';
      const isTablet = /iPad|Tablet/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobile = /Android|iPhone|iPod|Mobile/i.test(ua);
      const isWin = /Win/i.test(ua);
      const isMac = /Mac/i.test(ua);

      let devicePrefix = 'pc_win';
      if (isTablet) devicePrefix = 'tablet_ipad';
      else if (isMobile) devicePrefix = 'sp_mobile';
      else if (isMac) devicePrefix = 'pc_mac';
      else if (isWin) devicePrefix = 'pc_win';

      const randPart = () => Math.random().toString(36).substring(2, 9);
      const timePart = Date.now().toString(36);
      const screenPart = `${window.screen?.width || 0}x${window.screen?.height || 0}`;

      id = `dev_${devicePrefix}_${timePart}_${randPart()}_${randPart()}`;

      // LocalStorage & 長期有効Cookie（10年）へ強固に二重保存
      try {
        localStorage.setItem(DEVICE_STORAGE_KEY, id);
      } catch (e) {}
      try {
        document.cookie = `${DEVICE_COOKIE_KEY}=${encodeURIComponent(id)}; path=/; max-age=315360000; SameSite=Lax`;
      } catch (e) {}
    }

    return id;
  }

  const CURRENT_DEVICE_ID = resolveDeviceId();
  const SERVER_DRAWER_PREFIX = 'piano_device_lock_';
  const SERVER_DRAWER_KEY = SERVER_DRAWER_PREFIX + CURRENT_DEVICE_ID;
  const LOCAL_DRAWER_KEY = 'piano_device_drawer_' + CURRENT_DEVICE_ID;

  console.log(`%c🛡️ [VOTE-LOCK-PATCH] 端末識別ID確定: ${CURRENT_DEVICE_ID}`, 'color: #06b6d4;');

  // =========================================================================
  // 2. 端末専用記憶引き出し（Device Dedicated Storage Drawer）管理ロジック
  // =========================================================================
  const VoteLockShield = {
    deviceId: CURRENT_DEVICE_ID,
    serverKey: SERVER_DRAWER_KEY,
    localKey: LOCAL_DRAWER_KEY,

    /**
     * ローカルに保持している端末専用の引き出しデータを取得
     */
    getLocalDrawer() {
      const fallback = {
        deviceId: CURRENT_DEVICE_ID,
        req1: [],
        req2: [],
        req3: [],
        lastUpdated: Date.now()
      };

      try {
        const raw = localStorage.getItem(LOCAL_DRAWER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            return {
              deviceId: CURRENT_DEVICE_ID,
              req1: Array.isArray(parsed.req1) ? parsed.req1 : [],
              req2: Array.isArray(parsed.req2) ? parsed.req2 : [],
              req3: Array.isArray(parsed.req3) ? parsed.req3 : [],
              lastUpdated: parsed.lastUpdated || Date.now()
            };
          }
        }
      } catch (e) {
        console.warn('[VoteLockShield] Failed to read local drawer:', e);
      }

      // 初回起動時：既存の端末投票履歴が存在すれば移行保存
      try {
        const legacy1 = JSON.parse(localStorage.getItem('piano_cinema_request_vote_history') || '[]');
        if (Array.isArray(legacy1) && legacy1.length > 0) fallback.req1 = legacy1;
      } catch (e) {}
      try {
        const legacy2 = JSON.parse(localStorage.getItem('piano_cinema_request2_vote_history') || '[]');
        if (Array.isArray(legacy2) && legacy2.length > 0) fallback.req2 = legacy2;
      } catch (e) {}
      try {
        const legacy3 = JSON.parse(localStorage.getItem('piano_cinema_request3_vote_history') || '[]');
        if (Array.isArray(legacy3) && legacy3.length > 0) fallback.req3 = legacy3;
      } catch (e) {}

      this.saveLocalDrawer(fallback);
      return fallback;
    },

    /**
     * 端末専用の引き出しデータをローカル保存
     */
    saveLocalDrawer(drawerData) {
      try {
        const payload = {
          deviceId: CURRENT_DEVICE_ID,
          req1: Array.isArray(drawerData.req1) ? drawerData.req1 : [],
          req2: Array.isArray(drawerData.req2) ? drawerData.req2 : [],
          req3: Array.isArray(drawerData.req3) ? drawerData.req3 : [],
          lastUpdated: Date.now()
        };
        localStorage.setItem(LOCAL_DRAWER_KEY, JSON.stringify(payload));
        return payload;
      } catch (e) {
        console.warn('[VoteLockShield] Failed to save local drawer:', e);
        return drawerData;
      }
    },

    /**
     * サーバー（ポート8888）へ端末専用引き出しを送信して永続保管
     */
    async syncDrawerToServer(drawerData) {
      const payload = {
        deviceId: CURRENT_DEVICE_ID,
        req1: Array.isArray(drawerData.req1) ? drawerData.req1 : [],
        req2: Array.isArray(drawerData.req2) ? drawerData.req2 : [],
        req3: Array.isArray(drawerData.req3) ? drawerData.req3 : [],
        lastUpdated: Date.now()
      };

      try {
        const bodyObj = {};
        bodyObj[SERVER_DRAWER_KEY] = payload;

        if (window.pianoApp && typeof window.pianoApp.syncToServer === 'function') {
          await window.pianoApp.syncToServer(bodyObj);
        } else {
          const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
          const hostname = window.location.hostname || 'localhost';
          const port = window.location.port || '8888';
          await fetch(`${protocol}//${hostname}:${port}/api/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj)
          });
        }
      } catch (e) {
        console.warn('[VoteLockShield] syncDrawerToServer skipped (offline fallback):', e);
      }
    },

    /**
     * サーバーから届いた全データから自端末専用引き出しを安全に抽出し合流
     * （※他端末の引き出しや旧グローバル空配列には1ミリも干渉されない）
     */
    restoreDeviceLocksFromServer(serverData) {
      if (!serverData || typeof serverData !== 'object') return;

      const currentDrawer = this.getLocalDrawer();
      let updated = false;

      // 1. 管理画面リセット命令の検知（全端末同期用）
      [1, 2, 3].forEach(secNum => {
        const resetKey = `piano_cinema_request_reset_ts_${secNum}`;
        const serverResetTs = Number(serverData[resetKey]) || 0;
        const localResetTs = Number(localStorage.getItem(resetKey)) || 0;
        const activeResetTs = Math.max(serverResetTs, localResetTs);

        if (activeResetTs > 0) {
          localStorage.setItem(resetKey, String(activeResetTs));
          const reqKey = `req${secNum}`;
          const beforeCount = currentDrawer[reqKey].length;
          // リセット日時以前の投票履歴を破棄
          currentDrawer[reqKey] = currentDrawer[reqKey].filter(ts => ts > activeResetTs);
          if (currentDrawer[reqKey].length !== beforeCount) {
            updated = true;
          }
        }
      });

      // 2. 自端末専用の引き出しデータをサーバーから復元・マージ
      const remoteDrawer = serverData[SERVER_DRAWER_KEY];
      if (remoteDrawer && typeof remoteDrawer === 'object') {
        ['req1', 'req2', 'req3'].forEach(k => {
          if (Array.isArray(remoteDrawer[k])) {
            const combined = Array.from(new Set([...currentDrawer[k], ...remoteDrawer[k]]));
            if (combined.length !== currentDrawer[k].length) {
              currentDrawer[k] = combined;
              updated = true;
            }
          }
        });
      }

      if (updated) {
        this.saveLocalDrawer(currentDrawer);
      }
    },

    /**
     * 有効な投票タイムスタンプのみを抽出
     * （当日日付・24時間以内・リセット時刻以降）
     */
    getActiveVoteTimestamps(sectionNum) {
      const drawer = this.getLocalDrawer();
      const reqKey = `req${sectionNum}`;
      const rawList = drawer[reqKey] || [];
      const now = new Date();

      const resetKey = `piano_cinema_request_reset_ts_${sectionNum}`;
      const resetTs = Number(localStorage.getItem(resetKey)) || 0;

      return rawList.filter(ts => {
        if (typeof ts !== 'number' || isNaN(ts)) return false;
        if (resetTs > 0 && ts <= resetTs) return false;

        const voteDate = new Date(ts);
        const isSameDate = (
          voteDate.getFullYear() === now.getFullYear() &&
          voteDate.getMonth() === now.getMonth() &&
          voteDate.getDate() === now.getDate()
        );
        const isWithin24Hours = (now.getTime() - voteDate.getTime()) < 24 * 60 * 60 * 1000;
        return isSameDate && isWithin24Hours;
      });
    },

    /**
     * 本日投票上限（ロック状態）に達しているか判定
     */
    isDailyLimitReached(sectionNum) {
      let dailyLimit = 1;
      if (window.pianoApp) {
        if (sectionNum === 1 && typeof window.pianoApp.getRequestConfig === 'function') {
          dailyLimit = Math.max(1, Number(window.pianoApp.getRequestConfig().dailyLimit) || 1);
        } else if (sectionNum === 2 && typeof window.pianoApp.getRequest2Config === 'function') {
          dailyLimit = Math.max(1, Number(window.pianoApp.getRequest2Config().dailyLimit) || 1);
        } else if (sectionNum === 3 && typeof window.pianoApp.getRequest3Config === 'function') {
          dailyLimit = Math.max(1, Number(window.pianoApp.getRequest3Config().dailyLimit) || 1);
        }
      }

      const activeVotes = this.getActiveVoteTimestamps(sectionNum);
      return activeVotes.length >= dailyLimit;
    },

    /**
     * 投票を記録し、サーバーの自端末専用引き出しへ即時永続同期
     */
    async recordVote(sectionNum) {
      const drawer = this.getLocalDrawer();
      const reqKey = `req${sectionNum}`;
      const active = this.getActiveVoteTimestamps(sectionNum);
      active.push(Date.now());
      drawer[reqKey] = active;
      drawer.lastUpdated = Date.now();

      this.saveLocalDrawer(drawer);
      await this.syncDrawerToServer(drawer);

      console.log(`%c🛡️ [VOTE-LOCK-PATCH] リクエスト${sectionNum} 端末投票を記録・同期完了 (端末: ${CURRENT_DEVICE_ID}, 投票数: ${active.length})`, 'color: #10b981;');
    },

    /**
     * 管理者による特定セクションのリセット命令（全端末一斉解除）
     */
    async triggerSectionReset(sectionNum) {
      const resetTs = Date.now();
      const resetKey = `piano_cinema_request_reset_ts_${sectionNum}`;
      localStorage.setItem(resetKey, String(resetTs));

      const drawer = this.getLocalDrawer();
      drawer[`req${sectionNum}`] = [];
      drawer.lastUpdated = resetTs;
      this.saveLocalDrawer(drawer);

      const serverPayload = {};
      serverPayload[resetKey] = resetTs;
      serverPayload[SERVER_DRAWER_KEY] = drawer;

      try {
        if (window.pianoApp && typeof window.pianoApp.syncToServer === 'function') {
          await window.pianoApp.syncToServer(serverPayload);
        }
      } catch (e) {}

      console.log(`%c🧹 [VOTE-LOCK-PATCH] リクエスト${sectionNum} のロック制限を完全リセットしました`, 'color: #eab308;');
    }
  };

  window.VoteLockShield = VoteLockShield;

  // =========================================================================
  // 3. PianoCinemaApp 本体クラスのプロトタイプ上書き（安全な合流パッチ）
  //    ※既存の音響システム、ホバーSE、ボリューム同期、ゲーム機能等は一切傷つけない
  // =========================================================================
  function applyPatchesToPrototype() {
    if (typeof window.PianoCinemaApp === 'undefined') return false;

    const proto = window.PianoCinemaApp.prototype;

    // --- 3.1 サーバー同期処理のパッチ（旧グローバル履歴による自端末ロックの上書き破壊を完全遮断 + GitHub Pages静的sync-data.json自動対応） ---
    proto.syncFromServer = async function() {
      const applyServerOrStaticData = (dataObj, isStaticFallback) => {
        if (!dataObj || typeof dataObj !== 'object') return;
        for (const [key, value] of Object.entries(dataObj)) {
          // 【重要防壁】：旧グローバルの空配列履歴はlocalStorageに上書きさせない
          if (key === 'piano_cinema_request_vote_history' ||
              key === 'piano_cinema_request2_vote_history' ||
              key === 'piano_cinema_request3_vote_history') {
            continue;
          }
          // 【重要防壁】：他端末の個別引き出しキーは自端末のlocalStorageを汚さない
          if (key.startsWith(SERVER_DRAWER_PREFIX) && key !== SERVER_DRAWER_KEY) {
            continue;
          }
          if (value === undefined || value === null) continue;

          // 静的フォールバック時（GitHub Pages等）は自端末で投票したカウント減少を防ぐ
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

        // 自端末専用の引き出しデータをサーバーから復元・維持
        VoteLockShield.restoreDeviceLocksFromServer(dataObj);
      };

      const isLocalEnv = (typeof this.isLocalServerEnvironment === 'function')
        ? this.isLocalServerEnvironment()
        : (window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|::1|\[::1\]|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/i.test(window.location.hostname || ''));

      let syncedFromPort8888 = false;
      if (isLocalEnv) {
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
                applyServerOrStaticData(json.data, false);
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
              applyServerOrStaticData(dataObj, true);
            }
          }
        } catch (e) {
          console.warn('[Sync Engine] Static sync-data.json fetch skipped:', e);
        }
      }
    };

    // --- 3.2 第1弾リクエスト判定ロジックのパッチ ---
    proto.getTodayVoteHistory = function() {
      return VoteLockShield.getActiveVoteTimestamps(1);
    };

    proto.isDailyLimitReached = function() {
      return VoteLockShield.isDailyLimitReached(1);
    };

    proto.recordVote = function() {
      VoteLockShield.recordVote(1);
    };

    // --- 3.3 第2弾リクエスト判定ロジックのパッチ ---
    proto.getTodayVoteHistory2 = function() {
      return VoteLockShield.getActiveVoteTimestamps(2);
    };

    proto.isDailyLimitReached2 = function() {
      return VoteLockShield.isDailyLimitReached(2);
    };

    proto.recordVote2 = function() {
      VoteLockShield.recordVote(2);
    };

    // --- 3.4 第3弾リクエスト判定ロジックのパッチ ---
    proto.getTodayVoteHistory3 = function() {
      return VoteLockShield.getActiveVoteTimestamps(3);
    };

    proto.isDailyLimitReached3 = function() {
      return VoteLockShield.isDailyLimitReached(3);
    };

    proto.recordVote3 = function() {
      VoteLockShield.recordVote(3);
    };

    console.log('%c🛡️ [VOTE-LOCK-PATCH] PianoCinemaApp プロトタイプへの合流完了（防壁展開済み）', 'color: #10b981;');
    return true;
  }

  // 即時適用を試行
  applyPatchesToPrototype();

  // =========================================================================
  // 4. アプリケーションインスタンス起動時 & 管理画面リセットボタンのフック
  // =========================================================================
  function hookAppInstanceAndControls() {
    applyPatchesToPrototype();

    if (window.pianoApp) {
      // 既存インスタンスへのメソッド直接結合（万全を期す）
      window.pianoApp.getTodayVoteHistory = () => VoteLockShield.getActiveVoteTimestamps(1);
      window.pianoApp.isDailyLimitReached = () => VoteLockShield.isDailyLimitReached(1);
      window.pianoApp.recordVote = () => VoteLockShield.recordVote(1);

      window.pianoApp.getTodayVoteHistory2 = () => VoteLockShield.getActiveVoteTimestamps(2);
      window.pianoApp.isDailyLimitReached2 = () => VoteLockShield.isDailyLimitReached(2);
      window.pianoApp.recordVote2 = () => VoteLockShield.recordVote(2);

      window.pianoApp.getTodayVoteHistory3 = () => VoteLockShield.getActiveVoteTimestamps(3);
      window.pianoApp.isDailyLimitReached3 = () => VoteLockShield.isDailyLimitReached(3);
      window.pianoApp.recordVote3 = () => VoteLockShield.recordVote(3);

      // 初期UIスロット表示のロック状態を再評価
      if (typeof window.pianoApp.updateAllRequestSlots === 'function') {
        window.pianoApp.updateAllRequestSlots();
      }
      if (typeof window.pianoApp.updateAllRequest2Slots === 'function') {
        window.pianoApp.updateAllRequest2Slots();
      }
      if (typeof window.pianoApp.updateAllRequest3Slots === 'function') {
        window.pianoApp.updateAllRequest3Slots();
      }
      if (typeof window.pianoApp.loadSectionHeaders === 'function') {
        window.pianoApp.loadSectionHeaders();
      }
    }

    // 管理画面リセットボタンへの確実な連動フック（全端末同期解除）
    const bindResetHook = (btnId, secNum) => {
      const btn = document.getElementById(btnId);
      if (btn && !btn.dataset.lockShieldBound) {
        btn.dataset.lockShieldBound = 'true';
        btn.addEventListener('click', () => {
          setTimeout(() => {
            VoteLockShield.triggerSectionReset(secNum);
          }, 100);
        });
      }
    };

    bindResetHook('btnResetRequestVotes', 1);
    bindResetHook('btnResetRequest2Votes', 2);
    bindResetHook('btnResetRequest3Votes', 3);
  }

  // DOMContentLoaded 時の確実なバインド
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookAppInstanceAndControls);
  } else {
    hookAppInstanceAndControls();
  }

  // window load 時の二重チェック
  window.addEventListener('load', () => {
    hookAppInstanceAndControls();
  });

  // タブ復帰時（モバイル画面復帰・別タブからの復帰）の自動状態更新
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.pianoApp) {
      if (typeof window.pianoApp.updateAllRequestSlots === 'function') window.pianoApp.updateAllRequestSlots();
      if (typeof window.pianoApp.updateAllRequest2Slots === 'function') window.pianoApp.updateAllRequest2Slots();
      if (typeof window.pianoApp.updateAllRequest3Slots === 'function') window.pianoApp.updateAllRequest3Slots();
    }
  });

  console.log('%c🛡️ [VOTE-LOCK-PATCH] 端末識別個別ロックシステム ドッキング完了（待機中）', 'color: #10b981; font-weight: bold;');
})();
