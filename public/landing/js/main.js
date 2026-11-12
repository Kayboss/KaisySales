/* ============================================
   KaisySales — Landing Page Scripts
   ============================================ */

(function () {
  'use strict';

  // --- First-touch attribution ---
  // The app can only say which channel brought a business if this page writes
  // it down: the campaign parameters disappear the moment someone clicks
  // through to /login, and there is no user to attach them to yet. Same key and
  // shape as src/utils/growth.js, and the same rule: the first touch of the
  // session wins, so a later page cannot overwrite where someone really came
  // from.
  (function () {
    var KEY = 'kaisysales_acquisition';
    try {
      if (window.sessionStorage.getItem(KEY)) return;

      var params = new URLSearchParams(window.location.search);
      var read = function (name) {
        var value = params.get('utm_' + name);
        return value ? String(value).trim().slice(0, 120) : '';
      };

      var refHost = '';
      try {
        refHost = new URL(document.referrer).hostname.replace(/^www\./i, '').toLowerCase();
      } catch {
        refHost = '';
      }
      var own = window.location.host.replace(/^www\./i, '').toLowerCase();

      window.sessionStorage.setItem(
        KEY,
        JSON.stringify({
          source: read('source') || (refHost && refHost !== own ? refHost : 'direct'),
          medium: read('medium'),
          campaign: read('campaign'),
          content: read('content'),
          term: read('term'),
          referrer: String(document.referrer || '').slice(0, 120),
          landingPage: window.location.pathname || '/',
          capturedAt: new Date().toISOString()
        })
      );
    } catch {
      /* storage refused: attribution is lost, the page still works */
    }
  })();

  // --- Scroll Reveal ---
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // --- Navbar scroll effect ---
  // Only the landing page has a hero for a transparent navbar to sit on. Every
  // other page ships `nav--scrolled` in its markup because its page header is a
  // solid colour, and the logo swap (`logo.svg` ↔ `logo2.svg`) is driven by that
  // same class. Toggling it on those pages would strip the solid background and
  // leave the white logo and white links over a cream header, so the toggle is
  // scoped to pages that actually have a hero.
  const navbar = document.getElementById('navbar');
  const hasHero = !!document.querySelector('.hero');

  function applyNavScroll() {
    if (!navbar || !hasHero) return;
    navbar.classList.toggle('nav--scrolled', window.scrollY > 60);
  }

  applyNavScroll();
  window.addEventListener('scroll', applyNavScroll, { passive: true });
  window.addEventListener('load', applyNavScroll);

  // --- Mobile menu ---
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger) {
    function setMenuOpen(open) {
      hamburger.classList.toggle('active', open);
      navLinks.classList.toggle('open', open);
      navbar.classList.toggle('nav--menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    hamburger.addEventListener('click', function () {
      setMenuOpen(!navLinks.classList.contains('open'));
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav__link, .nav__cta').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenuOpen(false);
      });
    });

    navLinks.addEventListener('click', function (e) {
      if (e.target === navLinks) setMenuOpen(false);
    });
  }

  // --- Counter Animation ---
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;

    const duration = 2000;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      el.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('.trust-number').forEach((el) => counterObserver.observe(el));

  // --- Smooth anchor scroll ---
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- FAQ accordion (Help page) ---
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = this.parentElement;
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open');
      });
      if (!isOpen) item.classList.add('open');
    });
  });
})();
