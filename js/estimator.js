/* =============================================
   ESTIMATOR JAVASCRIPT - Config-driven calculator
   ============================================= */

const ESTIMATOR_DEFAULT_CONFIG = {
  bhkPrices: {
    '1BHK': 350000,
    '2BHK': 650000,
    '3BHK': 950000,
    '4BHK': 1400000,
    '5+BHK': 2000000,
  },
  roomPrices: {
    kitchen: 120000,
    living: 150000,
    'master-bed': 100000,
    wardrobe: 65000,
    'false-ceiling': 55000,
    'kids-bed': 80000,
    exterior: 40000,
    'extra-bed': 80000,
    'master-wardrobe': 85000,
    'master-king-bed-6x6': 55000,
    'master-queen-bed-5x6': 45000,
    'master-tv-unit': 35000,
    'master-study-unit': 25000,
    'master-side-table': 10000,
    'kids-wardrobe': 70000,
    'kids-bed-3x6': 35000,
    'kids-study-unit': 20000,
    'kids-tv-unit': 25000,
    'kids-side-table': 8000,
    'living-tv-unit': 45000,
    partition: 30000,
    'console-unit': 25000,
    'wall-highlighters': 20000,
    'main-door': 40000,
    'shoe-box': 18000,
    'laundry-unit': 22000,
    'storage-unit': 35000,
  },
  addonPrices: {
    'modular-kitchen': 85000,
    'wardrobes-upgrade': 70000,
    'smart-lighting': 65000,
    'custom-furniture': 120000,
  },
  packageMultipliers: {
    Basic: 1,
    Standard: 1.5,
    Premium: 2,
  },
};

const ESTIMATOR_BHK_OPTIONS = [
  { key: '1BHK', num: '1', label: 'BHK' },
  { key: '2BHK', num: '2', label: 'BHK' },
  { key: '3BHK', num: '3', label: 'BHK' },
  { key: '4BHK', num: '4', label: 'BHK' },
  { key: '5+BHK', num: '5+', label: 'BHK' },
];

const ESTIMATOR_ROOM_OPTIONS = [
  { key: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { key: 'living', label: 'Living Room', icon: '🛋', suboptions: ['living-tv-unit', 'partition', 'console-unit', 'wall-highlighters'] },
  { key: 'master-bed', label: 'Master Bedroom', icon: '🛏', suboptions: ['master-wardrobe', 'master-king-bed-6x6', 'master-queen-bed-5x6', 'master-tv-unit', 'master-study-unit', 'master-side-table'] },
  { key: 'wardrobe', label: 'Wardrobe', icon: '🚪' },
  { key: 'false-ceiling', label: 'False Ceiling', icon: '💡' },
  { key: 'kids-bed', label: 'Kids Bedroom', icon: '🎨', suboptions: ['kids-wardrobe', 'kids-bed-3x6', 'kids-study-unit', 'kids-tv-unit', 'kids-side-table'] },
  { key: 'exterior', label: 'Exterior', icon: '🏡', suboptions: ['main-door', 'shoe-box', 'laundry-unit', 'storage-unit'] },
];

const ESTIMATOR_SUBOPTION_LABELS = {
  'master-wardrobe': 'Master Bedroom Wardrobe',
  'master-king-bed-6x6': 'Master Bedroom King Size Bed 6x6',
  'master-queen-bed-5x6': 'Master Bedroom Queen Size Bed 5x6',
  'master-tv-unit': 'Master Bedroom TV Unit',
  'master-study-unit': 'Master Bedroom Study Unit',
  'master-side-table': 'Master Bedroom Side Table',
  'kids-wardrobe': 'Kids Bedroom Wardrobe',
  'kids-bed-3x6': 'Kids Bed 3x6',
  'kids-study-unit': 'Kids Bedroom Study Unit',
  'kids-tv-unit': 'Kids Bedroom TV Unit',
  'kids-side-table': 'Kids Bedroom Side Table',
  'living-tv-unit': 'TV Unit',
  partition: 'Partition',
  'console-unit': 'Console Unit',
  'wall-highlighters': 'Wall Highlighters',
  'main-door': 'Main Door',
  'shoe-box': 'Shoe Box',
  'laundry-unit': 'Laundry Unit',
  'storage-unit': 'Storage Unit',
};

const ESTIMATOR_ADDON_OPTIONS = [
  { key: 'modular-kitchen', label: 'Modular Kitchen Upgrade', desc: 'Pull-out shelves, magic corners, premium handles', icon: '🍳' },
  { key: 'wardrobes-upgrade', label: 'Wardrobe Interior Upgrade', desc: 'Pull-out drawers, LED lights, shoe racks', icon: '👔' },
  { key: 'smart-lighting', label: 'Smart Lighting System', desc: 'Dimmers, CCT control, voice/app enabled', icon: '💡' },
  { key: 'custom-furniture', label: 'Custom Furniture Set', desc: 'Bespoke sofa, dining table, bed frame', icon: '🛋' },
];

const state = {
  currentStep: 1,
  bhk: null,
  bhkPrice: 0,
  rooms: [],
  roomSuboptions: [],
  roomsTotal: 0,
  bedroomQty: 0,
  package: null,
  multiplier: 1,
  addons: [],
  addonsTotal: 0,
};

let estimatorConfig = cloneEstimatorConfig(ESTIMATOR_DEFAULT_CONFIG);
let bdQty = 0;

document.addEventListener('DOMContentLoaded', initEstimator);

async function initEstimator() {
  estimatorConfig = await loadEstimatorConfig();
  renderBhkOptions();
  renderRoomOptions();
  renderAddonOptions();
  bindPackageCards();
  bindBedroomQty();
  document.getElementById('step1Next')?.addEventListener('click', () => goStep(2));
  document.getElementById('step3Next')?.addEventListener('click', () => goStep(4));
}

async function loadEstimatorConfig() {
  try {
    const config = await API.get('/estimator/config');
    return mergeEstimatorConfig(config);
  } catch (err) {
    console.warn('Estimator config load failed, using defaults:', err.message);
    return cloneEstimatorConfig(ESTIMATOR_DEFAULT_CONFIG);
  }
}

function mergeEstimatorConfig(config) {
  return {
    bhkPrices: { ...ESTIMATOR_DEFAULT_CONFIG.bhkPrices, ...(config?.bhkPrices || {}) },
    roomPrices: { ...ESTIMATOR_DEFAULT_CONFIG.roomPrices, ...(config?.roomPrices || {}) },
    addonPrices: { ...ESTIMATOR_DEFAULT_CONFIG.addonPrices, ...(config?.addonPrices || {}) },
    packageMultipliers: { ...ESTIMATOR_DEFAULT_CONFIG.packageMultipliers, ...(config?.packageMultipliers || {}) },
  };
}

function cloneEstimatorConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function renderBhkOptions() {
  const grid = document.querySelector('.bhk-grid');
  if (!grid) return;
  grid.innerHTML = ESTIMATOR_BHK_OPTIONS.map(option => {
    const price = getEstimatorPrice('bhkPrices', option.key);
    return `
      <button class="bhk-card" data-bhk="${option.key}" data-price="${price}">
        <span class="bhk-num">${option.num}</span>
        <span class="bhk-label">${option.label}</span>
        <span class="bhk-price">From ${formatEstimatorShortCurrency(price)}</span>
      </button>`;
  }).join('');

  document.querySelectorAll('.bhk-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.bhk-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.bhk = card.dataset.bhk;
      state.bhkPrice = toEstimatorNumber(card.dataset.price);
      document.getElementById('step1Next').disabled = false;
    });
  });
}

function renderRoomOptions() {
  const grid = document.querySelector('.rooms-grid');
  if (!grid) return;
  grid.innerHTML = ESTIMATOR_ROOM_OPTIONS.map(room => {
    const price = getEstimatorPrice('roomPrices', room.key);
    return `
      <label class="room-card">
        <input type="checkbox" name="room" value="${room.key}" data-price="${price}" />
        <div class="room-card-inner">
          <div class="room-icon">${room.icon}</div>
          <div class="room-name">${room.label}</div>
          <div class="room-cost">+ ${formatEstimatorShortCurrency(price)}</div>
        </div>
      </label>
      ${room.suboptions ? renderSuboptionGroup(room) : ''}`;
  }).join('');

  document.querySelectorAll('input[name="room"]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleRoomSuboptions(cb.value, cb.checked);
      updateRooms();
    });
  });
  document.querySelectorAll('input[name="room-suboption"]').forEach(cb => {
    cb.addEventListener('change', updateRooms);
  });
}

function renderSuboptionGroup(room) {
  return `
    <div class="room-suboptions" data-parent-room="${room.key}">
      ${room.suboptions.map(key => {
        const price = getEstimatorPrice('roomPrices', key);
        return `
          <label class="room-suboption-card">
            <input type="checkbox" name="room-suboption" value="${key}" data-parent="${room.key}" data-price="${price}" />
            <span class="room-suboption-name">${ESTIMATOR_SUBOPTION_LABELS[key] || humanizeEstimatorKey(key)}</span>
            <span class="room-suboption-price">+ ${formatEstimatorShortCurrency(price)}</span>
          </label>`;
      }).join('')}
    </div>`;
}

function toggleRoomSuboptions(roomKey, visible) {
  const group = document.querySelector(`.room-suboptions[data-parent-room="${roomKey}"]`);
  if (!group) return;
  group.classList.toggle('active', visible);
  if (!visible) {
    group.querySelectorAll('input[name="room-suboption"]').forEach(cb => { cb.checked = false; });
  }
}

function updateRooms() {
  state.rooms = [];
  state.roomSuboptions = [];
  state.roomsTotal = 0;

  document.querySelectorAll('input[name="room"]:checked').forEach(cb => {
    const price = toEstimatorNumber(cb.dataset.price);
    state.rooms.push({ name: cb.value, label: getEstimatorRoomLabel(cb.value), price });
    state.roomsTotal += price;
  });

  document.querySelectorAll('input[name="room-suboption"]:checked').forEach(cb => {
    const price = toEstimatorNumber(cb.dataset.price);
    state.roomSuboptions.push({ name: cb.value, label: ESTIMATOR_SUBOPTION_LABELS[cb.value] || humanizeEstimatorKey(cb.value), price });
    state.roomsTotal += price;
  });

  state.roomsTotal += state.bedroomQty * getEstimatorPrice('roomPrices', 'extra-bed');
  const qtyNote = document.querySelector('.qty-note');
  if (qtyNote) qtyNote.textContent = `Each additional bedroom + ${formatEstimatorFullCurrency(getEstimatorPrice('roomPrices', 'extra-bed'))}`;
}

function bindBedroomQty() {
  const plus = document.getElementById('bdQtyPlus');
  const minus = document.getElementById('bdQtyMinus');
  const val = document.getElementById('bdQtyVal');
  plus?.addEventListener('click', () => {
    bdQty = Math.min(bdQty + 1, 10);
    if (val) val.textContent = bdQty;
    state.bedroomQty = bdQty;
    updateRooms();
  });
  minus?.addEventListener('click', () => {
    bdQty = Math.max(bdQty - 1, 0);
    if (val) val.textContent = bdQty;
    state.bedroomQty = bdQty;
    updateRooms();
  });
  updateRooms();
}

function bindPackageCards() {
  document.querySelectorAll('.pkg-card').forEach(card => {
    const pkg = card.dataset.pkg;
    const multiplier = getEstimatorPrice('packageMultipliers', pkg);
    card.dataset.multiplier = multiplier;
    const tag = card.querySelector('.pkg-tag');
    if (tag) tag.textContent = `${multiplier}x multiplier`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.package = pkg;
      state.multiplier = multiplier;
      document.getElementById('step3Next').disabled = false;
    });
  });
}

function renderAddonOptions() {
  const grid = document.querySelector('.addons-grid');
  if (!grid) return;
  grid.innerHTML = ESTIMATOR_ADDON_OPTIONS.map(addon => {
    const price = getEstimatorPrice('addonPrices', addon.key);
    return `
      <label class="addon-card">
        <input type="checkbox" name="addon" value="${addon.key}" data-price="${price}" />
        <div class="addon-inner">
          <div class="addon-icon">${addon.icon}</div>
          <div class="addon-info">
            <div class="addon-name">${addon.label}</div>
            <div class="addon-desc">${addon.desc}</div>
          </div>
          <div class="addon-price">+ ${formatEstimatorShortCurrency(price)}</div>
        </div>
      </label>`;
  }).join('');

  document.querySelectorAll('input[name="addon"]').forEach(cb => {
    cb.addEventListener('change', updateAddons);
  });
}

function updateAddons() {
  state.addons = [];
  state.addonsTotal = 0;
  document.querySelectorAll('input[name="addon"]:checked').forEach(a => {
    const price = toEstimatorNumber(a.dataset.price);
    state.addons.push({ name: a.value, label: getEstimatorAddonLabel(a.value), price });
    state.addonsTotal += price;
  });
}

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

function calculateAndShow() {
  updateRooms();
  updateAddons();

  const base = state.bhkPrice;
  const rooms = state.roomsTotal;
  const subtotal = (base + rooms) * state.multiplier;
  const addons = state.addonsTotal;
  const total = subtotal + addons;
  const low = Math.round(total * 0.9);
  const high = Math.round(total * 1.1);

  document.getElementById('resultRange').textContent = `${formatEstimatorShortCurrency(low)} - ${formatEstimatorShortCurrency(high)}`;
  document.getElementById('resultBhk').textContent = state.bhk || '';
  document.getElementById('resultPkg').textContent = state.package || '';

  const selectedItemsCount = state.rooms.length + state.roomSuboptions.length;
  const breakdown = [
    { label: `BHK Base Cost (${state.bhk})`, value: formatEstimatorFullCurrency(base) },
    { label: `Selected Rooms & Suboptions (${selectedItemsCount} selected + ${state.bedroomQty} extra bedrooms)`, value: formatEstimatorFullCurrency(rooms) },
    { label: `Subtotal before package`, value: formatEstimatorFullCurrency(base + rooms) },
    { label: `Package Multiplier (${state.package} x ${state.multiplier})`, value: `${state.multiplier}x` },
    { label: `After Package Applied`, value: formatEstimatorFullCurrency(Math.round(subtotal)) },
    ...(addons > 0 ? [{ label: `Add-ons (${state.addons.length} selected)`, value: formatEstimatorFullCurrency(addons) }] : []),
    { label: `Estimated Total (Midpoint)`, value: formatEstimatorFullCurrency(Math.round(total)), isTotal: true },
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

function getEstimatorPrice(group, key) {
  return toEstimatorNumber(estimatorConfig?.[group]?.[key] ?? ESTIMATOR_DEFAULT_CONFIG[group]?.[key]);
}

function getEstimatorRoomLabel(key) {
  return ESTIMATOR_ROOM_OPTIONS.find(room => room.key === key)?.label || ESTIMATOR_SUBOPTION_LABELS[key] || humanizeEstimatorKey(key);
}

function getEstimatorAddonLabel(key) {
  return ESTIMATOR_ADDON_OPTIONS.find(addon => addon.key === key)?.label || humanizeEstimatorKey(key);
}

function toEstimatorNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatEstimatorShortCurrency(n) {
  const value = toEstimatorNumber(n);
  if (value >= 100000) return '₹ ' + (value / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (value >= 1000) return '₹ ' + (value / 1000).toFixed(0) + 'K';
  return '₹ ' + value.toLocaleString('en-IN');
}

function formatEstimatorFullCurrency(n) {
  return '₹ ' + toEstimatorNumber(n).toLocaleString('en-IN');
}

function humanizeEstimatorKey(key) {
  return String(key)
    .split('-')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}
