/* ============================================
   KaisySales — Landing Page Scripts
   ============================================ */

(function () {
  'use strict';

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
  const navbar = document.getElementById('navbar');

  function applyNavScroll() {
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
})();
