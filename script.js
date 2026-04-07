// ─── State ────────────────────────────────────────────────────────────────────
let cart      = JSON.parse(localStorage.getItem('cart'))      || [];
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
// Stored products added by admin (persisted in localStorage)
let storedProducts = JSON.parse(localStorage.getItem('seiraProducts')) || [];

function saveStoredProducts() {
  localStorage.setItem('seiraProducts', JSON.stringify(storedProducts));
}

function addStoredProduct(obj) {
  storedProducts.push(obj);
  saveStoredProducts();
}

function deleteStoredProduct(id) {
  const idx = storedProducts.findIndex(p => p.id === id);
  if (idx !== -1) {
    storedProducts.splice(idx, 1);
    saveStoredProducts();
  }
}

function loadStoredProducts() {
  storedProducts.forEach(p => addProductToDOM(p));
}

function updateAdminControls() {
  const isAdmin = getCurrentUser() && getCurrentUser().role === 'admin' && getCurrentUser().username === getAdminUsername();
  document.querySelectorAll('.delete-prod-btn').forEach(btn => {
    btn.style.display = isAdmin ? 'inline-block' : 'none';
  });
}

// ─── Admin credentials source
// By default credentials are read from window.SECURITY_CONFIG (loaded from security/config.js)
// A runtime override for the admin password is kept in localStorage under 'seiraAdminPassword'.
// WARNING: This is only for local/demo use. Storing secrets client-side is not secure.
function getAdminUsername() {
  if (window.SECURITY_CONFIG && window.SECURITY_CONFIG.ADMIN_USERNAME) return String(window.SECURITY_CONFIG.ADMIN_USERNAME);
  return 'admin';
}

function getAdminPassword() {
  // prefer runtime override in localStorage so admin can change password without editing files
  const override = localStorage.getItem('seiraAdminPassword');
  if (override) return String(override);
  if (window.SECURITY_CONFIG && window.SECURITY_CONFIG.ADMIN_PASSWORD) return String(window.SECURITY_CONFIG.ADMIN_PASSWORD);
  return 'adminpass';
}

function updateAdminPassword(newPass) {
  if (!newPass) return;
  localStorage.setItem('seiraAdminPassword', String(newPass));
}

function createEnvContent(username, password) {
  return `# Seira security env\nADMIN_USERNAME=${username}\nADMIN_PASSWORD=${password}\n`;
}

function downloadEnvFile(content, filename = 'seira.env') {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadges();
}

function saveFavorites() {
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

// ─── Toast notification ───────────────────────────────────────────────────────
function showToast(message) {
  let toast = document.getElementById('seira-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'seira-toast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: #3b2f2f; color: #fff; padding: 10px 22px; border-radius: 999px;
      font-family: 'Poppins', sans-serif; font-size: 0.88rem; font-weight: 500;
      box-shadow: 0 8px 24px rgba(0,0,0,0.14); opacity: 0;
      transition: opacity .24s ease, transform .24s ease; z-index: 9999; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  // show
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 2200);
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
function addToCart(name, price) {
  const existing = cart.find(c => c.name === name);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({ name, price: Number(price) || 0, qty: 1 });
  }
  saveCart();
  showToast(`✓ ${name} ajouté au panier`);

  // bounce the button
  const btn = document.querySelector(`.cart-btn[data-name="${CSS.escape(name)}"]`);
  if (btn) {
    btn.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
      { duration: 280, easing: 'ease-out' }
    );
  }
}

function removeFromCart(index) {
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  }
}

function changeQty(index, delta) {
  if (index >= 0 && index < cart.length) {
    cart[index].qty = (cart[index].qty || 1) + delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    saveCart();
    renderCart();
  }
}

// ─── Cart badge (navbar) ───────────────────────────────────────────────────────
function updateCartBadges() {
  const total = cart.reduce((s, it) => s + (it.qty || 1), 0);
  document.querySelectorAll('.cart-badge').forEach(el => {
    el.textContent = total;
    el.style.display = total > 0 ? 'inline-block' : 'none';
  });
}

// ─── Favorites ────────────────────────────────────────────────────────────────
function isFavorited(name) {
  return favorites.some(f => f.name === name);
}

function addFavorite(name, price) {
  if (!isFavorited(name)) {
    favorites.push({ name, price: price ? Number(price) : null });
    saveFavorites();
    updateFavCount();
    showToast(`♡ ${name} ajouté aux favoris`);
  }
}

function removeFavorite(name) {
  favorites = favorites.filter(f => f.name !== name);
  saveFavorites();
  updateFavCount();
}

function toggleFavorite(name, price, btn) {
  if (isFavorited(name)) {
    removeFavorite(name);
    if (btn) btn.classList.remove('active');
  } else {
    addFavorite(name, price);
    if (btn) btn.classList.add('active');
  }
}

function updateFavCount() {
  document.querySelectorAll('.fav-count').forEach(el => {
    el.textContent = favorites.length;
  });
}

function updateFavoriteButtons() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const name = btn.getAttribute('data-name');
    btn.classList.toggle('active', isFavorited(name));
  });
}

// ─── Render: Cart page ────────────────────────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-items');
  const totalEl   = document.getElementById('total');
  if (!container) return;

  container.innerHTML = '';

  if (!cart.length) {
    container.innerHTML = '<p class="empty">Votre panier est vide.</p>';
    if (totalEl) totalEl.textContent = '';
    return;
  }

  let grandTotal = 0;

  cart.forEach((item, i) => {
    const subtotal = (item.price || 0) * (item.qty || 1);
    grandTotal += subtotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-name">${escapeHTML(item.name)}</div>
        <div class="cart-item-price">${item.price ? item.price + ' MAD' : ''}</div>
      </div>
      <div class="cart-item-right">
        <div class="qty-controls">
          <button class="qty-btn" data-index="${i}" data-delta="-1">−</button>
          <span class="qty">${item.qty || 1}</span>
          <button class="qty-btn" data-index="${i}" data-delta="1">+</button>
        </div>
        <div class="cart-subtotal">${subtotal} MAD</div>
        <button class="remove-btn" data-index="${i}" aria-label="Retirer ${escapeHTML(item.name)}">Retirer</button>
      </div>
    `;
    container.appendChild(div);
  });

  if (totalEl) totalEl.textContent = 'Total : ' + grandTotal + ' MAD';

  container.querySelectorAll('.qty-btn').forEach(b => {
    b.addEventListener('click', () => {
      changeQty(parseInt(b.dataset.index), parseInt(b.dataset.delta));
    });
  });

  container.querySelectorAll('.remove-btn').forEach(b => {
    b.addEventListener('click', () => removeFromCart(parseInt(b.dataset.index)));
  });
}

// ─── Render: Favorites page ───────────────────────────────────────────────────
function renderFavoritesList() {
  const favList = document.getElementById('favorites-list');
  if (!favList) return;

  favList.innerHTML = '';

  if (!favorites.length) {
    favList.innerHTML = '<p class="empty">Aucun favori pour le moment.</p>';
    return;
  }

  favorites.forEach(f => {
    const div = document.createElement('div');
    div.className = 'fav-item';
    div.innerHTML = `
      <div class="fav-item-info">
        <span class="fav-item-name">${escapeHTML(f.name)}</span>
        ${f.price ? `<span class="fav-item-price">${f.price} MAD</span>` : ''}
      </div>
      <div class="fav-item-actions">
        <button class="cart-btn" data-name="${escapeHTML(f.name)}" data-price="${f.price || 0}"
          onclick="addToCart('${escapeJS(f.name)}', ${f.price || 0})">
          Ajouter au panier
        </button>
        <button class="remove-fav remove-btn" data-name="${escapeHTML(f.name)}">Retirer</button>
      </div>
    `;
    favList.appendChild(div);
  });

  favList.querySelectorAll('.remove-fav').forEach(b => {
    b.addEventListener('click', () => {
      const name = b.getAttribute('data-name');
      removeFavorite(name);
      b.closest('.fav-item').remove();
      updateFavoriteButtons();
      if (!favorites.length) {
        favList.innerHTML = '<p class="empty">Aucun favori pour le moment.</p>';
      }
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeJS(str) {
  return String(str).replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}

// ─── Simple client-side user/role management (admin vs user) ──────────────────
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('seiraUser')) || null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem('seiraUser');
  } else {
    localStorage.setItem('seiraUser', JSON.stringify(user));
  }
  updateNavForUser();
  showAdminAddFormIfAdmin();
}

function updateNavForUser() {
  const user = getCurrentUser();
  const roleSpan = document.getElementById('user-role');
  const loginLink = document.getElementById('login-link');
  if (roleSpan) {
    if (user && user.role === 'admin') {
      // validate stored admin: only allow the configured admin username as admin
      if (user.username === getAdminUsername()) {
        roleSpan.textContent = ' (admin)';
        roleSpan.style.display = 'inline';
        if (loginLink) loginLink.textContent = 'Compte';
      } else {
        // invalid admin stored (someone tampered localStorage) — downgrade to user
        setCurrentUser({ username: user.username, role: 'user' });
        showToast('Permission admin invalide — passage en utilisateur');
      }
    } else if (user) {
      roleSpan.textContent = ` (${user.role})`;
      roleSpan.style.display = 'inline';
      if (loginLink) loginLink.textContent = 'Compte';
    } else {
      roleSpan.textContent = '';
      roleSpan.style.display = 'none';
      if (loginLink) loginLink.textContent = 'Connexion';
    }
  }
  // ensure admin controls (delete buttons) reflect current role
  updateAdminControls();
}

function createLoginPanel() {
  if (document.getElementById('login-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'login-panel';
  panel.innerHTML = `
    <form id="login-form" class="login-form">
      <label>Nom d'utilisateur<br><input id="login-username" placeholder="ex: saha" /></label>
      <label>Rôle<br>
        <select id="role-select"><option value="user">Utilisateur</option><option value="admin">Admin</option></select>
      </label>
      <label id="password-label" style="display:none;">Mot de passe admin<br><input id="login-password" type="password" placeholder="mot de passe admin" /></label>
      </label>
      <div class="login-actions">
        <button type="submit" class="btn">Se connecter</button>
        <button type="button" id="logout-btn" class="btn" style="display:none;background:#eee;color:#3b2f2f;">Se déconnecter</button>
      </div>
    </form>
  `;
  document.body.appendChild(panel);
  panel.style.display = 'none';

  const form = panel.querySelector('#login-form');
  const logoutBtn = panel.querySelector('#logout-btn');
  const user = getCurrentUser();
  if (logoutBtn) logoutBtn.style.display = user ? 'inline-block' : 'none';

  // show/hide password field when selecting admin
  const roleSelect = panel.querySelector('#role-select');
  const passwordLabel = panel.querySelector('#password-label');
  roleSelect.addEventListener('change', () => {
    if (roleSelect.value === 'admin') {
      passwordLabel.style.display = 'block';
    } else {
      passwordLabel.style.display = 'none';
    }
  });

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = (document.getElementById('login-username').value || '').trim() || 'invité';
    const role = document.getElementById('role-select').value || 'user';
    if (role === 'admin') {
      const pass = (document.getElementById('login-password').value || '');
      // only allow admin if username & password match the configured admin creds
      if (name !== getAdminUsername() || pass !== getAdminPassword()) {
        showToast('Identifiants admin invalides');
        return;
      }
      setCurrentUser({ username: name, role: 'admin' });
      panel.style.display = 'none';
      showToast(`Connecté en tant que ${name} (admin)`);
    } else {
      setCurrentUser({ username: name, role: 'user' });
      panel.style.display = 'none';
      showToast(`Connecté en tant que ${name} (utilisateur)`);
    }
  });

  logoutBtn.addEventListener('click', () => {
    setCurrentUser(null);
    panel.style.display = 'none';
    showToast('Déconnecté');
  });
}

function toggleLoginPanel() {
  createLoginPanel();
  const panel = document.getElementById('login-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  // update logout visibility
  const user = getCurrentUser();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.style.display = user ? 'inline-block' : 'none';
}

function setupLoginLink() {
  const link = document.getElementById('login-link');
  if (!link) return;
  link.addEventListener('click', (ev) => {
    ev.preventDefault();
    toggleLoginPanel();
  });
}

// ─── Admin: show add-product form only when role === 'admin' ────────────────
function showAdminAddFormIfAdmin() {
  const user = getCurrentUser();
  const productsSection = document.querySelector('.products');
  if (!productsSection) return;

  let adminPanel = document.getElementById('admin-add-panel');
  if (user && user.role === 'admin') {
    if (!adminPanel) {
      adminPanel = document.createElement('div');
      adminPanel.id = 'admin-add-panel';
      adminPanel.className = 'admin-add-panel';
      adminPanel.innerHTML = `
        <form id="admin-add-form" class="admin-add-form">
          <h3>Ajouter un produit (admin)</h3>
          <input id="new-name" placeholder="Nom du produit" required />
          <input id="new-price" placeholder="Prix (MAD)" type="number" min="0" required />
          <label style="width:100%;">Importer une image (ou fournir une URL):<br>
            <input id="new-file" type="file" accept="image/*" />
          </label>
          <input id="new-img" placeholder="URL image (optionnel)" />
          <button type="submit" class="btn">Ajouter</button>
        </form>
        <div class="admin-password">
          <h4>Sécurité admin</h4>
          <form id="admin-pass-form" class="admin-pass-form">
            <input id="current-pass" type="password" placeholder="Mot de passe actuel" required />
            <input id="new-pass" type="password" placeholder="Nouveau mot de passe" required />
            <input id="confirm-pass" type="password" placeholder="Confirmer le nouveau mot de passe" required />
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="submit" class="btn">Changer mot de passe</button>
              <button type="button" id="export-env" class="btn" style="background:#eee;color:#3b2f2f;">Exporter .env</button>
            </div>
          </form>
          <p style="font-size:0.85rem;color:#666;margin-top:8px;">Après modification, tu peux exporter un nouveau fichier .env et le sauvegarder dans le dossier <code>security/</code>.</p>
        </div>
      `;
      productsSection.parentNode.insertBefore(adminPanel, productsSection);

      const form = adminPanel.querySelector('#admin-add-form');
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const name = document.getElementById('new-name').value.trim();
        const price = parseFloat(document.getElementById('new-price').value) || 0;
        const fileInput = document.getElementById('new-file');
        const urlInput = document.getElementById('new-img');

        // If a file was selected, read it as DataURL and use it as image source
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
            const product = { id, name, price, img: dataUrl };
            addStoredProduct(product);
            addProductToDOM(product);
            form.reset();
            updateAdminControls();
            showToast(`${name} ajouté`);
          };
          reader.onerror = () => {
            showToast('Erreur lors de la lecture du fichier image');
          };
          reader.readAsDataURL(file);
        } else {
          const img = urlInput.value.trim() || null;
          const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
          const product = { id, name, price, img };
          addStoredProduct(product);
          addProductToDOM(product);
          form.reset();
          updateAdminControls();
          showToast(`${name} ajouté`);
        }
      });

      // password change handling
      const passForm = adminPanel.querySelector('#admin-pass-form');
      const exportBtn = adminPanel.querySelector('#export-env');
      passForm.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const current = document.getElementById('current-pass').value || '';
        const n1 = document.getElementById('new-pass').value || '';
        const n2 = document.getElementById('confirm-pass').value || '';
        if (current !== getAdminPassword()) {
          showToast('Mot de passe actuel incorrect');
          return;
        }
        if (!n1 || n1 !== n2) {
          showToast('Les nouveaux mots de passe ne correspondent pas');
          return;
        }
        updateAdminPassword(n1);
        passForm.reset();
        showToast('Mot de passe admin mis à jour (stocké localement)');
      });

      exportBtn.addEventListener('click', () => {
        const username = getAdminUsername();
        const password = getAdminPassword();
        const content = createEnvContent(username, password);
        downloadEnvFile(content, 'seira.env');
        showToast('.env prêt au téléchargement');
      });
    }
  } else {
    if (adminPanel) adminPanel.remove();
  }
}

function addProductToDOM(prod) {
  const productsSection = document.querySelector('.products');
  if (!productsSection) return;
  const article = document.createElement('article');
  article.className = 'product';
  article.innerHTML = `
    ${prod.img ? `<img src="${escapeHTML(prod.img)}" alt="${escapeHTML(prod.name)}">` : `<div style="width:100%;height:200px;background:#efe7e4;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#8b7a76;">No image</div>`}
    <h3>${escapeHTML(prod.name)}</h3>
    <p class="price">${prod.price} MAD</p>
    <div class="product-actions">
      <button class="cart-btn" data-name="${escapeHTML(prod.name)}" data-price="${prod.price}">Add to cart</button>
      <button class="fav-btn" data-name="${escapeHTML(prod.name)}" data-price="${prod.price}" aria-label="Ajouter ${escapeHTML(prod.name)} aux favoris">♡</button>
      ${prod.id ? `<button class="delete-prod-btn remove-btn" data-id="${escapeHTML(prod.id)}" style="display:none;margin-left:8px;">Supprimer</button>` : ''}
    </div>
  `;
  productsSection.appendChild(article);

  // attach listeners for new buttons
  const cartBtn = article.querySelector('.cart-btn');
  if (cartBtn) cartBtn.addEventListener('click', () => addToCart(cartBtn.getAttribute('data-name'), parseFloat(cartBtn.getAttribute('data-price') || 0)));
  const favBtn = article.querySelector('.fav-btn');
  if (favBtn) favBtn.addEventListener('click', () => toggleFavorite(favBtn.getAttribute('data-name'), favBtn.getAttribute('data-price'), favBtn));
  updateFavoriteButtons();
  // delete button (admin only)
  const delBtn = article.querySelector('.delete-prod-btn');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const id = delBtn.getAttribute('data-id');
      if (id) {
        deleteStoredProduct(id);
      }
      article.remove();
      showToast('Produit supprimé');
    });
  }
  // ensure admin-specific controls reflect current role
  updateAdminControls();
}


// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // init login / admin UI
  setupLoginLink();
  createLoginPanel();
  // load stored products (persisted from previous admin adds)
  loadStoredProducts();
  updateNavForUser();
  showAdminAddFormIfAdmin();

  // Fav buttons
  document.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name  = btn.getAttribute('data-name');
      const price = btn.getAttribute('data-price') || null;
      toggleFavorite(name, price, btn);
    });
  });

  // Cart buttons — also support data-name / data-price attributes as alternative to onclick
  document.querySelectorAll('.cart-btn[data-name]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name  = btn.getAttribute('data-name');
      const price = parseFloat(btn.getAttribute('data-price')) || 0;
      addToCart(name, price);
    });
  });

  updateFavCount();
  updateFavoriteButtons();
  updateCartBadges();
  renderCart();
  renderFavoritesList();
});
