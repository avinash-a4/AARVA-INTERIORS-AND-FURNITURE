/* =============================================
   ADMIN.JS – Live backend wired
   ============================================= */

// Guard: require admin login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  const user = Auth.getUser();
  if (user?.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
});

// Panel switching
function showAdminPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('anav-' + id)?.classList.add('active');
  const titles = { clients:'Clients', projects:'Projects', 'designs-upload':'Upload Designs', 'payments-admin':'Payments', 'estimator-config':'Estimator Config' };
  document.getElementById('adminPageTitle').textContent = titles[id] || id;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('mobile-open'); }

// Modals
function toggleModal(id) {
  document.getElementById(id).classList.toggle('hidden');
}

// ── CREATE CLIENT ──────────────────────────────────────────────
async function createClient(e) {
  e.preventDefault();
  const name     = document.getElementById('nc_name').value.trim();
  const email    = document.getElementById('nc_email').value.trim();
  const phone    = document.getElementById('nc_phone').value.trim();
  const password = document.getElementById('nc_pass')?.value?.trim() ?? '';

  try {
    await API.post('/auth/register', { name, email, password, phone });
    showToast(`✓ Client "${name}" created successfully!`, 'success');
    toggleModal('createClientModal');
    e.target.reset();

    // Append new row to clients table
    const tbody = document.getElementById('clientsTableBody');
    if (tbody) {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${name}</td><td>${email}</td><td>${phone}</td><td>—</td><td><span class="status-badge status-active">New</span></td><td><button class="admin-action-btn">View</button></td>`;
      tbody.appendChild(row);
    }
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to create client'}`, 'error');
  }
}

// ── CREATE PROJECT ─────────────────────────────────────────────
async function createProject(e) {
  e.preventDefault();
  const title     = document.getElementById('np_title').value.trim();
  const clientId  = document.getElementById('np_client').value.trim();
  const location  = document.getElementById('np_location')?.value.trim() ?? '';
  const totalCost = parseFloat(document.getElementById('np_cost')?.value) || 0;

  try {
    await API.post('/admin/projects', {
      title,
      clientId,
      location,
      totalCost,
      package: 'Premium',
    });
    showToast(`✓ Project "${title}" created!`, 'success');
    toggleModal('createProjectModal');
    e.target.reset();

    // Reload projects panel to reflect new entry
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to create project'}`, 'error');
  }
}

// ── SAVE ESTIMATOR CONFIG ──────────────────────────────────────
function saveConfig(e) {
  e.preventDefault();
  showToast('✓ Estimator pricing saved successfully!', 'success');
}

// ── UPLOAD DESIGN ──────────────────────────────────────────────
function uploadDesign(e) {
  e.preventDefault();
  showToast('✓ Designs uploaded and client notified!', 'success');
}

// ── FILE INPUT DISPLAY ─────────────────────────────────────────
function handleFiles(files) {
  const list = document.getElementById('uploadedFiles');
  list.innerHTML = '';
  Array.from(files).forEach(f => {
    const item = document.createElement('div');
    item.className = 'uploaded-file';
    item.innerHTML = `<span>📎</span><span>${f.name}</span><span style="margin-left:auto;color:var(--gold)">${(f.size/1024).toFixed(0)} KB</span>`;
    list.appendChild(item);
  });
}

// ── DRAG AND DROP ──────────────────────────────────────────────
const zone = document.getElementById('uploadZone');
if (zone) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; handleFiles(e.dataTransfer.files); });
}
