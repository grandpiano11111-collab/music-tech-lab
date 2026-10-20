/**
 * ==========================================================================
 *  PIANO CINEMA - GSAP & INTERACTION ANIMATIONS ENGINE
 * ==========================================================================
 *  Awwwards-level opening curtain, custom magnetic cursor,
 *  ScrollTrigger reveals, and dynamic card staggering.
 */

class AnimationEngine {
  constructor() {
    this.cursor = document.getElementById('customCursor');
    this.cursorDot = this.cursor?.querySelector('.cursor-dot');
    this.cursorCircle = this.cursor?.querySelector('.cursor-circle');
    this.cursorLabel = this.cursor?.querySelector('.cursor-label');
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * アニメーションシステム初期化
   */
  init() {
    // GSAP ScrollTrigger プラグイン登録
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    if (!this.isTouchDevice) {
      this.initCustomCursor();
      this.initMagneticElements();
    }

    this.initHeaderScrollEffect();
  }

  /**
   * オープニング幕開けアニメーション
   */
  playOpeningSequence(onComplete) {
    const loader = document.getElementById('curtainLoader');
    const monogram = loader?.querySelector('.loader-monogram');
    const title = loader?.querySelector('.loader-title');
    const subtitle = loader?.querySelector('.loader-subtitle');
    const barWrap = loader?.querySelector('.loader-bar-wrap');
    const barFill = document.getElementById('loaderBarFill');
    const curtainTop = loader?.querySelector('.curtain-top');
    // アニメーション開始前に最上部へリセット
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.clearScrollMemory) {
      ScrollTrigger.clearScrollMemory('manual');
    }

    if (!loader || typeof gsap === 'undefined') {
      window.scrollTo(0, 0);
      document.body.classList.remove('is-loading');
      this.initScrollAnimations();
      if (onComplete) onComplete();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        window.scrollTo(0, 0);
        document.body.classList.remove('is-loading');
        loader.style.pointerEvents = 'none';
        loader.style.display = 'none';
        this.initScrollAnimations();
        if (typeof ScrollTrigger !== 'undefined') {
          ScrollTrigger.refresh();
        }
        window.scrollTo(0, 0);
        if (onComplete) onComplete();
      }
    });

    // 1. ローダー要素の登場
    tl.to(monogram, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' })
      .to(title, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5')
      .to(subtitle, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5')
      .to(barWrap, { opacity: 1, duration: 0.4 }, '-=0.3')
      .to(barFill, { width: '100%', duration: 1.2, ease: 'power3.inOut' })
      .to([monogram, title, subtitle, barWrap], { 
        opacity: 0, 
        y: -20, 
        duration: 0.5, 
        ease: 'power2.in' 
      }, '+=0.2');

    // 2. カーテンが上下に開き、漆黒の舞台が現れる
    tl.to(curtainTop, {
      yPercent: -100,
      duration: 1.2,
      ease: 'expo.inOut'
    }, '-=0.1');

    tl.to(curtainBottom, {
      yPercent: 100,
      duration: 1.2,
      ease: 'expo.inOut'
    }, '<');

    // 3. ヒーローセクションの要素がシネマティックにフェードイン
    tl.from('.site-header', {
      y: -30,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    }, '-=0.8');

    tl.from('.hero-header-meta, .hero-brand-top', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6');

    tl.from('.title-group-main, .title-group-brand', {
      y: 50,
      opacity: 0,
      stagger: 0.2,
      duration: 1.1,
      ease: 'power4.out'
    }, '-=0.6');

    tl.from('.hero-tagline', {
      y: 25,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out'
    }, '-=0.7');

    tl.from('.hero-footer-meta .stat-pill', {
      y: 30,
      opacity: 0,
      stagger: 0.12,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.6');

    tl.from('.hero-social-dock', {
      y: 25,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    }, '-=0.5');

    tl.from('.hero-scroll-indicator', {
      opacity: 0,
      y: 20,
      duration: 0.8,
      ease: 'power2.out'
    }, '-=0.4');
  }

  /**
   * カスタムカーソルの追従 & ホバー変形
   */
  initCustomCursor() {
    if (!this.cursor) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let circleX = mouseX;
    let circleY = mouseY;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    const updateCursor = () => {
      // ドットは素早く追従
      dotX += (mouseX - dotX) * 0.4;
      dotY += (mouseY - dotY) * 0.4;

      // サークルは滑らか・微かな遅延を持って追従
      circleX += (mouseX - circleX) * 0.15;
      circleY += (mouseY - circleY) * 0.15;

      if (this.cursor) {
        this.cursor.style.transform = `translate3d(${circleX}px, ${circleY}px, 0)`;
      }
      if (this.cursorDot) {
        this.cursorDot.style.transform = `translate3d(${dotX - circleX}px, ${dotY - circleY}px, 0)`;
      }

      requestAnimationFrame(updateCursor);
    };
    requestAnimationFrame(updateCursor);

    // ホバーイベントリスナーの登録（動的要素対応）
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (target.closest('.video-card') || target.closest('.shorts-card')) {
        document.body.classList.add('hovering-video');
      } else if (target.closest('a') || target.closest('button') || target.closest('[data-magnetic]')) {
        document.body.classList.add('hovering-link');
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (target.closest('.video-card') || target.closest('.shorts-card')) {
        document.body.classList.remove('hovering-video');
      } else if (target.closest('a') || target.closest('button') || target.closest('[data-magnetic]')) {
        document.body.classList.remove('hovering-link');
      }
    });
  }

  /**
   * マグネティックボタン演出
   */
  initMagneticElements() {
    const magneticElements = document.querySelectorAll('[data-magnetic]');

    magneticElements.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) * 0.35;
        const deltaY = (e.clientY - centerY) * 0.35;

        gsap.to(el, {
          x: deltaX,
          y: deltaY,
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      el.addEventListener('mouseleave', () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          duration: 0.6,
          ease: 'elastic.out(1, 0.4)'
        });
      });
    });
  }

  /**
   * ヘッダーのスクロール検知（背景ぼかし）
   */
  initHeaderScrollEffect() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  /**
   * スクロールリビール演出 (ScrollTrigger)
   */
  initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    // 1. 各セクションヘッダーのリビール演出
    document.querySelectorAll('.section-header').forEach((header) => {
      gsap.from(header, {
        scrollTrigger: {
          trigger: header,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        y: 40,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out'
      });
    });

    // 2. 01 / FEATURES (動画のこだわり) カード & バナー
    gsap.from('.feature-card', {
      scrollTrigger: {
        trigger: '#features',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      stagger: 0.12,
      duration: 0.8,
      ease: 'power3.out'
    });

    gsap.from('.features-demo-banner', {
      scrollTrigger: {
        trigger: '.features-demo-banner',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    });

    // 3. 04 / LAB APPS (Google Antigravity) バナー & カード
    gsap.from('.antigravity-hero-banner', {
      scrollTrigger: {
        trigger: '#lab-apps',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    });

    gsap.from('.app-card', {
      scrollTrigger: {
        trigger: '.apps-grid',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      stagger: 0.12,
      duration: 0.85,
      ease: 'power3.out'
    });

    // 3.5. 05 / STORE (Piascore 楽譜販売) バナー & カード
    gsap.from('.store-hero-banner', {
      scrollTrigger: {
        trigger: '#store',
        start: 'top 80%',
        toggleActions: 'play none none none'
      },
      y: 40,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    });

    gsap.from('.sheet-card', {
      scrollTrigger: {
        trigger: '.sheet-music-grid',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      stagger: 0.1,
      duration: 0.85,
      ease: 'power3.out'
    });

    gsap.from('.store-guide-banner', {
      scrollTrigger: {
        trigger: '.store-guide-banner',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 35,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out'
    });

    // 4. ヒーロー背景の微かなパララックス
    gsap.to('.hero-piano-silhouette', {
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      },
      y: 120,
      opacity: 0.05
    });
  }

  /**
   * 新しく追加された動画カードをスタッガーアニメーションで表示
   */
  animateNewCards(cardElements) {
    if (!cardElements || cardElements.length === 0 || typeof gsap === 'undefined') return;

    gsap.fromTo(cardElements, 
      {
        opacity: 0,
        y: 50,
        scale: 0.96
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        stagger: 0.08,
        duration: 0.75,
        ease: 'power3.out'
      }
    );
  }
}

// グローバルスコープに公開
window.AnimationEngine = AnimationEngine;
