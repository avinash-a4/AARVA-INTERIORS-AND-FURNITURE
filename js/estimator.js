/* =============================================
   ESTIMATOR JAVASCRIPT – 5-Step Calculator
   ============================================= */

const state = {
  currentStep: 1,
  bhk: null,
  bhkPrice: 0,
  rooms: [],
  roomsTotal: 0,
  bedroomQty: 0,
  package: null,
  multiplier: 1,
  addons: [],
  addonsTotal: 0,
};

// Navigate between steps
function goStep(n) {
  document.querySelector(`#step${state.currentStep}`)?.classList.remove('active');
  document.querySelectorAll('.progress-step').forEach((s, i) => {
    if (i + 1 < n) s.classList.add('done');
    else s.classList.remove('done');
    if (i + 1 === n) s.classList.add('active');
    else s.classList.remove('active');
  });
  state.currentStep = n;
  document.querySelector(`#step${n}`)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// STEP 1 – BHK selection
document.querySelectorAll('.bhk-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.bhk-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.bhk = card.dataset.bhk;
    state.bhkPrice = parseInt(card.dataset.price);
    document.getElementById('step1Next').disabled = false;
  });
});
document.getElementById('step1Next').addEventListener('click', () => goStep(2));

// STEP 2 – Rooms & bedroom qty
document.querySelectorAll('input[name="room"]').forEach(cb => {
  cb.addEventListener('change', updateRooms);
});
function updateRooms() {
  state.rooms = [];
  state.roomsTotal = 0;
  document.querySelectorAll('input[name="room"]:checked').forEach(cb => {
    state.rooms.push({ name: cb.value, price: parseInt(cb.dataset.price) });
    state.roomsTotal += parseInt(cb.dataset.price);
  });
  // Add bedroom qty
  state.roomsTotal += state.bedroomQty * 80000;
}

let bdQty = 0;
document.getElementById('bdQtyPlus').addEventListener('click', () => {
  bdQty = Math.min(bdQty + 1, 10);
  document.getElementById('bdQtyVal').textContent = bdQty;
  state.bedroomQty = bdQty;
  updateRooms();
});
document.getElementById('bdQtyMinus').addEventListener('click', () => {
  bdQty = Math.max(bdQty - 1, 0);
  document.getElementById('bdQtyVal').textContent = bdQty;
  state.bedroomQty = bdQty;
  updateRooms();
});

// STEP 3 – Package
document.querySelectorAll('.pkg-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.package = card.dataset.pkg;
    state.multiplier = parseFloat(card.dataset.multiplier);
    document.getElementById('step3Next').disabled = false;
  });
});
document.getElementById('step3Next').addEventListener('click', () => goStep(4));

// STEP 4 – Add-ons
document.querySelectorAll('input[name="addon"]').forEach(cb => {
  cb.addEventListener('change', () => {
    state.addons = [];
    state.addonsTotal = 0;
    document.querySelectorAll('input[name="addon"]:checked').forEach(a => {
      state.addons.push({ name: a.value, price: parseInt(a.dataset.price) });
      state.addonsTotal += parseInt(a.dataset.price);
    });
  });
});

// Calculate & Show Result
function calculateAndShow() {
  updateRooms();

  const base = state.bhkPrice;
  const rooms = state.roomsTotal;
  const subtotal = (base + rooms) * state.multiplier;
  const addons = state.addonsTotal;
  const total = subtotal + addons;

  // Range: ±10%
  const low = Math.round(total * 0.9);
  const high = Math.round(total * 1.1);

  const fmt = n => '₹ ' + (n >= 100000
    ? (n / 100000).toFixed(1) + 'L'
    : (n / 1000).toFixed(0) + 'K');
  const fmtFull = n => '₹ ' + n.toLocaleString('en-IN');

  // Display
  document.getElementById('resultRange').textContent = `${fmt(low)} – ${fmt(high)}`;
  document.getElementById('resultBhk').textContent = state.bhk || '';
  document.getElementById('resultPkg').textContent = state.package || '';

  // Build breakdown
  const breakdown = [
    { label: `BHK Base Cost (${state.bhk})`, value: fmtFull(base) },
    { label: `Selected Rooms (${state.rooms.length} rooms + ${state.bedroomQty} extra bedrooms)`, value: fmtFull(rooms) },
    { label: `Subtotal before package`, value: fmtFull(base + rooms) },
    { label: `Package Multiplier (${state.package} × ${state.multiplier})`, value: `${state.multiplier}×` },
    { label: `After Package Applied`, value: fmtFull(Math.round(subtotal)) },
    ...(addons > 0 ? [{ label: `Add-ons (${state.addons.length} selected)`, value: fmtFull(addons) }] : []),
    { label: `Estimated Total (Midpoint)`, value: fmtFull(Math.round(total)), isTotal: true },
  ];

  const el = document.getElementById('resultBreakdown');
  el.innerHTML = breakdown.map(b =>
    `<div class="breakdown-item ${b.isTotal ? 'breakdown-total' : ''}">
      <span class="breakdown-label">${b.label}</span>
      <span class="breakdown-value">${b.value}</span>
    </div>`
  ).join('');

  goStep(5);
}
