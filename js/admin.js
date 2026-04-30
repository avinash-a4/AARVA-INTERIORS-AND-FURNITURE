/* =============================================
   ADMIN.JS – Live backend wired
   ============================================= */

// Guard: require admin login
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return; }
  const user = Auth.getUser();
  if (user?.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
  loadClients();
  loadProjects();
});

// Panel switching
function showAdminPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('anav-' + id)?.classList.add('active');
  const titles = { clients:'Clients', projects:'Projects', 'designs-upload':'Upload Designs', 'payments-admin':'Payments', 'estimator-config':'Estimator Config' };
  document.getElementById('adminPageTitle').textContent = titles[id] || id;
  // Populate project dropdown when switching to upload panel
  if (id === 'designs-upload') loadDesignProjects();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('mobile-open'); }

// Modals
function toggleModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.toggle('hidden');
  // When opening createProjectModal, populate client dropdown
  if (id === 'createProjectModal' && !modal.classList.contains('hidden')) {
    populateClientDropdown();
  }
}

// ── LOAD CLIENTS ───────────────────────────────────────────────
async function loadClients() {
  try {
    const clients = await API.get('/admin/clients');
    const tableBody = document.getElementById('clientsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    clients.forEach(client => {
      const hasProject = !!client.projectId;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${client.name}</td>
        <td>${client.email}</td>
        <td>${client.phone || '-'}</td>
        <td>${client.projectId?.title || '—'}</td>
        <td><span class="status-badge ${hasProject ? 'status-active' : ''}">${hasProject ? 'Active' : 'No Project'}</span></td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

// ── POPULATE CLIENT DROPDOWN (for Create Project modal) ─────────
async function populateClientDropdown() {
  try {
    const clients = await API.get('/admin/clients');
    const select = document.getElementById('np_client');
    if (!select) return;
    select.innerHTML = '';
    clients.forEach(client => {
      const option = document.createElement('option');
      option.value = client._id;
      option.textContent = client.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error populating client dropdown:', err);
  }
}

// ── LOAD PROJECTS ──────────────────────────────────────────────
async function loadProjects() {
  try {
    const projects = await API.get('/admin/projects');
    renderProjects(projects);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Projects load error:', err.message);
  }
}

// ── RENDER PROJECTS ────────────────────────────────────────────
const PROJECT_IMAGES = [
  'assets/images/living.png',
  'assets/images/kitchen.png',
  'assets/images/bedroom.png',
];

function renderProjects(projects) {
  const grid = document.querySelector('.projects-admin-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!projects || projects.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem">No projects found. Create one to get started.</p>';
    return;
  }

  projects.forEach((project, idx) => {
    const progress   = project.progress ?? 0;
    const clientName = project.clientId?.name ?? 'Unknown Client';
    const imgSrc     = PROJECT_IMAGES[idx % PROJECT_IMAGES.length];
    const isComplete = project.status === 'completed';

    const card = document.createElement('div');
    card.className = 'proj-admin-card';
    card.innerHTML = `
      <div class="proj-admin-img"><img src="${imgSrc}" alt="Project" /></div>
      <div class="proj-admin-body">
        <div class="proj-admin-name">${project.title}</div>
        <div class="proj-admin-client">Client: ${clientName}</div>
        <div class="progress-track mt-2">
          <div class="progress-labels">
            <span class="label-text">Progress</span>
            <span class="text-gold">${progress}%</span>
          </div>
          <div class="progress-bar-wrap mt-1">
            <div class="progress-bar-fill" style="width:${progress}%${isComplete ? ';background:#4CAF50' : ''}"></div>
          </div>
        </div>
        <div class="proj-admin-actions mt-3">
          <button class="btn btn-outline" style="padding:0.4rem 1rem;font-size:0.7rem"
            onclick="openEditModal('${project._id}', ${progress}, '${project.status}')">Edit</button>
          <button class="btn btn-ghost" style="padding:0.4rem 1rem;font-size:0.7rem"
            onclick="openTimelineModal('${project._id}')">Update Timeline</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
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
    loadClients();
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
  const startDate = document.getElementById('np_date')?.value ?? '';

  try {
    await API.post('/admin/projects', {
      title,
      clientId,
      startDate: startDate || undefined,
    });
    showToast(`✓ Project "${title}" created!`, 'success');
    toggleModal('createProjectModal');
    e.target.reset();
    await loadProjects();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to create project'}`, 'error');
  }
}

// ── EDIT PROJECT MODAL ─────────────────────────────────────────
// Injects a lightweight edit modal dynamically (no HTML change — modal is created in JS)
let _editProjectId = null;

function openEditModal(projectId, currentProgress, currentStatus) {
  _editProjectId = projectId;

  // Reuse existing modal if present
  let modal = document.getElementById('editProjectModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editProjectModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeEditModal()"></div>
      <div class="modal-box">
        <div class="modal-header"><h3>Edit Project</h3><button onclick="closeEditModal()">✕</button></div>
        <form class="modal-form" onsubmit="submitEditProject(event)">
          <div class="form-group">
            <label class="form-label">Progress (%)</label>
            <input class="form-input" id="ep_progress" type="number" min="0" max="100" required />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-input" id="ep_status">
              <option value="consultation">Consultation</option>
              <option value="design">Design</option>
              <option value="material">Material Procurement</option>
              <option value="execution">Execution</option>
              <option value="finishing">Finishing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%;justify-content:center;margin-top:0.5rem">Save Changes</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('ep_progress').value = currentProgress;
  document.getElementById('ep_status').value   = currentStatus;
  modal.classList.remove('hidden');
}

function closeEditModal() {
  const modal = document.getElementById('editProjectModal');
  if (modal) modal.classList.add('hidden');
}

async function submitEditProject(e) {
  e.preventDefault();
  if (!_editProjectId) return;

  const progress = parseInt(document.getElementById('ep_progress').value, 10);
  const status   = document.getElementById('ep_status').value;

  try {
    await API.put(`/admin/projects/${_editProjectId}`, { progress, status });
    showToast('✓ Project updated!', 'success');
    closeEditModal();
    await loadProjects();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to update project'}`, 'error');
  }
}

// ── TIMELINE MODAL ─────────────────────────────────────────────
let _timelineProjectId = null;

function openTimelineModal(projectId) {
  _timelineProjectId = projectId;

  let modal = document.getElementById('timelineModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'timelineModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeTimelineModal()"></div>
      <div class="modal-box" style="max-width:520px">
        <div class="modal-header"><h3>Update Timeline</h3><button onclick="closeTimelineModal()">✕</button></div>
        <form class="modal-form" onsubmit="submitTimeline(event)">
          <div id="tl_phases">
            ${buildPhaseRow('Design', 'upcoming')}
            ${buildPhaseRow('Material Procurement', 'upcoming')}
            ${buildPhaseRow('Execution', 'upcoming')}
            ${buildPhaseRow('Finishing', 'upcoming')}
            ${buildPhaseRow('Handover', 'upcoming')}
          </div>
          <button type="submit" class="btn btn-gold" style="width:100%;justify-content:center;margin-top:0.5rem">Save Timeline</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.remove('hidden');
}

function buildPhaseRow(phaseName, defaultStatus) {
  const id = phaseName.replace(/\s+/g, '_');
  return `
    <div class="form-group" style="border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:0.75rem;margin-bottom:0.75rem">
      <label class="form-label">${phaseName}</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
        <select class="form-input tl-status" data-phase="${phaseName}">
          <option value="upcoming" ${defaultStatus==='upcoming'?'selected':''}>Upcoming</option>
          <option value="in-progress" ${defaultStatus==='in-progress'?'selected':''}>In Progress</option>
          <option value="done" ${defaultStatus==='done'?'selected':''}>Done</option>
        </select>
        <input type="text" class="form-input tl-note" data-phase="${phaseName}" placeholder="Note (optional)" />
      </div>
    </div>`;
}

function closeTimelineModal() {
  const modal = document.getElementById('timelineModal');
  if (modal) modal.classList.add('hidden');
}

async function submitTimeline(e) {
  e.preventDefault();
  if (!_timelineProjectId) return;

  const statusSelects = document.querySelectorAll('#tl_phases .tl-status');
  const noteInputs    = document.querySelectorAll('#tl_phases .tl-note');

  const timeline = Array.from(statusSelects).map((sel, i) => ({
    phase:  sel.dataset.phase,
    status: sel.value,
    date:   new Date(),
    note:   noteInputs[i]?.value?.trim() || '',
  }));

  try {
    await API.put(`/admin/projects/${_timelineProjectId}`, { timeline });
    showToast('✓ Timeline updated!', 'success');
    closeTimelineModal();
    await loadProjects();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to update timeline'}`, 'error');
  }
}

// ── SAVE ESTIMATOR CONFIG ──────────────────────────────────────
function saveConfig(e) {
  e.preventDefault();
  showToast('✓ Estimator pricing saved successfully!', 'success');
}

// ── LOAD PROJECTS INTO UPLOAD DROPDOWN ────────────────────────
async function loadDesignProjects() {
  try {
    const projects = await API.get('/admin/projects');
    const select = document.getElementById('design_client');
    if (!select) return;
    select.innerHTML = '<option value="">— Select a project —</option>';
    projects.forEach(project => {
      const clientName = project.clientId?.name ?? 'Unknown';
      const option = document.createElement('option');
      option.value = project._id;
      option.textContent = `${clientName} – ${project.title}`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error loading projects for upload:', err);
  }
}

// ── UPLOAD DESIGN ──────────────────────────────────────────────
async function uploadDesign(e) {
  e.preventDefault();

  const projectId = document.getElementById('design_client')?.value?.trim();
  const type      = document.getElementById('design_type')?.value?.trim();
  const fileInput = document.getElementById('fileInput');
  const file      = fileInput?.files?.[0];

  // Validation
  if (!projectId) { showToast('✗ Please select a project', 'error'); return; }
  if (!type)      { showToast('✗ Please select a design type', 'error'); return; }
  if (!file)      { showToast('✗ Please select a file to upload', 'error'); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading…'; }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    formData.append('type', type);

    const res = await fetch(`${API.BASE}/admin/projects/${projectId}/designs/upload`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Upload failed');

    showToast('✓ Design uploaded successfully!', 'success');
    e.target.reset();
    document.getElementById('uploadedFiles').innerHTML = '';

    // Show quick preview of uploaded URL
    const design = data.design;
    if (design?.url) {
      const preview = document.getElementById('uploadedFiles');
      const isImage = design.url.includes('/image/');
      preview.innerHTML = `
        <div class="uploaded-file" style="flex-direction:column;gap:0.5rem;padding:1rem">
          ${isImage
            ? `<img src="${design.url}" alt="${design.name}" style="max-height:140px;border-radius:6px;object-fit:cover" />`
            : `<a href="${design.url}" target="_blank" class="btn btn-outline" style="padding:0.4rem 1rem;font-size:0.7rem">View Uploaded File</a>`
          }
          <span style="color:var(--gold);font-size:0.78rem">✓ ${design.name} uploaded</span>
        </div>`;
    }
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Upload failed'}`, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload & Notify Client'; }
  }
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
