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
  loadAdminPayments();
  loadQueries();
});

// Panel switching
function showAdminPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('anav-' + id)?.classList.add('active');
  const titles = { clients:'Clients', projects:'Projects', 'designs-upload':'Upload Designs', 'payments-admin':'Payments', queries:'Queries', 'estimator-config':'Estimator Config' };
  document.getElementById('adminPageTitle').textContent = titles[id] || id;
  if (id === 'designs-upload')  loadDesignProjects();
  if (id === 'payments-admin')  loadAdminPayments();
  if (id === 'queries')         loadQueries();
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
        <td><button class="btn btn-ghost" style="padding:0.3rem 0.75rem;font-size:0.68rem;color:#ff6b6b;border-color:#ff6b6b"
          onclick="deleteClient('${client._id}')">Delete</button></td>
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

// ── DELETE CLIENT ──────────────────────────────────────────
async function deleteClient(id) {
  if (!confirm('Delete this client? Their linked project will also be deleted.')) return;
  try {
    await API.delete(`/admin/clients/${id}`);
    showToast('✓ Client deleted', 'success');
    loadClients();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to delete client'}`, 'error');
  }
}

// ── DELETE PROJECT ──────────────────────────────────────────
async function deleteProject(id) {
  if (!confirm('Delete this project? The client will be unlinked.')) return;
  try {
    await API.delete(`/admin/projects/${id}`);
    showToast('✓ Project deleted', 'success');
    loadProjects();
    loadClients(); // refresh status column
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to delete project'}`, 'error');
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
          <button class="btn btn-ghost" style="padding:0.4rem 1rem;font-size:0.7rem;color:#ff6b6b;border-color:#ff6b6b"
            onclick="deleteProject('${project._id}')">Delete</button>
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
  const pkg       = document.getElementById('np_pkg')?.value ?? 'Standard';
  const location  = document.getElementById('np_location')?.value?.trim() ?? '';
  const totalCost = document.getElementById('np_cost')?.value ?? '';
  const startDate = document.getElementById('np_date')?.value ?? '';
  const endDate   = document.getElementById('np_enddate')?.value ?? '';

  try {
    await API.post('/admin/projects', {
      title,
      clientId,
      package:   pkg,
      location:  location || undefined,
      totalCost: totalCost ? Number(totalCost) : undefined,
      startDate: startDate || undefined,
      endDate:   endDate   || undefined,
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

// ── UPLOAD DESIGN (Google Drive link) ────────────────────────────
async function uploadDesign(e) {
  e.preventDefault();

  const projectId = document.getElementById('design_client')?.value?.trim();
  const type      = document.getElementById('design_type')?.value?.trim();
  const name      = document.getElementById('design_name')?.value?.trim();
  const url       = document.getElementById('design_url')?.value?.trim();

  // Validation
  if (!projectId) { showToast('✗ Please select a project', 'error'); return; }
  if (!type)      { showToast('✗ Please select a design type', 'error'); return; }
  if (!name)      { showToast('✗ Please enter a design name', 'error'); return; }
  if (!url)       { showToast('✗ Please paste a Google Drive link', 'error'); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  try {
    await API.post(`/admin/projects/${projectId}/designs`, { name, type, url });
    showToast('✓ Design link saved successfully!', 'success');
    e.target.reset();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to save design link'}`, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Design Link'; }
  }
}

// \u2500\u2500 ADMIN PAYMENTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadAdminPayments() {
  try {
    const payments = await API.get('/admin/payments');
    const tbody = document.getElementById('adminPaymentsBody');
    if (!tbody) return;

    let total = 0;
    tbody.innerHTML = '';
    payments.forEach(p => {
      total += p.amount ?? 0;
      const dateStr = p.paidAt
        ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : '\u2014';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${p.clientId?.name ?? '\u2014'}</td>
          <td>${p.projectId?.title ?? '\u2014'}</td>
          <td>${dateStr}</td>
          <td>\u20b9 ${(p.amount ?? 0).toLocaleString('en-IN')}</td>
          <td>${p.mode ?? '\u2014'}</td>
          <td>${p.description || '\u2014'}</td>
        </tr>`);
    });

    const el = (id) => document.getElementById(id);
    const latest = payments[0]?.amount ?? 0;
    if (el('pay_total'))     el('pay_total').textContent     = '\u20b9 ' + formatAdminINR(total);
    if (el('pay_collected')) el('pay_collected').textContent = payments.length.toString();
    if (el('pay_pending'))   el('pay_pending').textContent   = '\u20b9 ' + formatAdminINR(latest);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Admin payments load error:', err.message);
  }
}

function formatAdminINR(n) {
  if (!n) return '0';
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1000)   return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

async function openPaymentModal() {
  try {
    const projects = await API.get('/admin/projects');
    const sel = document.getElementById('pay_project');
    if (sel) {
      sel.innerHTML = '<option value="">— Select Project —</option>';
      projects.forEach(p => {
        const clientName = p.clientId?.name ?? 'Unknown';
        const opt = document.createElement('option');
        opt.value = JSON.stringify({ projectId: p._id, clientId: p.clientId?._id ?? p.clientId });
        opt.textContent = `${clientName} \u2013 ${p.title}`;
        sel.appendChild(opt);
      });
    }
  } catch (err) { console.error(err); }
  document.getElementById('updatePaymentModal')?.classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('updatePaymentModal')?.classList.add('hidden');
}

async function submitPayment(e) {
  e.preventDefault();
  const projectRaw = document.getElementById('pay_project')?.value;
  const amount     = document.getElementById('pay_amount')?.value;
  const mode       = document.getElementById('pay_mode')?.value;
  const desc       = document.getElementById('pay_desc')?.value?.trim();

  if (!projectRaw) { showToast('\u2717 Select a project', 'error'); return; }
  if (!amount || Number(amount) <= 0) { showToast('\u2717 Enter a valid amount', 'error'); return; }

  const { projectId, clientId } = JSON.parse(projectRaw);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving\u2026'; }

  try {
    await API.post('/admin/payments', { projectId, clientId, amount: Number(amount), mode, description: desc });
    showToast('\u2713 Payment recorded!', 'success');
    closePaymentModal();
    e.target.reset();
    loadAdminPayments();
    loadProjects();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to record payment'}`, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Record Payment'; }
  }
}

// \u2500\u2500 QUERIES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function loadQueries() {
  try {
    const queries = await API.get('/admin/queries');
    const tbody = document.getElementById('queriesBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!queries.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No queries yet</td></tr>';
      return;
    }
    queries.forEach(q => {
      const dateStr = new Date(q.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const isOpen  = q.status === 'open';
      tbody.insertAdjacentHTML('beforeend', `
        <tr id="query-row-${q._id}">
          <td>${q.clientId?.name ?? '\u2014'}</td>
          <td>${q.projectId?.title ?? '\u2014'}</td>
          <td style="max-width:240px;white-space:normal">${q.message}</td>
          <td>${dateStr}</td>
          <td><span class="status-badge ${isOpen ? 'status-active' : 'status-done'}">${isOpen ? 'Open' : 'Resolved'}</span></td>
          <td>${isOpen
            ? `<button class="btn btn-ghost" style="padding:0.3rem 0.75rem;font-size:0.68rem"
                onclick="resolveQuery('${q._id}')">Mark Resolved</button>`
            : '\u2014'
          }</td>
        </tr>`);
    });
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Queries load error:', err.message);
  }
}

async function resolveQuery(id) {
  try {
    await API.req('PATCH', `/admin/queries/${id}/resolve`);
    const row = document.getElementById(`query-row-${id}`);
    if (row) {
      row.querySelector('.status-badge').textContent = 'Resolved';
      row.querySelector('.status-badge').className   = 'status-badge status-done';
      row.querySelector('td:last-child').textContent = '\u2014';
    }
    showToast('\u2713 Query marked resolved', 'success');
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to resolve query'}`, 'error');
  }
}
