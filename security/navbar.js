/* ══════════════════════════════════════════════════════════════
   navbar.js — logique hamburger / drawer mobile
   Inclure APRÈS le DOM (avant </body>) dans chaque page.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Éléments ──────────────────────────────────────────────── */
  const hamburger = document.getElementById('nav-hamburger');
  const drawer    = document.getElementById('nav-drawer');
  const overlay   = document.getElementById('nav-overlay');
  const closeBtn  = document.getElementById('drawer-close');

  if (!hamburger || !drawer || !overlay) return; // page sans navbar

  /* ── Ouvrir / fermer ───────────────────────────────────────── */
  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  overlay.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  /* Fermer avec Échap */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  /* Fermer si on clique un lien du drawer */
  drawer.querySelectorAll('.drawer-link').forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  /* ── Badge pop animation ────────────────────────────────────── */
  function triggerBadgePop(selector) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.remove('pop');
      void el.offsetWidth; // reflow
      el.classList.add('pop');
    });
  }

  /* ── Masquer badge si valeur = 0 ────────────────────────────── */
  function syncBadgeVisibility() {
    document.querySelectorAll('.nav-badge').forEach(el => {
      const val = parseInt(el.textContent, 10) || 0;
      el.style.display = val === 0 ? 'none' : '';
    });
  }

  /* Observer les changements de texte sur les badges */
  const badgeObserver = new MutationObserver(syncBadgeVisibility);
  document.querySelectorAll('.nav-badge, .fav-count, .cart-badge').forEach(el => {
    badgeObserver.observe(el, { childList: true, characterData: true, subtree: true });
  });

  // Lancer une fois au départ
  syncBadgeVisibility();

})();