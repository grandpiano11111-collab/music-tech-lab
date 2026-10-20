/**
 * ====================================================================
 * 🛡️ GAME AUDIO SHIELD & SILENT LOCK PATCH (統合音声シールドパッチ)
 * ====================================================================
 * 1. 【スマホ・iPad環境での完全無音化（サイレントロック）】
 *    - 1024px以下またはタッチ環境時、ゲームiframeの音声ロード・再生を100%遮断
 *    - iframe srcを安全に退避し、万一のロード時もBGM/WebAudio/HTML5 Audioを多重封殺
 * 2. 【Windows大画面環境での居残りBGM一括強制終了】
 *    - IntersectionObserver ＆ スクロール検知によるセクション離脱時の一括完全消音
 *    - ゲーム内終了ボタン（btnPauseQuit等）クリック時の一斉強制停止
 *    - メニューリンククリック・全画面解除・閉じるボタン・タブ非表示時の完全消音
 * 3. 【サイト本体の完全死守】
 *    - 既存のホバーSE、ボリューム同期（SE: 22%等）、YouTube等は1ミリも傷つけず維持
 * ====================================================================
 */
(function() {
  'use strict';

  // 1. スマホ・iPad・目隠しパネル環境判定
  function isMobileCoverActive() {
    var isNarrow = window.innerWidth <= 1024;
    var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var cover = document.getElementById('gameMobileCoverPanel');
    var isCoverShown = cover && window.getComputedStyle(cover).display !== 'none';
    return isNarrow || isTouch || isCoverShown;
  }

  // 2. ゲームiframe要素の一括取得ヘルパー
  function getGameIframes() {
    return document.querySelectorAll('#labCard1GameContainer iframe, .app-game-iframe');
  }

  // 3. 【スマホ用】iframe内部の全音声を物理的・動的に完全消音＆上書き無力化
  function silenceIframeInternals(iframe) {
    if (!iframe) return;
    try {
      var cw = iframe.contentWindow;
      if (!cw) return;

      // (A) 新ゲーム（ブロック崩し）BGMマネージャーの停止＆恒久消音上書き
      if (cw.BGM) {
        try {
          if (typeof cw.BGM.stop === 'function') cw.BGM.stop();
          if (typeof cw.BGM.pause === 'function') cw.BGM.pause();
          if (cw.BGM.audio) {
            cw.BGM.audio.pause();
            cw.BGM.audio.muted = true;
            cw.BGM.audio.volume = 0;
            cw.BGM.audio.currentTime = 0;
          }
        } catch (e) {}

        // スマホ環境では二度とBGMを再生させないよう無力化
        cw.BGM.playTrack = function() { return false; };
        cw.BGM.resume = function() { return false; };
      }

      // (B) 音声起動関数の無力化
      if (typeof cw.tryStartBGM === 'function') {
        cw.tryStartBGM = function() {};
      }
      if (typeof cw.unlockAudioHandler === 'function') {
        cw.unlockAudioHandler = function() {};
      }

      // (C) Web Audio API (Sound.ctx) の即時サスペンド
      if (cw.Sound && cw.Sound.ctx) {
        try {
          if (typeof cw.Sound.ctx.suspend === 'function') {
            cw.Sound.ctx.suspend().catch(function() {});
          }
        } catch (e) {}
      }

      // (D) レガシーゲーム（AI OTOGE-10等）Tone.js 対策
      if (cw.Tone) {
        try {
          if (cw.Tone.Destination) cw.Tone.Destination.mute = true;
          if (cw.Tone.context && cw.Tone.context.rawContext && typeof cw.Tone.context.rawContext.suspend === 'function') {
            cw.Tone.context.rawContext.suspend().catch(function() {});
          }
        } catch (e) {}
      }

      // (E) iframe内DOMのすべての audio / video 要素を走査して完全消音
      if (iframe.contentDocument) {
        var mediaElements = iframe.contentDocument.querySelectorAll('audio, video');
        mediaElements.forEach(function(el) {
          try {
            el.pause();
            el.muted = true;
            el.volume = 0;
            el.currentTime = 0;
          } catch (e) {}
        });
      }
    } catch (e) {
      // 安全にスルー
    }
  }

  // 4. 【Windows用】居残りBGMの一括強制完全終了（離脱時・ゲーム終了時等）
  function killGameAudio(sourceReason) {
    var iframes = getGameIframes();
    iframes.forEach(function(iframe) {
      try {
        var cw = iframe.contentWindow;
        if (!cw) return;

        // BGMマネージャーの確実な強制停止
        if (cw.BGM) {
          try {
            if (typeof cw.BGM.stop === 'function') {
              cw.BGM.stop();
            } else if (typeof cw.BGM.pause === 'function') {
              cw.BGM.pause();
            }
          } catch (e) {}

          if (cw.BGM.audio) {
            try {
              cw.BGM.audio.pause();
              cw.BGM.audio.currentTime = 0;
            } catch (e) {}
          }
        }

        // Web Audio API 音声ソースの強制サスペンド
        if (cw.Sound && cw.Sound.ctx && typeof cw.Sound.ctx.suspend === 'function') {
          cw.Sound.ctx.suspend().catch(function() {});
        }

        // 旧Tone.js対策
        if (cw.Tone && cw.Tone.context && cw.Tone.context.rawContext && typeof cw.Tone.context.rawContext.suspend === 'function') {
          cw.Tone.context.rawContext.suspend().catch(function() {});
        }

        // 全audio / video 要素の即時停止
        if (iframe.contentDocument) {
          var medias = iframe.contentDocument.querySelectorAll('audio, video');
          medias.forEach(function(m) {
            try {
              m.pause();
              m.currentTime = 0;
            } catch (e) {}
          });
        }
      } catch (e) {}
    });
  }

  // 5. スマホ・iPad環境とPC大画面環境の動的シールド適用
  function enforceAudioShieldPolicy() {
    var isMobile = isMobileCoverActive();
    var iframes = getGameIframes();

    iframes.forEach(function(iframe) {
      if (isMobile) {
        // --- スマホ・iPad環境：物理的・論理的二重サイレントロック ---
        var curSrc = iframe.getAttribute('src') || iframe.src || '';
        if (curSrc && curSrc !== 'about:blank') {
          iframe.setAttribute('data-game-shield-src', curSrc);
          iframe.src = 'about:blank';
        }
        silenceIframeInternals(iframe);
      } else {
        // --- PC（Windows）大画面環境：ゲーム通常復元 ---
        var savedSrc = iframe.getAttribute('data-game-shield-src');
        var curSrc = iframe.getAttribute('src') || '';
        if (savedSrc && (!curSrc || curSrc === 'about:blank')) {
          iframe.src = savedSrc;
        } else if (!curSrc || curSrc === 'about:blank') {
          iframe.src = 'games/index.html';
        }
      }
    });
  }

  // 6. ゲームエリア監視：IntersectionObserver ＆ スクロール検知による離脱自動消音
  function setupScrollIntersectionShield() {
    // A. IntersectionObserver による画面外検知
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.05) {
            killGameAudio('Scroll Out of View (Observer)');
          }
        });
      }, {
        root: null,
        rootMargin: '0px',
        threshold: [0, 0.05, 0.1]
      });

      var labAppsSection = document.getElementById('lab-apps');
      if (labAppsSection) observer.observe(labAppsSection);

      var gameContainer = document.getElementById('labCard1GameContainer');
      if (gameContainer) observer.observe(gameContainer);
    }

    // B. スクロールイベントによるリアルタイム境界二重チェック
    var scrollThrottleTimer = null;
    window.addEventListener('scroll', function() {
      if (scrollThrottleTimer) return;
      scrollThrottleTimer = setTimeout(function() {
        scrollThrottleTimer = null;
        var section = document.getElementById('lab-apps');
        if (section) {
          var rect = section.getBoundingClientRect();
          // セクションが画面の上にスクロールアウト、または画面の下にスクロールアウトした場合
          if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
            killGameAudio('Scroll Out of Bounds');
          }
        }
      }, 150);
    }, { passive: true });
  }

  // 7. ゲーム内部の終了操作（btnPauseQuit等）フック
  function hookGameInternalExit(iframe) {
    if (!iframe) return;
    try {
      var doc = iframe.contentDocument;
      if (!doc) return;

      // ゲーム内ポーズメニューの「タイトルへ戻る / 終了」ボタン
      var quitBtns = doc.querySelectorAll('#btnPauseQuit, .btn-quit, #btnReturnTitle');
      quitBtns.forEach(function(btn) {
        if (!btn.dataset.shieldBound) {
          btn.dataset.shieldBound = 'true';
          btn.addEventListener('click', function() {
            setTimeout(function() {
              killGameAudio('Game Quit Button Clicked');
            }, 50);
          });
        }
      });
    } catch (e) {}
  }

  // 8. ページ内リンク（他セクション移動）クリック時の即時BGM消音
  function setupNavigationShield() {
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href^="#"]');
      if (link) {
        var href = link.getAttribute('href');
        if (href && href !== '#lab-apps' && href !== '#') {
          killGameAudio('Navigate to ' + href);
        }
      }
    }, { passive: true });
  }

  // 9. 全画面解除・閉じるボタン・タブ非表示時のBGM消音
  function setupFullscreenAndVisibilityShield() {
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(function(evtName) {
      document.addEventListener(evtName, function() {
        var isFs = !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        );
        if (!isFs) {
          killGameAudio('Fullscreen Exit');
        }
      });
    });

    document.addEventListener('click', function(e) {
      if (e.target.closest('#btnGameFullscreenClose')) {
        killGameAudio('Fullscreen Close Button Clicked');
      }
    }, { capture: true });

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        killGameAudio('Tab Hidden');
      }
    });

    window.addEventListener('pagehide', function() {
      killGameAudio('Page Hide');
    });

    window.addEventListener('blur', function() {
      killGameAudio('Window Blur');
    });
  }

  // 10. 目隠しパネル（gameMobileCoverPanel）のタップ貫通ガード
  function setupMobileCoverTouchGuard() {
    var cover = document.getElementById('gameMobileCoverPanel');
    if (cover) {
      ['pointerdown', 'touchstart', 'touchend', 'click'].forEach(function(evt) {
        cover.addEventListener(evt, function(e) {
          e.stopPropagation();
          var iframes = getGameIframes();
          iframes.forEach(silenceIframeInternals);
        }, { passive: false });
      });
    }
  }

  // 11. 初期化＆ライフサイクル監視
  function initAudioShield() {
    enforceAudioShieldPolicy();
    setupScrollIntersectionShield();
    setupNavigationShield();
    setupFullscreenAndVisibilityShield();
    setupMobileCoverTouchGuard();

    var gameContainer = document.getElementById('labCard1GameContainer');
    if (gameContainer) {
      var observer = new MutationObserver(function() {
        enforceAudioShieldPolicy();
        var iframes = getGameIframes();
        iframes.forEach(function(iframe) {
          iframe.addEventListener('load', function() {
            if (isMobileCoverActive()) {
              silenceIframeInternals(iframe);
            } else {
              hookGameInternalExit(iframe);
            }
          });
        });
      });
      observer.observe(gameContainer, { childList: true, subtree: true });
    }

    window.addEventListener('resize', function() {
      enforceAudioShieldPolicy();
    }, { passive: true });
    window.addEventListener('orientationchange', function() {
      setTimeout(enforceAudioShieldPolicy, 100);
    }, { passive: true });

    var existingIframes = getGameIframes();
    existingIframes.forEach(function(f) {
      f.addEventListener('load', function() {
        if (isMobileCoverActive()) {
          silenceIframeInternals(f);
        } else {
          hookGameInternalExit(f);
        }
      });
      if (f.contentDocument && f.contentDocument.readyState === 'complete') {
        hookGameInternalExit(f);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioShield);
  } else {
    initAudioShield();
  }

  window.addEventListener('load', initAudioShield);

  console.log('%c🛡️ [GAME-AUDIO-SHIELD] スマホ完全無音化 ＆ Windows居残りBGM強制終了シールド完全合流完了', 'color: #00f0ff; font-weight: bold;');
})();
