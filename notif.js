/**
 * ══════════════════════════════════════════════════════
 *  Seira — Notifications SSE (temps réel admin)
 *  À inclure dans admin.html
 *
 *  Usage :
 *    <script src="admin_notifications.js"></script>
 *    Puis appeler : initSSENotifications(adminKey)
 * ══════════════════════════════════════════════════════
 */

// ─── Configuration ────────────────────────────────────
const SSE_URL    = '/api/db.php';   // 👉 adapter selon votre setup Apache
const RECONNECT_DELAY = 3000;       // ms avant reconnexion automatique

// ─── État global ──────────────────────────────────────
let _sseSource   = null;
let _lastId      = 0;
let _adminKey    = '';
let _reconnectTimer = null;

// ─── Sons de notification (optionnel) ─────────────────
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch(e) { /* audio non disponible */ }
}

// ─── Affichage toast notification ─────────────────────
function showOrderToast(data) {
  const payload = data.payload || {};

  // Conteneur toast (créé une seule fois)
  let container = document.getElementById('notif-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notif-container';
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: flex; flex-direction: column; gap: 10px;
      z-index: 99999; max-width: 340px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const isNew    = data.type === 'nouvelle_commande';
  const bgColor  = isNew ? '#e78a7b' : '#5a7a55';
  const icon     = isNew ? '🛍️' : '📦';
  const title    = isNew ? 'Nouvelle commande !' : 'Statut modifié';
  const subtitle = isNew
    ? `${payload.client || '—'} · ${payload.ville || '—'} · ${payload.total || 0} MAD`
    : `Commande #${payload.order_id} → ${payload.statut || '—'}`;

  toast.style.cssText = `
    background: ${bgColor};
    color: #fff;
    padding: 14px 18px;
    border-radius: 14px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.18);
    font-family: 'Poppins', sans-serif;
    animation: slideIn .3s cubic-bezier(.175,.885,.32,1.275) both;
    cursor: pointer;
  `;

  toast.innerHTML = `
    <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${icon} ${title}</div>
    <div style="font-size:0.82rem;opacity:0.9">${subtitle}</div>
    ${isNew ? `<div style="font-size:0.78rem;opacity:0.7;margin-top:4px">Commande #${payload.order_id}</div>` : ''}
  `;

  // Clic → aller à la commande dans l'admin
  toast.addEventListener('click', () => {
    if (payload.order_id) {
      const row = document.querySelector(`[data-order-id="${payload.order_id}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    toast.remove();
  });

  // Auto-suppression après 7s
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 7000);

  // Style animation (injecté une seule fois)
  if (!document.getElementById('notif-styles')) {
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(120%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Mise à jour du badge "nouvelles commandes" ────────
function updateNewOrdersBadge(delta = 1) {
  let badge = document.getElementById('new-orders-badge');
  if (!badge) {
    // Créer le badge s'il n'existe pas encore
    badge = document.createElement('span');
    badge.id = 'new-orders-badge';
    badge.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 22px; height: 22px; border-radius: 999px;
      background: #e78a7b; color: #fff;
      font-size: 0.75rem; font-weight: 700; padding: 0 6px;
      margin-left: 8px;
    `;
    const title = document.querySelector('h1, .admin-title');
    if (title) title.appendChild(badge);
  }
  const current = parseInt(badge.textContent) || 0;
  badge.textContent = current + delta;
}

// ─── Connexion SSE ─────────────────────────────────────
function connectSSE() {
  if (_sseSource) {
    _sseSource.close();
    _sseSource = null;
  }

  const url = `${SSE_URL}?action=notifications&admin_key=${encodeURIComponent(_adminKey)}&last_id=${_lastId}`;

  _sseSource = new EventSource(url);

  // Connexion établie
  _sseSource.addEventListener('connected', () => {
    console.log('✅ SSE connecté');
    const statusEl = document.getElementById('sse-status');
    if (statusEl) {
      statusEl.textContent = '🟢 Notifications actives';
      statusEl.style.color = '#5a7a55';
    }
  });

  // Nouvelle commande
  _sseSource.addEventListener('nouvelle_commande', (e) => {
    const data = JSON.parse(e.data);
    _lastId = Math.max(_lastId, data.id || 0);
    playNotifSound();
    showOrderToast(data);
    updateNewOrdersBadge(1);
    // Recharger la liste des commandes si la fonction existe
    if (typeof window.refreshOrdersList === 'function') {
      window.refreshOrdersList();
    }
    console.log('🛍️ Nouvelle commande :', data.payload);
  });

  // Statut modifié
  _sseSource.addEventListener('statut_modifie', (e) => {
    const data = JSON.parse(e.data);
    _lastId = Math.max(_lastId, data.id || 0);
    showOrderToast(data);
    if (typeof window.refreshOrdersList === 'function') {
      window.refreshOrdersList();
    }
    console.log('📦 Statut modifié :', data.payload);
  });

  // Reconnexion demandée par le serveur (fin du stream SSE)
  _sseSource.addEventListener('reconnect', (e) => {
    const d = JSON.parse(e.data);
    _lastId = Math.max(_lastId, d.last_id || 0);
    _sseSource.close();
    _reconnectTimer = setTimeout(connectSSE, 500);
  });

  // Erreur → reconnexion automatique
  _sseSource.onerror = () => {
    console.warn('⚠️ SSE déconnecté, reconnexion dans', RECONNECT_DELAY, 'ms…');
    const statusEl = document.getElementById('sse-status');
    if (statusEl) {
      statusEl.textContent = '🟡 Reconnexion…';
      statusEl.style.color = '#b8860b';
    }
    _sseSource.close();
    clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(connectSSE, RECONNECT_DELAY);
  };
}

// ─── API publique ──────────────────────────────────────

/**
 * Initialiser le système de notifications SSE
 * @param {string} adminKey - Clé admin (ADMIN_SECRET dans db.php)
 * @param {number} [lastId=0] - ID notification de départ (0 = depuis maintenant)
 */
function initSSENotifications(adminKey, lastId = 0) {
  if (!adminKey) {
    console.error('initSSENotifications : adminKey requis');
    return;
  }
  if (!window.EventSource) {
    console.warn('⚠️ EventSource non supporté — pas de notifications temps réel');
    return;
  }
  _adminKey = adminKey;
  _lastId   = lastId;
  connectSSE();
}

/**
 * Arrêter les notifications SSE
 */
function stopSSENotifications() {
  if (_sseSource) _sseSource.close();
  clearTimeout(_reconnectTimer);
}

// Nettoyage à la fermeture de la page
window.addEventListener('beforeunload', stopSSENotifications);