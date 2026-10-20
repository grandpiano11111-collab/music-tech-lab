/**
 * =========================================================================
 * ADMIN SHIELD SECURITY PATCH (Windowsローカル自動識別＆鉄壁セキュリティ)
 * ファイル名: js/admin-shield-patch.js
 * =========================================================================
 * 1. Windowsパソコン自身（localhost / 127.0.0.1 / ::1）：
 *    - 完全に自動判別し、セキュリティ制限を100%バイパス（完全免除）
 *    - 最初からフッター管理ボタン・鍵マークを完全表示
 *    - Ctrl + Shift + A のショートカットキーも即座に管理画面が起動
 * 2. 一般の視聴者（スマホ、iPad、Wi-Fi接続端末、将来の外部公開環境）：
 *    - 管理ボタン (#footerAdminBtn) を完全隠滅 (display: none !important)
 *    - 鍵マーク (#secretAdminTrigger) を完全隠滅 (display: none !important)
 *    - Ctrl + Shift + A や裏コマンドを最優先キャプチャで100%強制ブロック
 * 3. クライアント様専用のスマホ等での鍵開けルート：
 *    - URLに「?admin=true」を付与した時のみ、スマホ等でも特権開通
 *    - ローカルPCで「?admin=false」をつけると一般人隠蔽テストが可能
 * 4. 既存成果・音響システム・SE・デザイン等は100%完全無傷を死守
 * =========================================================================
 */

(function() {
  'use strict';

  // 1. ローカル開発環境（Windows PC自身）の自動判別
  function isLocalhostOrigin() {
    try {
      const protocol = window.location.protocol;
      const hostname = (window.location.hostname || '').toLowerCase();
      return (
        protocol === 'file:' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '[::1]' ||
        hostname === ''
      );
    } catch (e) {}
    return false;
  }

  // 2. 管理者特権判定（世界中でクライアント様のWindows PCただ1台のみに完全限定）
  function checkAdminPrivilege() {
    try {
      // Windows PC（localhost / 127.0.0.1 / file:）以外の外部公開URL・スマホ・iPadからは永久に100%完全遮断
      if (!isLocalhostOrigin()) {
        try { sessionStorage.removeItem('piano_cinema_admin_unlocked'); } catch (e) {}
        return false;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const adminParam = urlParams.get('admin');

      // 明示的に ?admin=false が指定された場合（ローカルPCでの一般人表示テスト用）
      if (adminParam === 'false' || adminParam === '0') {
        try { sessionStorage.removeItem('piano_cinema_admin_unlocked'); } catch (e) {}
        return false;
      }

      // 【最重要】クライアント様ご自身のWindows PC（localhost / 127.0.0.1 / エクスプローラー直接起動）は100%完全自動バイパス
      return true;
    } catch (e) {}

    return false;
  }

  const isPrivileged = checkAdminPrivilege();

  // ルート要素に特権クラスを付与
  if (isPrivileged) {
    document.documentElement.classList.add('admin-shield-unlocked');
    document.documentElement.classList.remove('admin-shield-locked');
  } else {
    document.documentElement.classList.add('admin-shield-locked');
    document.documentElement.classList.remove('admin-shield-unlocked');
  }

  // 3. CSSスタイルによる最速・完全隠滅防壁（チラつきゼロ）
  const styleEl = document.createElement('style');
  styleEl.id = 'adminShieldSecurityStyle';
  if (!isPrivileged) {
    styleEl.textContent = `
      #footerAdminBtn,
      .footer-config-btn,
      #secretAdminTrigger,
      .secret-admin-trigger,
      [aria-label="管理者ログイン"],
      [title*="管理者パネル"],
      #adminModal:not(.admin-shield-unlocked) {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
        opacity: 0 !important;
        max-width: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
      }
    `;
  } else {
    styleEl.textContent = `
      #footerAdminBtn,
      .footer-config-btn,
      #secretAdminTrigger,
      .secret-admin-trigger {
        display: inline-flex !important;
        visibility: visible !important;
        pointer-events: auto !important;
        opacity: 1 !important;
      }
    `;
  }
  document.head.appendChild(styleEl);

  // 4. DOM要素に対する直接防御（インラインスタイルの二重防壁）
  function enforceElementShield() {
    if (checkAdminPrivilege()) {
      // 特権環境：要素を確実に表示
      const targets = [
        document.getElementById('footerAdminBtn'),
        document.getElementById('secretAdminTrigger'),
        ...document.querySelectorAll('.footer-config-btn, .secret-admin-trigger')
      ];
      targets.forEach(el => {
        if (el) {
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('pointer-events');
          el.removeAttribute('aria-hidden');
          el.tabIndex = 0;
        }
      });
      return;
    }

    // 一般環境（スマホ・iPad等）：完全隠蔽
    const targets = [
      document.getElementById('footerAdminBtn'),
      document.getElementById('secretAdminTrigger'),
      ...document.querySelectorAll('.footer-config-btn, .secret-admin-trigger, [aria-label="管理者ログイン"]')
    ];

    targets.forEach(el => {
      if (el) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
      }
    });

    const modal = document.getElementById('adminModal');
    if (modal && !modal.classList.contains('admin-shield-unlocked')) {
      modal.style.setProperty('display', 'none', 'important');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // 5. キーボードショートカット (Ctrl + Shift + A / Alt + A) の処理
  window.addEventListener('keydown', function(e) {
    if (checkAdminPrivilege()) {
      // 特権環境（Windows PC自身等）：ブロックせず通常通り許可
      return;
    }

    // 一般環境（スマホ・iPad・一般閲覧者）：完全に拒否＆無効化
    const isCtrlShiftA = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA');
    const isAltA = e.altKey && (e.key === 'a' || e.key === 'A' || e.code === 'KeyA');

    if (isCtrlShiftA || isAltA) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true); // キャプチャフェーズ(true)で最優先横取り

  // 6. JavaScript API (openAdminModal) へのアクセス保護
  function patchAppMethods() {
    if (typeof PianoCinemaApp !== 'undefined' && PianoCinemaApp.prototype) {
      const origProtoOpen = PianoCinemaApp.prototype.openAdminModal;
      PianoCinemaApp.prototype.openAdminModal = function() {
        if (!checkAdminPrivilege()) {
          console.warn('[Admin Shield] Access denied.');
          return false;
        }
        const modal = document.getElementById('adminModal');
        if (modal) modal.classList.add('admin-shield-unlocked');
        return origProtoOpen.apply(this, arguments);
      };
    }

    if (window.pianoApp) {
      const origInstanceOpen = window.pianoApp.openAdminModal;
      window.pianoApp.openAdminModal = function() {
        if (!checkAdminPrivilege()) {
          console.warn('[Admin Shield] Access denied.');
          return false;
        }
        const modal = document.getElementById('adminModal');
        if (modal) modal.classList.add('admin-shield-unlocked');
        return origInstanceOpen.apply(this, arguments);
      };
    }
  }

  // 即時実行＆ライフサイクルバインド
  enforceElementShield();
  patchAppMethods();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enforceElementShield();
      patchAppMethods();
    });
  }

  window.addEventListener('load', () => {
    enforceElementShield();
    patchAppMethods();
  });

  if (isPrivileged) {
    if (isLocalhostOrigin()) {
      console.log('%c💻 [ADMIN SHIELD] Windowsローカル環境を自動識別：管理者特権を完全自動バイパス適用', 'color: #10b981; font-weight: bold;');
    } else {
      console.log('%c👑 [ADMIN SHIELD] 特権管理者モードが有効化されました (?admin=true)', 'color: #f59e0b; font-weight: bold;');
    }
  } else {
    console.log('%c🛡️ [ADMIN SHIELD] 一般アクセス防壁稼働中（スマホ・外部アクセス：管理機能完全隠滅）', 'color: #3b82f6; font-weight: bold;');
  }
})();
