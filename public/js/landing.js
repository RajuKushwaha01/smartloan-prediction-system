/* ============================================
   SMARTLOAN AI — LANDING PAGE INTERACTIONS
   Mobile menu, FAQ accordion, scroll reveal
   ============================================ */
(function () {
  /* ---- Mobile menu toggle ---- */
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('icon-open');
  const iconClose = document.getElementById('icon-close');

  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('hidden');
      menu.classList.toggle('flex');
      iconOpen.classList.toggle('hidden');
      iconClose.classList.toggle('hidden');
    });
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    const icon = item.querySelector('.faq-icon');

    question.addEventListener('click', () => {
      const isOpen = !answer.classList.contains('hidden');

      // close all others
      document.querySelectorAll('.faq-answer').forEach(a => a.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => i.style.transform = 'rotate(0deg)');

      if (!isOpen) {
        answer.classList.remove('hidden');
        icon.style.transform = 'rotate(45deg)';
      }
    });
  });

  /* ---- Scroll reveal for sections ---- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealEls = document.querySelectorAll('.reveal-on-scroll');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(el => observer.observe(el));
  } else {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('revealed'));
  }

  /* ---- Animate connecting line in "How It Works" as it scrolls into view ---- */
  const timeline = document.getElementById('timeline-line-fill');
  if (timeline && !reducedMotion && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          timeline.style.width = '100%';
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(timeline.parentElement);
  } else if (timeline) {
    timeline.style.width = '100%';
  }
})();