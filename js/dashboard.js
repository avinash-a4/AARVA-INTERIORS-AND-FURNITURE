/* =============================================
   DASHBOARD.JS – Panel switching + live data
   ============================================= */

// Guard: require login
document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  const user = Auth.getUser();
  if (user?.role === 'admin') { window.location.href = 'admin.html'; return; }

  // Set name in UI
  if (user?.name) {
    const initial = user.name.charAt(0).toUpperCase();
    document.querySelectorAll('#userName,#userAvatar,#dashAvatar').forEach(el => {
      if (el.id === 'userName') el.textContent = user.name;
      else el.textContent = initial;
    });
  }

  // Load live project data
  await loadProjectData();
});

// ── LOAD PROJECT DATA ──────────────────────────────────────────
async function loadProjectData() {
  try {
    const project = await API.get('/client/project');
    renderOverview(project);
  } catch (err) {
    if (err.message && err.message.includes('401')) {
      Auth.logout();
      return;
    }
    // 404 = no project assigned yet
    if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('no project'))) {
      showNoProjectMessage();
      return;
    }
    console.warn('Dashboard: could not load project —', err.message);
  }
}

// ── NO PROJECT MESSAGE ─────────────────────────────────────────
function showNoProjectMessage() {
  const overviewPanel = document.getElementById('panel-overview');
  if (!overviewPanel) return;
  const placeholder = overviewPanel.querySelector('.dash-card');
  if (placeholder) {
    placeholder.innerHTML = `
      <div class="dash-card-body" style="text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">🏗️</div>
        <div class="dash-card-title" style="margin-bottom:0.5rem">No project assigned yet</div>
        <p style="color:var(--text-muted);font-size:0.875rem">Your interior project will appear here once assigned by the AARAV team.</p>
      </div>`;
  }
}

function renderOverview(project) {
  if (!project) return;

  const progressVal = project.progress ?? 0;
  const totalCost   = project.totalCost   ?? 0;
  const amountPaid  = project.amountPaid  ?? 0;
  const balance     = Math.max(0, totalCost - amountPaid);

  // ── Clear all static demo containers on every render ──
  ['overviewPhases','activityList','timelineList','designGrid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  // ── Stat cards (Overview) ──
  const progCard = document.querySelector('.stat-card:nth-child(1) .stat-card-val');
  if (progCard) progCard.textContent = progressVal + '%';

  const costCard = document.querySelector('.stat-card:nth-child(2) .stat-card-val');
  if (costCard) costCard.textContent = '₹ ' + formatINR(amountPaid);

  // Days left from endDate
  const daysCard  = document.querySelector('.stat-card:nth-child(3) .stat-card-val');
  const daysLabel = document.querySelector('.stat-card:nth-child(3) .stat-card-label');
  if (daysCard) {
    if (!project.endDate) {
      daysCard.textContent  = 'Not set';
      if (daysLabel) daysLabel.textContent = 'Est. Completion';
    } else {
      const diff = Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      daysCard.textContent  = diff > 0 ? diff + ' days' : 'Completed';
      if (daysLabel) daysLabel.textContent = diff > 0 ? 'Days Left' : 'Status';
    }
  }

  // ── Project card header ──
  const titleEl = document.querySelector('#panel-overview .dash-card-title');
  if (titleEl) {
    const loc = project.location ?? '';
    titleEl.textContent = [project.title, loc].filter(Boolean).join(' – ');
  }

  // ── Status badge ──
  const badge = document.querySelector('#panel-overview .status-badge');
  if (badge) {
    const statusMap = {
      consultation: 'Consultation',
      design:       'Design Phase',
      material:     'Procurement',
      execution:    'In Progress',
      finishing:    'Finishing',
      completed:    'Completed',
    };
    badge.textContent = statusMap[project.status] || project.status;
    badge.className = 'status-badge ' +
      (project.status === 'completed' ? 'status-done' : 'status-active');
  }

  // ── Progress bar ──
  const barFill = document.querySelector('.progress-bar-fill');
  if (barFill) barFill.style.width = progressVal + '%';

  const barLabel = document.querySelector('.progress-labels .text-gold');
  if (barLabel) barLabel.textContent = progressVal + '%';

  // ── Timeline phases (mini overview) ──
  renderOverviewPhases(project.timeline || []);

  // ── Designs ──
  renderDesigns(Array.isArray(project.designs) ? project.designs : []);

  // ── Recent Updates ──
  renderRecentUpdates(Array.isArray(project.recentUpdates) ? project.recentUpdates : []);

  // ── Payments panel stat cards (use project fields directly) ──
  const totalEl   = document.getElementById('client_total_cost');
  const paidEl    = document.getElementById('client_amount_paid');
  const balanceEl = document.getElementById('client_balance');
  if (totalEl)   totalEl.textContent   = '₹ ' + formatINR(totalCost);
  if (paidEl)    paidEl.textContent    = '₹ ' + formatINR(amountPaid);
  if (balanceEl) balanceEl.textContent = '₹ ' + formatINR(balance);
}

// ── OVERVIEW PHASE PILLS ───────────────────────────────────────
function renderOverviewPhases(timeline) {
  const container = document.getElementById('overviewPhases');
  if (!container) return;
  container.innerHTML = '';

  if (!timeline.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;margin-top:0.5rem">Timeline will appear once the project begins.</p>';
    return;
  }

  timeline.forEach(entry => {
    const cls = entry.status === 'done'        ? 'done'
              : entry.status === 'in-progress' ? 'active'
              : '';
    const dotCls = entry.status === 'done'        ? 'done-dot'
                 : entry.status === 'in-progress' ? 'active-dot'
                 : '';
    const label  = entry.status === 'done'        ? 'Done'
                 : entry.status === 'in-progress' ? 'In Progress'
                 : 'Upcoming';
    container.insertAdjacentHTML('beforeend', `
      <div class="phase ${cls}">
        <span class="phase-dot ${dotCls}"></span>
        <span>${entry.phase}</span>
        <span class="phase-date">${label}</span>
      </div>`);
  });
}

function renderTimeline(timeline) {
  const list = document.getElementById('timelineList') || document.querySelector('#panel-timeline .timeline-list');
  if (!list) return;
  list.innerHTML = '';

  if (!timeline.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">📋</div>
        <div style="color:var(--text-muted);font-size:0.875rem">Project timeline not started yet.<br>The AARAV team will update milestones here as work progresses.</div>
      </div>`;
    return;
  }
  timeline.forEach(entry => {
    const cls = entry.status === 'done' ? 'done-tl'
              : entry.status === 'in-progress' ? 'active-tl'
              : '';
    const dotCls = entry.status === 'done' ? 'done-dot'
                 : entry.status === 'in-progress' ? 'active-dot'
                 : '';
    const badgeCls = entry.status === 'done' ? 'status-done'
                   : entry.status === 'in-progress' ? 'status-active'
                   : '';
    const badgeTxt = entry.status === 'done' ? 'Completed'
                   : entry.status === 'in-progress' ? 'In Progress'
                   : 'Upcoming';
    const dateStr  = entry.date ? new Date(entry.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';
    list.insertAdjacentHTML('beforeend', `
      <div class="tl-item ${cls}">
        <div class="tl-dot ${dotCls}"></div>
        <div class="tl-content">
          ${dateStr ? `<div class="tl-date">${dateStr}</div>` : ''}
          <div class="tl-title">${entry.phase}</div>
          ${entry.note ? `<div class="tl-desc">${entry.note}</div>` : ''}
          <span class="status-badge ${badgeCls}">${badgeTxt}</span>
        </div>
      </div>`);
  });
}

// ── RECENT UPDATES ──────────────────────────────────────────────
function renderRecentUpdates(updates) {
  const list = document.getElementById('activityList') || document.querySelector('#panel-overview .activity-list');
  if (!list) return;
  list.innerHTML = '';

  if (!updates.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">No updates yet. Check back once your project begins.</p>';
    return;
  }

  updates.slice(0, 6).forEach((upd, i) => {
    const dateStr = upd.date
      ? new Date(upd.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      : '';
    list.insertAdjacentHTML('beforeend', `
      <div class="activity-item">
        <div class="activity-dot ${i < 2 ? 'gold' : ''}"></div>
        <div>
          <div class="activity-msg">${upd.message}</div>
          ${dateStr ? `<div class="activity-time">${dateStr}</div>` : ''}
        </div>
      </div>`);
  });
}

// ── DESIGNS ──────────────────────────────────────────────
function renderDesigns(designs) {
  const grid = document.getElementById('designGrid') || document.querySelector('#panel-designs .design-grid');
  if (!grid) return;

  // Update pending-review badge in the panel header
  const pendingCount = designs.filter(d => !d.approved).length;
  const headerBadge = document.querySelector('#panel-designs .status-badge');
  if (headerBadge) {
    headerBadge.textContent = pendingCount > 0 ? `${pendingCount} Pending Review` : 'All Reviewed';
    headerBadge.className   = `status-badge ${pendingCount > 0 ? 'status-active' : 'status-done'}`;
  }

  if (!designs.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem;margin-bottom:1rem">🖨️</div>
        <div class="design-name" style="color:var(--text-muted)">No designs uploaded yet</div>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">Your AARAV team will upload design files here for your review.</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  designs.forEach(design => {
    const dateStr    = design.uploadedAt
      ? new Date(design.uploadedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const isImage    = design.url && (design.url.includes('/image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(design.url));
    const isApproved = design.approved;

    const card = document.createElement('div');
    card.className = `design-card${isApproved ? ' design-card--done' : ''}`;
    card.dataset.designId = design._id;

    card.innerHTML = `
      <div class="design-thumb">
        ${isImage
          ? `<img src="${design.url}" alt="${design.name}" loading="lazy" />`
          : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:2.5rem;background:rgba(255,255,255,0.04)">📄</div>`
        }
        <div class="design-type">${design.type || ''}</div>
      </div>
      <div class="design-info">
        <div class="design-name">${design.name}</div>
        ${dateStr ? `<div class="design-date">${dateStr}</div>` : ''}
        <div style="margin-top:0.6rem;display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-outline" style="padding:0.4rem 0.85rem;font-size:0.7rem" onclick="openDesign('${design.url}')">View File</button>
        </div>
        <div class="design-actions" style="margin-top:0.75rem">
          ${isApproved
            ? `<span class="status-badge status-done" style="margin-top:0.25rem;display:inline-block">✓ Approved</span>`
            : `
              <button class="btn btn-gold" style="padding:0.5rem 1rem;font-size:0.72rem"
                onclick="approveDesign('${design._id}', true, this)">Approve</button>
              <button class="btn btn-ghost" style="padding:0.5rem 1rem;font-size:0.72rem"
                onclick="approveDesign('${design._id}', false, this)">Reject</button>
            `
          }
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ── OPEN DESIGN IN NEW TAB ──────────────────────────────
function openDesign(url) {
  if (url.includes('drive.google.com')) {
    const match = url.match(/[-\w]{25,}/);
    if (match) {
      window.open(`https://drive.google.com/file/d/${match[0]}/preview`, '_blank');
      return;
    }
  }
  window.open(url, '_blank');
}

// ── APPROVE / REJECT DESIGN ──────────────────────────────
async function approveDesign(designId, approved, btn) {
  try {
    const card = btn.closest('.design-card');
    const btns = card?.querySelectorAll('button');
    btns?.forEach(b => b.disabled = true);

    await API.put(`/client/designs/${designId}/approve`, { approved });

    const actionsDiv = card?.querySelector('.design-actions');
    if (actionsDiv) {
      if (approved) {
        card.classList.add('design-card--done');
        actionsDiv.innerHTML = `<span class="status-badge status-done" style="margin-top:0.25rem;display:inline-block">✓ Approved</span>`;
        showToast('✓ Design approved!', 'success');
      } else {
        actionsDiv.innerHTML = `<span class="status-badge" style="border-color:rgba(255,255,255,0.15);color:var(--text-muted)">Rejected</span>`;
        showToast('Design rejected — admin notified.', 'gold');
      }
    }
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Could not update design'}`, 'error');
    btn.closest('.design-card')?.querySelectorAll('button').forEach(b => b.disabled = false);
  }
}

// ── PAYMENTS ───────────────────────────────────────────────────
async function loadPayments() {
  try {
    const payments = await API.get('/client/payments');
    const tbody = document.getElementById('clientPaymentsBody');
    if (!tbody) return;

    if (!payments || !payments.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No payments recorded yet</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    payments.forEach(p => {
      const dateStr = p.paidAt
        ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
        : (p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—');
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${dateStr}</td>
          <td>${p.description ?? '—'}</td>
          <td>₹ ${(p.amount ?? 0).toLocaleString('en-IN')}</td>
          <td>${p.mode ?? '—'}</td>
          <td><span class="status-badge ${p.status === 'paid' ? 'status-done' : 'status-active'}">${p.status === 'paid' ? 'Paid' : 'Pending'}</span></td>
        </tr>`);
    });
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Payments load error:', err.message);
  }
}

// ── QUERY SYSTEM ───────────────────────────────────────────────
async function submitQuery(e) {
  e.preventDefault();
  const message = document.getElementById('queryMessage')?.value?.trim();
  if (!message) return;

  const btn = document.getElementById('querySubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    await API.post('/client/query', { message });
    document.getElementById('queryMessage').value = '';
    const successEl = document.getElementById('querySuccess');
    if (successEl) successEl.style.display = 'block';
    showToast('✓ Query submitted!', 'success');
    loadMyQueries();
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    showToast(`✗ ${err.message || 'Failed to submit query'}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Query'; }
  }
}

async function loadMyQueries() {
  try {
    const queries = await API.get('/client/queries');
    const tbody = document.getElementById('myQueriesBody');
    if (!tbody) return;

    if (!queries || !queries.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">No queries yet</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    queries.forEach(q => {
      const dateStr = new Date(q.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${dateStr}</td>
          <td style="max-width:260px;white-space:normal">${q.message}</td>
          <td><span class="status-badge ${q.status === 'resolved' ? 'status-done' : 'status-active'}">${q.status === 'resolved' ? 'Resolved' : 'Open'}</span></td>
        </tr>`);
    });
  } catch (err) {
    if (err.message?.includes('401')) { Auth.logout(); return; }
    console.warn('Queries load error:', err.message);
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function formatINR(n) {
  if (!n) return '0';
  if (n >= 100000) return (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (n >= 1000)   return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

// ── PANEL SWITCHING ────────────────────────────────────────────
function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('panel-' + id)?.classList.add('active');
  document.getElementById('nav-' + id)?.classList.add('active');
  const titles = { overview:'Overview', designs:'Designs', timeline:'Timeline', workflow:'Workflow', collections:'Collections', payments:'Payments', queries:'Raise a Query' };
  document.getElementById('dashPageTitle').textContent = titles[id] || id;
  if (id === 'payments')    { loadPayments(); loadProjectData(); }
  if (id === 'designs')     loadProjectData();
  if (id === 'queries')     loadMyQueries();
  if (id === 'workflow')    loadWorkflow();
  if (id === 'collections') loadCollections();
}

// Mobile sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// ── CLIENT WORKFLOW CALENDAR ────────────────────────────────
const CLIENT_WORK_COLORS = {
  'Ceiling Work – Framing': { dot: '#C6A969', bg: 'rgba(198,169,105,0.22)', border: '#C6A969' },
  'Procure Wires':          { dot: '#64B4FF', bg: 'rgba(100,180,255,0.18)', border: '#64B4FF' },
  'Sheet Fixing':           { dot: '#9B59B6', bg: 'rgba(155,89,182,0.18)',  border: '#9B59B6' },
  'Finishing & Cleaning':   { dot: '#78C88C', bg: 'rgba(120,200,140,0.18)', border: '#78C88C' },
  'Putty Paint':            { dot: '#FFA050', bg: 'rgba(255,160,80,0.18)',  border: '#FFA050' },
  'Interior Work Starts':   { dot: '#50DCC8', bg: 'rgba(80,220,200,0.18)', border: '#50DCC8' },
};

function clientComputeStatus(startDate, endDate) {
  const today = new Date(); today.setHours(0,0,0,0);
  const s = new Date(startDate); s.setHours(0,0,0,0);
  const e = new Date(endDate);   e.setHours(0,0,0,0);
  if (today < s) return 'Upcoming';
  if (today > e) return 'Completed';
  return 'Active';
}

function clientGenerateCalendar(refDate, workflowItems) {
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
    const col = matchItem ? (CLIENT_WORK_COLORS[matchItem.workName] || null) : null;
    let dotHTML = '';
    if (matchItem && col) {
      const short = matchItem.workName.split('–')[0].trim();
      dotHTML = `<span class="cal-dot" style="background:${col.dot}"></span><span class="cal-task-label" style="color:${col.dot}">${short}</span>`;
    }
    const todayClass = isToday ? ' cal-cell--today' : '';
    const pastClass  = isPast  ? ' cal-cell--past'  : '';
    const taskClass  = matchItem ? ' cal-cell--task' : '';
    const cellStyle  = (matchItem && col) ? `style="border-color:${col.border};background:${col.bg};"` : '';
    const status     = matchItem ? clientComputeStatus(matchItem.startDate, matchItem.endDate) : '';
    const tooltip    = matchItem
      ? `<div class="cal-tooltip"><strong>${matchItem.workName}</strong><br><span>${status}</span></div>`
      : '';
    cells += `<div class="cal-cell${todayClass}${pastClass}${taskClass}" ${cellStyle}><span class="cal-num">${d}</span>${isToday ? '<span class="cal-today-badge">Today</span>' : ''}<div class="cal-cell-body">${dotHTML}</div>${tooltip}</div>`;
  }
  return `<div class="cal-grid-wrap"><div class="cal-grid">${headerHTML}${cells}</div></div>`;
}

let _wfItems   = [];
let _wfViewDate = new Date();

async function loadWorkflow() {
  try {
    const project = await API.get('/client/project');
    _wfItems = project?.workflowCalendar || [];
  } catch (err) {
    console.warn('Workflow load error:', err.message);
    _wfItems = [];
  }

  // Default month: earliest task month or current
  if (_wfItems.length > 0) {
    _wfViewDate = _wfItems.reduce((min, item) => {
      const d = new Date(item.startDate);
      return d < min ? d : min;
    }, new Date(_wfItems[0].startDate));
  } else {
    _wfViewDate = new Date();
  }

  renderWorkflowPanel();
}

function renderWorkflowPanel() {
  const calEl     = document.getElementById('client_wf_calendar');
  const legendEl  = document.getElementById('client_wf_legend');
  const detailsEl = document.getElementById('client_wf_details');
  const monthEl   = document.getElementById('wf_month_label');
  const badge     = document.getElementById('wf_status_badge');

  if (monthEl) monthEl.textContent = _wfViewDate.toLocaleDateString('en-IN', { month:'long', year:'numeric' });

  if (!_wfItems.length) {
    if (calEl)     calEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;padding:1rem 0">No workflow tasks assigned yet.</p>';
    if (legendEl)  legendEl.innerHTML = '';
    if (detailsEl) detailsEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem">No workflow assigned yet. Check back once your AARAV team sets up the schedule.</p>';
    if (badge)     badge.style.display = 'none';
    return;
  }

  // Calendar
  if (calEl) calEl.innerHTML = clientGenerateCalendar(_wfViewDate, _wfItems);

  // Legend
  if (legendEl) {
    const usedColors = new Set(_wfItems.map(i => i.workName));
    legendEl.innerHTML = [...usedColors].map(name => {
      const col = CLIENT_WORK_COLORS[name];
      return col ? `<div class="cal-legend-item"><span class="cal-legend-dot" style="background:${col.dot}"></span>${name}</div>` : '';
    }).join('');
  }

  // Details list
  if (detailsEl) {
    const activeCount = _wfItems.filter(i => clientComputeStatus(i.startDate, i.endDate) === 'Active').length;
    if (badge) {
      badge.textContent = activeCount > 0 ? `${activeCount} Active` : 'All Scheduled';
      badge.className   = `status-badge ${activeCount > 0 ? 'status-active' : 'status-done'}`;
      badge.style.display = '';
    }

    detailsEl.innerHTML = _wfItems.map(item => {
      const status = clientComputeStatus(item.startDate, item.endDate);
      const col    = CLIENT_WORK_COLORS[item.workName];
      const dotSt  = col ? `background:${col.dot}` : 'background:#888';
      const stCls  = status === 'Active' ? 'status-active' : status === 'Completed' ? 'status-done' : '';
      const sStr   = new Date(item.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      const eStr   = new Date(item.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="wf-detail-card" style="margin-bottom:0.5rem">
        <div class="wf-detail-left"><span class="wf-detail-dot" style="${dotSt}"></span>
          <div><div class="wf-detail-name">${item.workName}</div><div class="wf-detail-date">${sStr} &#8594; ${eStr}</div></div></div>
        <div class="wf-detail-right"><span class="status-badge ${stCls}">${status}</span></div>
      </div>`;
    }).join('');
  }
}

function wfPrevMonth() {
  _wfViewDate = new Date(_wfViewDate.getFullYear(), _wfViewDate.getMonth() - 1, 1);
  renderWorkflowPanel();
}
function wfNextMonth() {
  _wfViewDate = new Date(_wfViewDate.getFullYear(), _wfViewDate.getMonth() + 1, 1);
  renderWorkflowPanel();
}

// ── CLIENT COLLECTION PLAN ENGINE ─────────────────────────

const COL_COLORS = {
  Weekly: '#C6A969',
  Phase:  '#64B4FF',
};

async function loadCollections() {
  try {
    const plans = await API.get('/client/collections');
    renderClientCollections(plans);
  } catch (err) {
    console.warn('Collections load error:', err.message);
  }
}

function computeClientCollectionStatus(col) {
  // Status is stored in DB (tracks actions). Dynamic override for display only:
  // If status is 'upcoming' but today >= collectionDate, show 'Due Today'.
  if (col.status === 'upcoming') {
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(col.collectionDate); due.setHours(0,0,0,0);
    if (today.getTime() === due.getTime()) return 'dueToday';
    if (today > due)                       return 'overdue';
  }
  return col.status; // 'upcoming', 'pendingApproval', 'approved', 'rejected'
}

function renderClientCollections(plans) {
  const listEl     = document.getElementById('col_client_list');
  const statsEl    = document.getElementById('col_client_stats');
  const summaryEl  = document.getElementById('col_client_summary');
  if (!listEl) return;

  if (!plans || plans.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem">No collection schedules assigned yet. Your AARAV team will set these up soon.</p>';
    if (statsEl) statsEl.style.display = 'none';
    return;
  }

  // Compute global stats
  let upcoming = 0, pending = 0, approved = 0;
  plans.forEach(plan => plan.generatedCollections.forEach(col => {
    const s = computeClientCollectionStatus(col);
    if (s === 'upcoming' || s === 'dueToday' || s === 'overdue') upcoming++;
    if (s === 'pendingApproval') pending++;
    if (s === 'approved') approved++;
  }));
  if (statsEl) {
    statsEl.style.display = '';
    const upEl = document.getElementById('col_client_upcoming');
    const pEl  = document.getElementById('col_client_pending');
    const aEl  = document.getElementById('col_client_approved');
    if (upEl) upEl.textContent = upcoming;
    if (pEl)  pEl.textContent  = pending;
    if (aEl)  aEl.textContent  = approved;
  }
  if (summaryEl && pending > 0) {
    summaryEl.style.display = '';
    summaryEl.textContent   = `${pending} Pending Approval`;
  }

  // Build collection cards — sorted by date
  const allCols = [];
  plans.forEach(plan => {
    plan.generatedCollections.forEach(col => {
      allCols.push({ plan, col });
    });
  });
  allCols.sort((a,b) => new Date(a.col.collectionDate) - new Date(b.col.collectionDate));

  const cards = allCols.map(({ plan, col }) => {
    const status   = computeClientCollectionStatus(col);
    const dateStr  = new Date(col.collectionDate).toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    const typeLabel = plan.type === 'weekly' ? 'Weekly' : `Phase${plan.phaseName ? ': ' + plan.phaseName : ''}`;

    // Status badge
    const statusBadges = {
      upcoming:       { cls: 'col-st-upcoming',  txt: 'Upcoming' },
      dueToday:       { cls: 'col-st-due',       txt: 'Due Today' },
      overdue:        { cls: 'col-st-overdue',   txt: 'Overdue' },
      pendingApproval:{ cls: 'col-st-pending',   txt: 'Pending Approval' },
      approved:       { cls: 'col-st-approved',  txt: 'Approved ✓' },
      rejected:       { cls: 'col-st-rejected',  txt: 'Rejected' },
    };
    const sb = statusBadges[status] || { cls: '', txt: status };

    // Proof section
    let proofHtml = '';
    if (col.status === 'approved') {
      proofHtml = `<div class="col-proof-approved"><span class="col-st-approved">Payment Approved ✓</span></div>`;
    } else if (col.status === 'pendingApproval') {
      proofHtml = `
        <div class="col-proof-info">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Proof submitted. Awaiting admin review. (Attempt ${col.attemptCount || 1})
        </div>`;
    } else if (col.status === 'rejected') {
      proofHtml = `
        <div class="col-proof-rejected">
          <div class="col-rejection-reason">⚠ ${col.rejectionReason || 'Proof rejected. Please upload again.'}</div>
          <label class="col-upload-btn" for="proof_${col._id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Re-upload Proof
          </label>
          <input type="file" id="proof_${col._id}" style="display:none" accept="image/*,application/pdf"
            onchange="clientSubmitProof('${plan._id}','${col._id}',this)">
        </div>`;
    } else {
      // upcoming / dueToday / overdue — show upload button
      proofHtml = `
        <div class="col-upload-area">
          <label class="col-upload-btn" for="proof_${col._id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            Upload Payment Proof
          </label>
          <input type="file" id="proof_${col._id}" style="display:none" accept="image/*,application/pdf"
            onchange="clientSubmitProof('${plan._id}','${col._id}',this)">
          <span class="col-upload-hint">JPG, PNG, PDF • Max 20 MB</span>
        </div>`;
    }

    return `
      <div class="col-client-card col-card-${status}">
        <div class="col-card-left">
          <div class="col-card-date">${dateStr}</div>
          <div class="col-card-type">${typeLabel}</div>
          <div class="col-card-reason">${col.reason || plan.reason || ''}</div>
        </div>
        <div class="col-card-right">
          <div class="col-card-amount">₹ ${(col.amount||0).toLocaleString('en-IN')}</div>
          <span class="col-status-chip ${sb.cls}">${sb.txt}</span>
        </div>
        <div class="col-card-proof">
          ${proofHtml}
          <div class="col-card-upload-status" id="upload_status_${col._id}"></div>
        </div>
      </div>`;
  }).join('');

  listEl.innerHTML = cards || '<p style="color:var(--text-muted)">No collections found.</p>';
}

async function clientSubmitProof(planId, colId, input) {
  const file = input?.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById(`upload_status_${colId}`);
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--gold);font-size:0.75rem">Uploading\u2026</span>';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = localStorage.getItem('token');
    const BASE_URL = window.API_BASE || 'https://aarav-interiors.onrender.com/api';
    const response = await fetch(`${BASE_URL}/client/collections/${planId}/collections/${colId}/submit-proof`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body:    formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Upload failed');
    }
    if (statusEl) statusEl.innerHTML = '<span style="color:#78C88C;font-size:0.75rem">✓ Proof submitted!</span>';
    // Reload the panel to reflect new status
    setTimeout(() => loadCollections(), 1200);
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<span style="color:#ff6b6b;font-size:0.75rem">✗ ${err.message}</span>`;
  }
}
