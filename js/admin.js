/* =============================================
   ADMIN.JS
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

// Create Client (demo)
function createClient(e) {
  e.preventDefault();
  const name = document.getElementById('nc_name').value;
  showToast(`✓ Client "${name}" created successfully!`, 'success');
  toggleModal('createClientModal');
  const tbody = document.getElementById('clientsTableBody');
  const row = document.createElement('tr');
  row.innerHTML = `<td>${name}</td><td>${document.getElementById('nc_email').value}</td><td>${document.getElementById('nc_phone').value}</td><td>New Project</td><td><span class="status-badge status-active">New</span></td><td><button class="admin-action-btn">View</button></td>`;
  tbody.appendChild(row);
  e.target.reset();
}

// Create Project (demo)
function createProject(e) {
  e.preventDefault();
  const title = document.getElementById('np_title').value;
  const client = document.getElementById('np_client').value;
  showToast(`✓ Project "${title}" created for ${client}!`, 'success');
  toggleModal('createProjectModal');
  e.target.reset();
}

// Save estimator config (demo)
function saveConfig(e) {
  e.preventDefault();
  showToast('✓ Estimator pricing saved successfully!', 'success');
}

// Upload design (demo)
function uploadDesign(e) {
  e.preventDefault();
  showToast('✓ Designs uploaded and client notified!', 'success');
}

// Handle file input display
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

// Drag and drop
const zone = document.getElementById('uploadZone');
if (zone) {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => { e.preventDefault(); zone.style.borderColor = ''; handleFiles(e.dataTransfer.files); });
}
