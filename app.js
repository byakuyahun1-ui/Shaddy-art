(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  const publicSite = document.getElementById('publicSite');
  const loginScreen = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  async function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      throw new Error((data && data.error) || 'Request failed');
    }
    return data;
  }

  // ---------- VIEW SWITCHING ----------
  function showPublic() {
    publicSite.classList.remove('hidden');
    loginScreen.classList.remove('active');
    dashboardScreen.classList.remove('active');
    renderGallery();
  }
  function showLogin() {
    publicSite.classList.add('hidden');
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
  }
  function showDashboard() {
    publicSite.classList.add('hidden');
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    renderAdminList();
  }

  document.getElementById('navAdmin').addEventListener('click', async function () {
    try {
      const me = await api('/api/me');
      if (me.loggedIn) showDashboard();
      else showLogin();
    } catch (e) {
      showLogin();
    }
  });
  document.getElementById('backToSite').addEventListener('click', showPublic);

  // ---------- LOGIN ----------
  document.getElementById('loginBtn').addEventListener('click', async function () {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errBox = document.getElementById('loginError');
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      errBox.style.display = 'none';
      showDashboard();
    } catch (e) {
      errBox.textContent = e.message || 'Galat username ya password.';
      errBox.style.display = 'block';
    }
  });
  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
    showPublic();
  });

  // ---------- PUBLIC GALLERY ----------
  async function renderGallery() {
    const grid = document.getElementById('gallery');
    const empty = document.getElementById('emptyState');
    const loading = document.getElementById('loadingState');
    loading.style.display = 'block';
    grid.innerHTML = '';
    empty.style.display = 'none';

    let list = [];
    try {
      list = await api('/api/artworks');
    } catch (e) {
      loading.textContent = 'Artworks load nahi ho payi. Page refresh karein.';
      return;
    }
    loading.style.display = 'none';

    if (list.length === 0) {
      empty.style.display = 'block';
      return;
    }
    list.forEach(function (art) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="img-wrap">' +
        (art.image ? '<img src="' + escapeHtml(art.image) + '" alt="' + escapeHtml(art.name) + '">' : '<div class="placeholder">No image</div>') +
        '</div>' +
        '<div class="meta">' +
        '<div class="title">' + escapeHtml(art.name) + '</div>' +
        '<div class="price">&#8377;' + escapeHtml(String(art.price)) + '</div>' +
        '</div>' +
        (art.sold ? '<div class="sold-tag">SOLD</div>' : '');
      card.addEventListener('click', function () { openDetail(art); });
      grid.appendChild(card);
    });
  }

  // ---------- DETAIL MODAL ----------
  const overlay = document.getElementById('detailOverlay');
  function openDetail(art) {
    document.getElementById('modalImgSide').innerHTML = art.image
      ? '<img src="' + escapeHtml(art.image) + '" alt="' + escapeHtml(art.name) + '">'
      : '<div class="placeholder" style="font-family:sans-serif;color:#8a8377;">No image</div>';
    document.getElementById('modalTitle').textContent = art.name;
    document.getElementById('modalPrice').textContent = '₹' + art.price;
    document.getElementById('modalDesc').textContent = art.description || '';
    const buyBtn = document.getElementById('modalBuyBtn');
    if (art.sold) {
      buyBtn.textContent = 'Sold Out';
      buyBtn.disabled = true;
    } else {
      buyBtn.textContent = 'Buy this artwork';
      buyBtn.disabled = false;
    }
    buyBtn.onclick = function () {
      alert('Payment jald hi enable hoga! Abhi ke liye kripya seedhe contact karein artwork "' + art.name + '" ke liye.');
    };
    overlay.classList.add('active');
  }
  document.getElementById('closeModal').addEventListener('click', function () {
    overlay.classList.remove('active');
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('active');
  });

  // ---------- ADMIN: LIST ----------
  async function renderAdminList() {
    const wrap = document.getElementById('adminList');
    wrap.innerHTML = '<p style="color:#8a8377;font-size:14px;">Loading...</p>';
    let list = [];
    try {
      list = await api('/api/artworks');
    } catch (e) {
      wrap.innerHTML = '<p style="color:var(--rust);font-size:14px;">Load nahi ho paya.</p>';
      return;
    }
    wrap.innerHTML = '';
    if (list.length === 0) {
      wrap.innerHTML = '<p style="color:#8a8377;font-size:14px;">Koi artwork nahi hai. Left side se add karein.</p>';
      return;
    }
    list.forEach(function (art) {
      const row = document.createElement('div');
      row.className = 'admin-item';
      row.innerHTML =
        '<div class="thumb">' + (art.image ? '<img src="' + escapeHtml(art.image) + '">' : 'No img') + '</div>' +
        '<div class="info">' +
        '<div class="t">' + escapeHtml(art.name) + '</div>' +
        '<div class="p">₹' + escapeHtml(String(art.price)) + '</div>' +
        '</div>' +
        '<div class="actions">' +
        '<button class="sold-btn' + (art.sold ? ' active' : '') + '" data-id="' + art.id + '">' + (art.sold ? 'Sold' : 'Mark Sold') + '</button>' +
        '<button class="edit-btn" data-id="' + art.id + '">Edit</button>' +
        '<button class="danger delete-btn" data-id="' + art.id + '">Delete</button>' +
        '</div>';
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('.sold-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = btn.getAttribute('data-id');
        const currentlySold = btn.classList.contains('active');
        try {
          await api('/api/artworks/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sold: !currentlySold }),
          });
          renderAdminList();
        } catch (e) { alert(e.message); }
      });
    });
    wrap.querySelectorAll('.edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const art = list.find(function (a) { return a.id === id; });
        if (art) loadIntoForm(art);
      });
    });
    wrap.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const id = btn.getAttribute('data-id');
        if (!confirm('Kya aap sach mein is artwork ko delete karna chahte hain?')) return;
        try {
          await api('/api/artworks/' + id, { method: 'DELETE' });
          renderAdminList();
        } catch (e) { alert(e.message); }
      });
    });
  }

  // ---------- ADMIN: FORM ----------
  const fName = document.getElementById('fName');
  const fDesc = document.getElementById('fDesc');
  const fPrice = document.getElementById('fPrice');
  const fImageUrl = document.getElementById('fImageUrl');
  const fImageFile = document.getElementById('fImageFile');
  const fSold = document.getElementById('fSold');
  const editId = document.getElementById('editId');
  const formHeading = document.getElementById('formHeading');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const saveBtn = document.getElementById('saveArtBtn');
  const formMsg = document.getElementById('formMsg');

  function loadIntoForm(art) {
    editId.value = art.id;
    fName.value = art.name;
    fDesc.value = art.description || '';
    fPrice.value = art.price;
    fImageUrl.value = '';
    fImageFile.value = '';
    fSold.checked = !!art.sold;
    formHeading.textContent = 'Edit Artwork';
    cancelEditBtn.style.display = 'inline-block';
    formMsg.textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function resetForm() {
    editId.value = '';
    fName.value = '';
    fDesc.value = '';
    fPrice.value = '';
    fImageUrl.value = '';
    fImageFile.value = '';
    fSold.checked = false;
    formHeading.textContent = 'Add New Artwork';
    cancelEditBtn.style.display = 'none';
    formMsg.textContent = '';
  }
  cancelEditBtn.addEventListener('click', resetForm);

  saveBtn.addEventListener('click', async function () {
    const name = fName.value.trim();
    const price = fPrice.value.trim();
    if (!name || !price) {
      formMsg.textContent = 'Kripya Art Name aur Price zaroor bharein.';
      return;
    }
    saveBtn.disabled = true;
    formMsg.textContent = 'Saving...';

    const fd = new FormData();
    fd.append('name', name);
    fd.append('description', fDesc.value.trim());
    fd.append('price', price);
    fd.append('sold', fSold.checked ? 'true' : 'false');
    if (fImageUrl.value.trim()) fd.append('imageUrl', fImageUrl.value.trim());
    if (fImageFile.files[0]) fd.append('image', fImageFile.files[0]);

    try {
      if (editId.value) {
        await api('/api/artworks/' + editId.value, { method: 'PUT', body: fd });
      } else {
        await api('/api/artworks', { method: 'POST', body: fd });
      }
      resetForm();
      renderAdminList();
    } catch (e) {
      formMsg.textContent = e.message || 'Kuch galat ho gaya.';
    } finally {
      saveBtn.disabled = false;
    }
  });

  // ---------- INIT ----------
  showPublic();
})();
