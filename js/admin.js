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
  loadCollections();   // pre-load so stats are ready
});

// Panel switching
function showAdminPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('anav-' + id)?.classList.add('active');
  const titles = { clients:'Clients', projects:'Projects', 'designs-upload':'Upload Designs', 'payments-admin':'Payments', collections:'Collections', queries:'Queries', 'estimator-config':'Estimator Config' };
  document.getElementById('adminPageTitle').textContent = titles[id] || id;
  if (id === 'designs-upload')  loadDesignProjects();
  if (id === 'payments-admin')  loadAdminPayments();
  if (id === 'queries')         loadQueries();
  if (id === 'collections')     loadCollections();
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

// ── CLIENT DATA CACHE (safe way to pass objects to onclick) ───
const _clientDataMap = new Map();

// ── LOAD CLIENTS ───────────────────────────────────────────────
async function loadClients() {
  try {
    const clients = await API.get('/admin/clients');
    const tableBody = document.getElementById('clientsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    clients.forEach(client => {
      const hasProject = !!client.projectId;
      _clientDataMap.set(client._id, client); // cache for safe onclick lookup
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${client.name}</td>
        <td>${client.email}</td>
        <td>${client.phone || '-'}</td>
        <td>${client.projectId?.title || '—'}</td>
        <td><span class="status-badge ${hasProject ? 'status-active' : ''}">${hasProject ? 'Active' : 'No Project'}</span></td>
        <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
          <button class="btn btn-outline" style="padding:0.3rem 0.75rem;font-size:0.68rem"
            onclick="openWorkflowCalendarModal(_clientDataMap.get('${client._id}'))">Assign Workflow Calendar</button>
          <button class="btn btn-ghost" style="padding:0.3rem 0.75rem;font-size:0.68rem;color:#ff6b6b;border-color:#ff6b6b"
            onclick="deleteClient('${client._id}')">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading clients:', error);
  }
}

// ── MANUAL WORKFLOW CALENDAR SYSTEM ──────────────────────────────

const WORK_OPTIONS = [
  'Ceiling Work – Framing',
  'Procure Wires',
  'Sheet Fixing',
  'Finishing & Cleaning',
  'Putty Paint',
  'Interior Work Starts',
];

const WORK_COLORS = {
  'Ceiling Work – Framing': { dot: '#C6A969', bg: 'rgba(198,169,105,0.22)', border: '#C6A969' },
  'Procure Wires':          { dot: '#64B4FF', bg: 'rgba(100,180,255,0.18)', border: '#64B4FF' },
  'Sheet Fixing':           { dot: '#9B59B6', bg: 'rgba(155,89,182,0.18)',  border: '#9B59B6' },
  'Finishing & Cleaning':   { dot: '#78C88C', bg: 'rgba(120,200,140,0.18)', border: '#78C88C' },
  'Putty Paint':            { dot: '#FFA050', bg: 'rgba(255,160,80,0.18)',  border: '#FFA050' },
  'Interior Work Starts':   { dot: '#50DCC8', bg: 'rgba(80,220,200,0.18)', border: '#50DCC8' },
};

/** Compute status purely from dates — no cron, no DB field */
function computeWorkflowStatus(startDate, endDate) {
  const today = new Date(); today.setHours(0,0,0,0);
  const s = new Date(startDate); s.setHours(0,0,0,0);
  const e = new Date(endDate);   e.setHours(0,0,0,0);
  if (today < s) return 'Upcoming';
  if (today > e) return 'Completed';
  return 'Active';
}

/** Month-grid calendar that colors date ranges from workflowItems array */
function generateWorkflowCalendar(refDate, workflowItems) {
  const today = new Date(); today.setHours(0,0,0,0);
  const year  = refDate.getFullYear();
  const month = refDate.getMonth();
  const firstDay  = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0);
  const startDow  = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const headerHTML = days.map(d => `<div class="cal-grid-hdr">${d}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell cal-cell--empty"></div>';
  for (let d = 1; d <= totalDays; d++) {
    const cellDate = new Date(year, month, d); cellDate.setHours(0,0,0,0);
    const isToday = cellDate.getTime() === today.getTime();
    const isPast  = cellDate < today;
    let matchItem = null;
    for (const item of workflowItems) {
      const s = new Date(item.startDate); s.setHours(0,0,0,0);
      const e = new Date(item.endDate);   e.setHours(0,0,0,0);
      if (cellDate >= s && cellDate <= e) { matchItem = item; break; }
    }
    const col = matchItem ? (WORK_COLORS[matchItem.workName] || null) : null;
    let dotHTML = '';
    if (matchItem && col) {
      const short = matchItem.workName.split('–')[0].trim();
      dotHTML = `<span class="cal-dot" style="background:${col.dot}"></span><span class="cal-task-label" style="color:${col.dot}">${short}</span>`;
    }
    const todayClass = isToday ? ' cal-cell--today' : '';
    const pastClass  = isPast  ? ' cal-cell--past'  : '';
    const taskClass  = matchItem ? ' cal-cell--task' : '';
    const cellStyle  = (matchItem && col) ? `style="border-color:${col.border};background:${col.bg};"` : '';
    const tooltip    = matchItem
      ? `<div class="cal-tooltip"><strong>${matchItem.workName}</strong><br><span>${computeWorkflowStatus(matchItem.startDate, matchItem.endDate)}</span></div>`
      : '';
    cells += `<div class="cal-cell${todayClass}${pastClass}${taskClass}" ${cellStyle}><span class="cal-num">${d}</span>${isToday ? '<span class="cal-today-badge">Today</span>' : ''}<div class="cal-cell-body">${dotHTML}</div>${tooltip}</div>`;
  }
  return `<div class="cal-grid-wrap"><div class="cal-grid">${headerHTML}${cells}</div></div>`;
}

// ── WORKFLOW MODAL STATE ────────────────────────────────────────
let _workflowProjectId = null;
let _workflowRowCount  = 0;

function _buildWorkOptions(selected) {
  return WORK_OPTIONS.map(o =>
    `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`
  ).join('');
}

function addWorkflowRow(container, preWork = '', preStart = '', preEnd = '') {
  const idx = _workflowRowCount++;
  const row = document.createElement('div');
  row.className = 'wf-row';
  row.innerHTML = `
    <select class="form-input wf-work" id="wf_work_${idx}">
      <option value="">— Select Work —</option>
      ${_buildWorkOptions(preWork)}
    </select>
    <input type="date" class="form-input wf-start" id="wf_start_${idx}" value="${preStart}" />
    <input type="date" class="form-input wf-end"   id="wf_end_${idx}"   value="${preEnd}"   />
    <button type="button" class="wf-add-btn" onclick="addWorkflowRow(document.getElementById('wf_rows_container'))" title="Add row">+</button>`;
  container.appendChild(row);
}

async function openWorkflowCalendarModal(client) {
  if (!client) { showToast('\u2717 Client data not found.', 'error'); return; }
  if (!client.projectId) { showToast('\u2717 No project assigned to this client yet.', 'error'); return; }
  _workflowProjectId = client.projectId._id || client.projectId;
  _workflowRowCount  = 0;

  // Always fetch fresh project data
  let workflowItems = [];
  try {
    const projects = await API.get('/admin/projects');
    const proj = projects.find(p => String(p._id) === String(_workflowProjectId));
    workflowItems = proj?.workflowCalendar || [];
  } catch (err) { console.warn('Workflow fetch error:', err.message); }

  // Pick the month to display: earliest startDate or current month
  let viewDate = new Date();
  if (workflowItems.length > 0) {
    viewDate = workflowItems.reduce((min, item) => {
      const d = new Date(item.startDate);
      return d < min ? d : min;
    }, new Date(workflowItems[0].startDate));
  }

  const monthName = viewDate.toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  const calHTML   = generateWorkflowCalendar(viewDate, workflowItems);

  const legendHTML = Object.entries(WORK_COLORS).map(([name, col]) =>
    `<div class="cal-legend-item"><span class="cal-legend-dot" style="background:${col.dot}"></span>${name}</div>`
  ).join('');

  // Build saved workflow details section
  let detailsHTML = '';
  if (workflowItems.length > 0) {
    const rows = workflowItems.map(item => {
      const status  = computeWorkflowStatus(item.startDate, item.endDate);
      const col     = WORK_COLORS[item.workName];
      const dotSt   = col ? `background:${col.dot}` : 'background:#aaa';
      const stCls   = status === 'Active' ? 'status-active' : status === 'Completed' ? 'status-done' : '';
      const sStr    = new Date(item.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const eStr    = new Date(item.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      const safeName = item.workName.replace(/'/g, "\\'");
      return `<div class="wf-detail-card">
        <div class="wf-detail-left"><span class="wf-detail-dot" style="${dotSt}"></span>
          <div><div class="wf-detail-name">${item.workName}</div><div class="wf-detail-date">${sStr} \u2192 ${eStr}</div></div></div>
        <div class="wf-detail-right">
          <span class="status-badge ${stCls}">${status}</span>
          <button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.65rem"
            onclick="openEditWorkflowItem('${_workflowProjectId}','${item._id}','${safeName}','${new Date(item.startDate).toISOString().split('T')[0]}','${new Date(item.endDate).toISOString().split('T')[0]}')">Edit</button>
        </div></div>`;
    }).join('');
    detailsHTML = `<div class="wf-section-title" style="margin-top:1.5rem">Saved Workflow</div><div class="wf-details-list">${rows}</div>`;
  }

  document.getElementById('workflowCalendarModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'workflowCalendarModal';
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('workflowCalendarModal').remove()"></div>
    <div class="wf-modal-box">
      <div class="cal-modal-header">
        <div class="cal-modal-title"><h3>${client.name || 'Client'}</h3><span class="cal-modal-sub">Workflow Calendar</span></div>
        <button class="cal-close-btn" onclick="document.getElementById('workflowCalendarModal').remove()">\u2715</button>
      </div>
      <div class="wf-section-title">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${monthName}
      </div>
      <div id="wf_admin_calendar">${calHTML}</div>
      <div class="cal-legend" style="margin:0.5rem 1.25rem 1rem">${legendHTML}</div>
      <div class="wf-section-title" style="margin-top:1.25rem">Assign Workflow Tasks</div>
      <div class="wf-builder-hdr"><span>Work Type</span><span>Start Date</span><span>End Date</span><span></span></div>
      <div id="wf_rows_container" class="wf-rows-container"></div>
      <button type="button" class="wf-add-first-btn" onclick="addWorkflowRow(document.getElementById('wf_rows_container'))">+ Add Work Row</button>
      ${detailsHTML}
      <div class="wf-modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('workflowCalendarModal').remove()">Cancel</button>
        <button class="btn btn-gold" id="wf_save_btn" onclick="saveWorkflow('${_workflowProjectId}')">Update Workflow</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const container = document.getElementById('wf_rows_container');
  if (workflowItems.length > 0) {
    workflowItems.forEach(item => {
      const s = new Date(item.startDate).toISOString().split('T')[0];
      const e = new Date(item.endDate).toISOString().split('T')[0];
      addWorkflowRow(container, item.workName, s, e);
    });
  } else {
    addWorkflowRow(container); // start with one empty row
  }
}

async function saveWorkflow(projectId) {
  const container = document.getElementById('wf_rows_container');
  if (!container) return;
  const rows = container.querySelectorAll('.wf-row');
  const workflowCalendar = [];
  let hasPartial = false;
  rows.forEach(row => {
    const work  = row.querySelector('.wf-work')?.value;
    const start = row.querySelector('.wf-start')?.value;
    const end   = row.querySelector('.wf-end')?.value;
    if (work && start && end) {
      workflowCalendar.push({ workName: work, startDate: start, endDate: end });
    } else if (work || start || end) {
      hasPartial = true;
    }
  });
  if (hasPartial) { showToast('\u2717 Please complete all fields in each row.', 'error'); return; }
  if (workflowCalendar.length === 0) { showToast('\u2717 Add at least one workflow task.', 'error'); return; }
  const saveBtn = document.getElementById('wf_save_btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026'; }
  try {
    await API.post(`/admin/projects/${projectId}/workflow`, { workflowCalendar });
    showToast('\u2713 Workflow saved successfully!', 'success');
    document.getElementById('workflowCalendarModal')?.remove();
    loadClients();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to save workflow'}`, 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Update Workflow'; }
  }
}

function openEditWorkflowItem(projectId, itemId, workName, startDate, endDate) {
  document.getElementById('editWorkflowModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'editWorkflowModal';
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('editWorkflowModal').remove()"></div>
    <div class="modal-box" style="max-width:480px">
      <div class="modal-header"><h3>Edit Workflow Item</h3><button onclick="document.getElementById('editWorkflowModal').remove()">\u2715</button></div>
      <form class="modal-form" onsubmit="submitEditWorkflow(event,'${projectId}','${itemId}')">
        <div class="form-group"><label class="form-label">Work Type</label>
          <select class="form-input" id="ewf_work">
            <option value="">— Select Work —</option>
            ${_buildWorkOptions(workName)}
          </select></div>
        <div class="form-group"><label class="form-label">Start Date</label>
          <input type="date" class="form-input" id="ewf_start" value="${startDate}" required /></div>
        <div class="form-group"><label class="form-label">End Date</label>
          <input type="date" class="form-input" id="ewf_end" value="${endDate}" required /></div>
        <button type="submit" class="btn btn-gold" style="width:100%;justify-content:center;margin-top:0.5rem">Save Changes</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
}

async function submitEditWorkflow(e, projectId, itemId) {
  e.preventDefault();
  const workName  = document.getElementById('ewf_work')?.value;
  const startDate = document.getElementById('ewf_start')?.value;
  const endDate   = document.getElementById('ewf_end')?.value;
  if (!workName || !startDate || !endDate) { showToast('\u2717 All fields are required.', 'error'); return; }
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving\u2026'; }
  try {
    await API.put(`/admin/projects/${projectId}/workflow/${itemId}`, { workName, startDate, endDate });
    showToast('\u2713 Workflow item updated!', 'success');
    document.getElementById('editWorkflowModal')?.remove();
    // Re-open the main modal with fresh data
    const clients = await API.get('/admin/clients');
    const client  = clients.find(c => c.projectId && (String(c.projectId._id || c.projectId) === String(projectId)));
    if (client) openWorkflowCalendarModal(client);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to update item'}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}

// ── POPULATE CLIENT DROPDOWN (for Create Project modal) ─────────





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

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerText = 'Creating...'; }

  try {
    await API.post('/auth/register', { name, email, password, phone });
    showToast(`\u2713 Client "${name}" created successfully!`, 'success');
    toggleModal('createClientModal');
    e.target.reset();
    loadClients();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to create client'}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Create Client Account'; }
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

    // Stat accumulators — ONLY count payments linked to still-existing projects
    let totalIncome = 0;
    let totalExpenses = 0;
    tbody.innerHTML = '';

    payments.forEach(p => {
      const isIncome  = (p.type || 'income') === 'income';
      const isExpense = p.type === 'expense';

      // ── Live financial cards: only active (non-orphaned) payments count ──────
      // p.projectId is null when the project was deleted (lookup returned nothing)
      const isActive = !!p.projectId;
      if (isActive && isIncome)  totalIncome   += p.amount ?? 0;
      if (isActive && isExpense) totalExpenses += p.amount ?? 0;

      const cat = p.category || 'Other';
      const dateStr = p.paidAt
        ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : '\u2014';
      const clientIdStr = p.clientId?._id ?? p.clientId ?? '';

      // Type badge: green for income, red for expense
      const typeBadge = isExpense
        ? `<span class="status-badge" style="background:rgba(255,107,107,0.15);color:#ff6b6b">Expense</span>`
        : `<span class="status-badge" style="background:rgba(76,175,80,0.15);color:#4CAF50">Income</span>`;

      // ── Name resolution: live name → snapshot → deleted label ────────────────
      const clientName = p.clientId?.name
        || p.clientNameSnapshot
        || '<span style="color:var(--text-muted);font-style:italic">Client Deleted</span>';
      const projectName = p.projectId?.title
        || p.projectTitleSnapshot
        || '<span style="color:var(--text-muted);font-style:italic">Project Deleted</span>';

      // Only wire click-to-history when we have a real clientId
      const rowClick = clientIdStr
        ? `onclick="openPaymentHistory('${clientIdStr}')" style="cursor:pointer" class="hover-row"`
        : `style="opacity:0.75"`;

      tbody.insertAdjacentHTML('beforeend', `
        <tr ${rowClick}>
          <td>${clientName}</td>
          <td>${projectName}</td>
          <td>\u20b9 ${(p.amount ?? 0).toLocaleString('en-IN')}</td>
          <td>${typeBadge}</td>
          <td><span class="status-badge" style="background:rgba(198,169,105,0.1);color:#C6A969">${cat}</span></td>
          <td>${p.mode ?? '\u2014'}</td>
          <td>${dateStr}</td>
        </tr>`);
    });

    const profit = totalIncome - totalExpenses;
    const el = (id) => document.getElementById(id);

    if (el('pay_total')) {
      el('pay_total').textContent = '\u20b9 ' + formatAdminINR(totalIncome);
      if (el('pay_total').nextElementSibling) el('pay_total').nextElementSibling.textContent = 'Total Income';
    }
    if (el('pay_collected')) {
      el('pay_collected').textContent = '\u20b9 ' + formatAdminINR(totalExpenses);
      if (el('pay_collected').nextElementSibling) el('pay_collected').nextElementSibling.textContent = 'Total Expenses';
    }
    if (el('pay_pending')) {
      el('pay_pending').textContent = (profit >= 0 ? '\u20b9 ' : '\u2013\u20b9 ') + formatAdminINR(Math.abs(profit));
      el('pay_pending').style.color = profit >= 0 ? '#4CAF50' : '#ff6b6b';
      if (el('pay_pending').nextElementSibling) el('pay_pending').nextElementSibling.textContent = 'Net Profit';
    }
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
  const type       = document.getElementById('payment_type')?.value || 'income';
  const mode       = document.getElementById('pay_mode')?.value;
  const category   = document.getElementById('payment_category')?.value || 'Other';
  const desc       = document.getElementById('pay_desc')?.value?.trim();

  if (!projectRaw) { showToast('\u2717 Select a project', 'error'); return; }
  if (!amount || Number(amount) <= 0) { showToast('\u2717 Enter a valid amount', 'error'); return; }

  const { projectId, clientId } = JSON.parse(projectRaw);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving\u2026'; }

  try {
    await API.post('/admin/payments', { projectId, clientId, amount: Number(amount), type, mode, category, description: desc });
    const label = type === 'expense' ? 'Expense recorded!' : 'Payment recorded!';
    showToast('\u2713 ' + label, 'success');
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

// ── PAYMENT HISTORY MODAL ──────────────────────────────────────────
let _currentHistoryClientId = null;

async function openPaymentHistory(clientId) {
  if (!clientId || clientId === 'undefined') return;
  _currentHistoryClientId = clientId;
  try {
    const payments = await API.get(`/admin/payments/client/${clientId}`);
    const tbody = document.getElementById('paymentHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No payment history found.</td></tr>';
    } else {
      payments.forEach(p => {
        const dateStr   = p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '\u2014';
        const cat       = p.category || 'Other';
        const isExpense = p.type === 'expense';
        const typeBadge = isExpense
          ? `<span class="status-badge" style="background:rgba(255,107,107,0.15);color:#ff6b6b">Expense</span>`
          : `<span class="status-badge" style="background:rgba(76,175,80,0.15);color:#4CAF50">Income</span>`;
        const invoiceCell = p.invoiceUrl
          ? `<a href="${_invoiceAbsUrl(p.invoiceUrl)}" target="_blank" rel="noopener noreferrer"><button class="btn btn-ghost" style="padding:0.2rem 0.55rem;font-size:0.65rem;color:#C6A969;border-color:#C6A969;white-space:nowrap">&#11011; Download</button></a>`
          : `<button class="btn btn-ghost" style="padding:0.2rem 0.55rem;font-size:0.65rem;white-space:nowrap" onclick="generateInvoice('${p._id}', this)">Generate Invoice</button>`;
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${dateStr}</td>
            <td>\u20b9 ${(p.amount ?? 0).toLocaleString('en-IN')}</td>
            <td>${typeBadge}</td>
            <td><span class="status-badge" style="background:rgba(198,169,105,0.1);color:#C6A969">${cat}</span></td>
            <td>${p.mode ?? '\u2014'}</td>
            <td>${p.description || '\u2014'}</td>
            <td style="white-space:nowrap">${invoiceCell}</td>
          </tr>
        `);
      });
    }
    
    document.getElementById('paymentHistoryModal')?.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load payment history:', err);
    showToast('\u2717 Failed to load payment history', 'error');
  }
}

function closePaymentHistory() {
  document.getElementById('paymentHistoryModal')?.classList.add('hidden');
}

// ── GENERATE INVOICE ─────────────────────────────────────────────
// invoiceUrl is a relative path (/uploads/invoices/filename.pdf).
// We prefix it with the backend origin (API.BASE without /api) for download.
function _invoiceAbsUrl(relUrl) {
  if (!relUrl) return '';
  if (relUrl.startsWith('http')) return relUrl; // already absolute (old Cloudinary URLs)
  const backendOrigin = API.BASE.replace(/\/api$/, '');
  return backendOrigin + relUrl;
}

async function generateInvoice(paymentId, btn) {
  const originalText = btn.textContent.trim();
  btn.disabled = true;
  btn.textContent = 'Generating\u2026';
  try {
    const result = await API.post(`/admin/payments/${paymentId}/invoice`, {});
    showToast(`\u2713 Invoice ${result.invoiceNumber} ready!`, 'success');

    const absUrl = _invoiceAbsUrl(result.invoiceUrl);

    // Open PDF in new tab — cross-origin download attribute is blocked by browsers
    const a = document.createElement('a');
    a.href   = absUrl;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);


    // Swap button to Download state in-place
    const td = btn.closest('td');
    if (td) {
      td.innerHTML = `<a href="${absUrl}" target="_blank" rel="noopener noreferrer"><button class="btn btn-ghost" style="padding:0.2rem 0.55rem;font-size:0.65rem;color:#C6A969;border-color:#C6A969;white-space:nowrap">&#11011; Download</button></a>`;
    }
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to generate invoice'}`, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function generateLedgerInvoice() {
  if (!_currentHistoryClientId) {
    showToast('\u2717 No client selected', 'error');
    return;
  }

  // Find the button (assuming it's in the modal footer)
  const btn = document.querySelector('#paymentHistoryModal .btn-gold');
  const originalText = btn ? btn.textContent : 'Generate Full Client Invoice';
  
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generating...';
  }

  try {
    const result = await API.post(`/admin/clients/${_currentHistoryClientId}/ledger-invoice`, {});
    showToast(`\u2713 Ledger ${result.ledgerInvoiceNumber} ready!`, 'success');

    const absUrl = _invoiceAbsUrl(result.ledgerInvoiceUrl);

    // Open PDF in new tab
    const a = document.createElement('a');
    a.href   = absUrl;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);

  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to generate ledger invoice'}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
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

// ── COLLECTION PLAN ENGINE ──────────────────────────────────

let _collectionPlans = [];

async function loadCollections() {
  try {
    _collectionPlans = await API.get('/admin/collection-plans');
    renderCollectionsPanel(_collectionPlans);
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Collections load error:', err.message);
  }
}

function renderCollectionsPanel(plans) {
  // Stats
  let pendingCount = 0, approvedCount = 0;
  plans.forEach(p => p.generatedCollections.forEach(c => {
    if (c.status === 'pendingApproval') pendingCount++;
    if (c.status === 'approved') approvedCount++;
  }));
  const totalEl   = document.getElementById('col_total_plans');
  const pendEl    = document.getElementById('col_pending_count');
  const approvEl  = document.getElementById('col_approved_count');
  if (totalEl)  totalEl.textContent  = plans.filter(p => p.status === 'active').length;
  if (pendEl)   pendEl.textContent   = pendingCount;
  if (approvEl) approvEl.textContent = approvedCount;

  // Pending Approval table
  const pendBody = document.getElementById('col_pending_body');
  const pendRows = [];
  plans.forEach(plan => {
    plan.generatedCollections.forEach(col => {
      if (col.status !== 'pendingApproval') return;
      const cName  = plan.clientId?.name  || col.clientNameSnapshot  || '—';
      const pTitle = plan.projectId?.title || col.projectTitleSnapshot || '—';
      const dateStr = new Date(col.collectionDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const proofHtml = col.proofImage?.url
        ? `<a href="${col.proofImage.url}" target="_blank" class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.65rem">View Proof</a>`
        : '<span style="color:var(--text-muted)">None</span>';
      const typeLabel = plan.type === 'weekly' ? 'Weekly' : `Phase${plan.phaseName ? ': ' + plan.phaseName : ''}`;
      pendRows.push(`<tr>
        <td>${cName}</td><td>${pTitle}</td>
        <td>${dateStr}</td>
        <td class="text-gold">₹ ${col.amount.toLocaleString('en-IN')}</td>
        <td><span class="status-badge">${typeLabel}</span></td>
        <td style="font-size:0.78rem">${col.reason || plan.reason || '—'}</td>
        <td>${proofHtml}</td>
        <td style="text-align:center">${col.attemptCount || 0}</td>
        <td style="display:flex;gap:0.3rem;flex-wrap:wrap">
          <button class="btn btn-gold" style="padding:0.25rem 0.6rem;font-size:0.65rem" onclick="approveCollection('${plan._id}','${col._id}')">Approve</button>
          <button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.65rem;color:#ff6b6b;border-color:#ff6b6b" onclick="rejectCollection('${plan._id}','${col._id}')">Reject</button>
          <button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.65rem" onclick="markNeedProof('${plan._id}','${col._id}')">Need Proof</button>
        </td></tr>`);
    });
  });
  if (pendBody) pendBody.innerHTML = pendRows.length ? pendRows.join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2rem">No collections pending approval</td></tr>';

  // All plans table
  const plansBody = document.getElementById('col_plans_body');
  if (plansBody) {
    plansBody.innerHTML = plans.length ? plans.map(plan => {
      const cName   = plan.clientId?.name  || plan.clientNameSnapshot  || '—';
      const pTitle  = plan.projectId?.title || plan.projectTitleSnapshot || '—';
      const typeLabel = plan.type === 'weekly' ? 'Weekly' : `Phase${plan.phaseName ? ': ' + plan.phaseName : ''}`;
      const sDate   = new Date(plan.startDate).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      const eDate   = new Date(plan.endDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const total   = plan.generatedCollections.length;
      const done    = plan.generatedCollections.filter(c => c.status === 'approved').length;
      const stCls   = plan.status === 'active' ? 'status-active' : 'status-done';
      return `<tr>
        <td>${cName}</td><td>${pTitle}</td>
        <td><span class="status-badge">${typeLabel}</span></td>
        <td class="text-gold">₹ ${(plan.amount||0).toLocaleString('en-IN')}</td>
        <td>${done} / ${total}</td>
        <td style="font-size:0.78rem">${sDate} → ${eDate}</td>
        <td><span class="status-badge ${stCls}">${plan.status}</span></td>
        <td><button class="btn btn-ghost" style="padding:0.25rem 0.6rem;font-size:0.65rem" onclick="expandPlanCollections('${plan._id}')">View</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No collection plans yet</td></tr>';
  }
}

function openCreateCollectionModal() {
  document.getElementById('createCollectionModal')?.remove();
  // Populate client+project dropdown
  const projectOptions = _collectionPlans.length ? '' :  '';
  const allClients = _clientDataMap ? [..._clientDataMap.values()] : [];
  const clientOptions = allClients
    .filter(c => c.projectId)
    .map(c => `<option value="${c.projectId._id || c.projectId}" data-client="${c._id}">${c.name} — ${c.projectId?.title || 'Project'}</option>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'createCollectionModal';
  modal.className = 'admin-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('createCollectionModal').remove()"></div>
    <div class="modal-box" style="max-width:560px;max-height:92vh;overflow-y:auto">
      <div class="modal-header"><h3>Create Collection Plan</h3><button onclick="document.getElementById('createCollectionModal').remove()">✕</button></div>
      <form class="modal-form" onsubmit="submitCreateCollection(event)">
        <div class="form-group"><label class="form-label">Select Client + Project</label>
          <select class="form-input" id="cc_project" required>
            <option value="">— Select Project —</option>
            ${clientOptions || '<option disabled>No clients with projects found</option>'}
          </select></div>
        <div class="form-group"><label class="form-label">Collection Type</label>
          <select class="form-input" id="cc_type" onchange="toggleCollectionTypeFields()">
            <option value="weekly">Weekly Collection</option>
            <option value="phase">Phase Collection</option>
          </select></div>
        <div id="cc_phase_fields" style="display:none">
          <div class="form-group"><label class="form-label">Phase Name</label>
            <input class="form-input" id="cc_phase_name" placeholder="e.g. Ceiling Work" /></div>
          <div class="form-group"><label class="form-label">Interval (Days)</label>
            <input type="number" class="form-input" id="cc_interval" value="7" min="1" placeholder="e.g. 5" /></div>
        </div>
        <div class="form-group"><label class="form-label">Start Date</label>
          <input type="date" class="form-input" id="cc_start" required /></div>
        <div class="form-group"><label class="form-label">End Date</label>
          <input type="date" class="form-input" id="cc_end" required /></div>
        <div class="form-group"><label class="form-label">Amount per Collection (₹)</label>
          <input type="number" class="form-input" id="cc_amount" placeholder="e.g. 75000" min="1" required /></div>
        <div class="form-group"><label class="form-label">Reason</label>
          <input class="form-input" id="cc_reason" placeholder="e.g. Material Procurement" /></div>
        <div class="form-group"><label class="form-label">Link to Workflow Item (optional)</label>
          <input class="form-input" id="cc_workflow" placeholder="Workflow item name or ID" /></div>
        <button type="submit" class="btn btn-gold" style="width:100%;justify-content:center;margin-top:0.5rem" id="cc_submit_btn">Generate Plan</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
}

function toggleCollectionTypeFields() {
  const type = document.getElementById('cc_type')?.value;
  const phaseFields = document.getElementById('cc_phase_fields');
  if (phaseFields) phaseFields.style.display = type === 'phase' ? 'block' : 'none';
}

async function submitCreateCollection(e) {
  e.preventDefault();
  const projectEl = document.getElementById('cc_project');
  const projectId = projectEl?.value;
  const clientId  = projectEl?.options[projectEl.selectedIndex]?.dataset?.client;
  const type      = document.getElementById('cc_type')?.value;
  const startDate = document.getElementById('cc_start')?.value;
  const endDate   = document.getElementById('cc_end')?.value;
  const amount    = document.getElementById('cc_amount')?.value;
  const reason    = document.getElementById('cc_reason')?.value;
  const phaseName    = document.getElementById('cc_phase_name')?.value;
  const intervalDays = document.getElementById('cc_interval')?.value;
  const workflowItemId = document.getElementById('cc_workflow')?.value;

  if (!projectId || !clientId || !startDate || !endDate || !amount) {
    showToast('\u2717 All required fields must be filled.', 'error'); return;
  }
  const btn = document.getElementById('cc_submit_btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating\u2026'; }
  try {
    const result = await API.post('/admin/collection-plans', {
      projectId, clientId, type, startDate, endDate,
      amount: Number(amount), reason,
      phaseName, intervalDays: Number(intervalDays) || 7,
      workflowItemId,
    });
    const count = result.plan?.generatedCollections?.length || 0;
    showToast(`\u2713 Plan created — ${count} collections generated!`, 'success');
    document.getElementById('createCollectionModal')?.remove();
    loadCollections();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed to create plan'}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate Plan'; }
  }
}

async function approveCollection(planId, colId) {
  if (!confirm('Approve this collection? A Payment entry will be auto-created.')) return;
  try {
    await API.req('PATCH', `/admin/collection-plans/${planId}/collections/${colId}/approve`);
    showToast('\u2713 Approved — Payment created and amountPaid updated!', 'success');
    loadCollections();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Approval failed'}`, 'error');
  }
}

async function rejectCollection(planId, colId) {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;  // cancelled
  try {
    await API.req('PATCH', `/admin/collection-plans/${planId}/collections/${colId}/reject`, { reason });
    showToast('\u2713 Collection rejected', 'success');
    loadCollections();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Reject failed'}`, 'error');
  }
}

async function reopenCollection(planId, colId) {
  if (!confirm('Reopen this approved entry for editing?')) return;
  try {
    await API.req('PATCH', `/admin/collection-plans/${planId}/collections/${colId}/reopen`);
    showToast('\u2713 Entry reopened — edit and re-approve.', 'success');
    loadCollections();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Reopen failed'}`, 'error');
  }
}

async function markNeedProof(planId, colId) {
  const reason = prompt('Message to client (why proof is needed):') || 'Please upload a valid proof of payment.';
  try {
    await API.req('PATCH', `/admin/collection-plans/${planId}/collections/${colId}/need-proof`, { reason });
    showToast('\u2713 Marked as needing proof', 'success');
    loadCollections();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`\u2717 ${err.message || 'Failed'}`, 'error');
  }
}

async function expandPlanCollections(planId) {
  try {
    const plan = await API.get(`/admin/collection-plans/${planId}`);
    document.getElementById('planDetailModal')?.remove();
    const cName  = plan.clientId?.name  || plan.clientNameSnapshot  || '—';
    const pTitle = plan.projectId?.title || plan.projectTitleSnapshot || '—';
    const rows = plan.generatedCollections.map(col => {
      const stCls = col.status === 'approved' ? 'status-done' : col.status === 'pendingApproval' ? 'status-active' : col.status === 'rejected' ? '' : '';
      const stColor = col.status === 'rejected' ? 'color:#ff6b6b;border-color:#ff6b6b' : '';
      const dateStr = new Date(col.collectionDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const proofHtml = col.proofImage?.url
        ? `<a href="${col.proofImage.url}" target="_blank" style="color:var(--gold)">View</a>`
        : '—';
      const actionsHtml = col.status === 'pendingApproval'
        ? `<button class="btn btn-gold" style="padding:0.2rem 0.5rem;font-size:0.65rem" onclick="approveCollection('${plan._id}','${col._id}');document.getElementById('planDetailModal')?.remove()">Approve</button>
           <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.65rem;color:#ff6b6b;border-color:#ff6b6b" onclick="rejectCollection('${plan._id}','${col._id}');document.getElementById('planDetailModal')?.remove()">Reject</button>`
        : col.status === 'approved' && col.isLocked
        ? `<button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.65rem" onclick="reopenCollection('${plan._id}','${col._id}');document.getElementById('planDetailModal')?.remove()">Reopen</button>`
        : '—';
      return `<tr>
        <td>${dateStr}</td>
        <td class="text-gold">&#8377; ${col.amount.toLocaleString('en-IN')}</td>
        <td style="font-size:0.78rem">${col.reason || '—'}</td>
        <td><span class="status-badge ${stCls}" style="${stColor}">${col.status}</span></td>
        <td>${proofHtml}</td><td>${col.attemptCount||0}</td>
        <td>${actionsHtml}</td></tr>`;
    }).join('');
    const modal = document.createElement('div');
    modal.id = 'planDetailModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="document.getElementById('planDetailModal').remove()"></div>
      <div class="wf-modal-box">
        <div class="cal-modal-header">
          <div class="cal-modal-title"><h3>${cName} — ${pTitle}</h3><span class="cal-modal-sub">${plan.type === 'weekly' ? 'Weekly' : 'Phase'} Collection Plan</span></div>
          <button class="cal-close-btn" onclick="document.getElementById('planDetailModal').remove()">✕</button>
        </div>
        <div style="padding:1rem 1.25rem;overflow-x:auto">
          <table class="pay-table">
            <thead><tr><th>Date</th><th>Amount</th><th>Reason</th><th>Status</th><th>Proof</th><th>Attempts</th><th>Actions</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No collections</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(modal);
  } catch (err) {
    showToast(`\u2717 ${err.message || 'Failed to load plan'}`, 'error');
  }
}
