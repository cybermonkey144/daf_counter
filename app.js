// ===== State =====
let appData = null;
let talmudProgress = {};
let tanachProgress = {};
let expandedUnits = new Set();
let activeMode = 'talmud';

// ===== Mode Descriptors =====
const MODES = {
  talmud: {
    key: 'talmud',
    label: 'Talmud Bavli',
    unitLabel: 'dapim',
    groups: () => appData.talmud_bavli.sedarim,
    groupName: (g) => g.order,
    units: (g) => g.tractates,
    unitName: (u) => u.name,
    learnableCount: (u) => u.pages - 1,
    cellStart: 2,
    cellEnd: (u) => u.pages,
    totalLearnable: () => appData.talmud_bavli.total_pages,
  },
  tanach: {
    key: 'tanach',
    label: 'Tanach',
    unitLabel: 'chapters',
    groups: () => appData.tanach.sections,
    groupName: (g) => g.division,
    units: (g) => g.books,
    unitName: (u) => u.name,
    learnableCount: (u) => u.chapters,
    cellStart: 1,
    cellEnd: (u) => u.chapters,
    totalLearnable: () => {
      let sum = 0;
      for (const s of appData.tanach.sections)
        for (const b of s.books) sum += b.chapters;
      return sum;
    },
  }
};

// ===== localStorage =====
const STORAGE_KEY = 'dafTracker';

function getProgress(mode) {
  return mode.key === 'talmud' ? talmudProgress : tanachProgress;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { talmudProgress: {}, tanachProgress: {} };
    const data = JSON.parse(raw);
    if (data.version === 1) {
      return { talmudProgress: data.progress || {}, tanachProgress: {} };
    }
    return {
      talmudProgress: data.talmudProgress || {},
      tanachProgress: data.tanachProgress || {}
    };
  } catch {
    return { talmudProgress: {}, tanachProgress: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      talmudProgress,
      tanachProgress
    }));
  } catch {
    alert('Could not save progress — localStorage may be full.');
  }
}

function getCellCount(mode, unitName, cellNum) {
  const prog = getProgress(mode);
  return (prog[unitName] && prog[unitName][String(cellNum)]) || 0;
}

function incrementCell(mode, unitName, cellNum) {
  const prog = getProgress(mode);
  if (!prog[unitName]) prog[unitName] = {};
  const key = String(cellNum);
  prog[unitName][key] = (prog[unitName][key] || 0) + 1;
  saveProgress();
}

function decrementCell(mode, unitName, cellNum) {
  const prog = getProgress(mode);
  if (!prog[unitName]) return;
  const key = String(cellNum);
  const current = prog[unitName][key] || 0;
  if (current <= 1) {
    delete prog[unitName][key];
    if (Object.keys(prog[unitName]).length === 0) {
      delete prog[unitName];
    }
  } else {
    prog[unitName][key] = current - 1;
  }
  saveProgress();
}

// ===== Stats =====
function computeUnitStats(mode, unitName, totalCells) {
  const prog = getProgress(mode);
  const up = prog[unitName] || {};
  let learned = 0;
  let totalReviews = 0;
  for (const cell in up) {
    if (up[cell] > 0) {
      learned++;
      totalReviews += up[cell];
    }
  }
  return {
    learned,
    total: totalCells,
    percentage: totalCells > 0 ? (learned / totalCells) * 100 : 0,
    totalReviews
  };
}

function computeGroupStats(mode, group) {
  let learned = 0, total = 0, totalReviews = 0;
  for (const u of mode.units(group)) {
    const cnt = mode.learnableCount(u);
    const s = computeUnitStats(mode, mode.unitName(u), cnt);
    learned += s.learned;
    total += s.total;
    totalReviews += s.totalReviews;
  }
  return {
    learned, total,
    percentage: total > 0 ? (learned / total) * 100 : 0,
    totalReviews
  };
}

function computeOverallStats(mode) {
  let learned = 0, totalReviews = 0;
  for (const group of mode.groups()) {
    const s = computeGroupStats(mode, group);
    learned += s.learned;
    totalReviews += s.totalReviews;
  }
  const total = mode.totalLearnable();
  return {
    learned, total,
    percentage: total > 0 ? (learned / total) * 100 : 0,
    totalReviews
  };
}

// ===== Rendering =====
function formatPct(pct) {
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
}

function renderOverallStats(mode) {
  const stats = computeOverallStats(mode);
  const el = document.getElementById('overall-stats');
  el.innerHTML = `
    <span>${stats.learned.toLocaleString()} / ${stats.total.toLocaleString()} ${mode.unitLabel} (${formatPct(stats.percentage)}%)</span>
    <span>Reviews: ${stats.totalReviews.toLocaleString()}</span>
  `;
  document.getElementById('overall-progress-fill').style.width = stats.percentage + '%';
}

function renderContent(mode) {
  renderOverallStats(mode);
  const container = document.getElementById('sedarim-container');
  container.innerHTML = '';
  for (const group of mode.groups()) {
    container.appendChild(createGroupElement(mode, group));
  }
}

function createGroupElement(mode, group) {
  const stats = computeGroupStats(mode, group);
  const name = mode.groupName(group);
  const section = document.createElement('section');
  section.className = 'seder';
  section.setAttribute('data-group', name);

  section.innerHTML = `
    <div class="seder-header">
      <span class="seder-name">${name}</span>
      <span class="seder-stats">${stats.learned} / ${stats.total} (${formatPct(stats.percentage)}%)</span>
    </div>
    <div class="seder-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${stats.percentage}%"></div></div>
    </div>
    <div class="tractates-grid"></div>
  `;

  const grid = section.querySelector('.tractates-grid');
  for (const unit of mode.units(group)) {
    grid.appendChild(createUnitCard(mode, unit));
  }

  return section;
}

function createUnitCard(mode, unit) {
  const name = mode.unitName(unit);
  const totalCells = mode.learnableCount(unit);
  const stats = computeUnitStats(mode, name, totalCells);

  const card = document.createElement('div');
  card.className = 'tractate-card';
  card.setAttribute('data-unit', name);
  if (stats.percentage >= 100) card.classList.add('completed');
  if (expandedUnits.has(name)) card.classList.add('expanded');

  card.innerHTML = `
    <div class="tractate-header">
      <span class="tractate-name">${name}</span>
      <span class="tractate-stats">${stats.learned}/${stats.total} (${formatPct(stats.percentage)}%)</span>
      <span class="tractate-toggle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </span>
    </div>
    <div class="tractate-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${stats.percentage}%"></div></div>
    </div>
    <div class="dapim-grid"></div>
  `;

  const header = card.querySelector('.tractate-header');
  header.addEventListener('click', () => {
    const isExpanded = card.classList.toggle('expanded');
    if (isExpanded) {
      expandedUnits.add(name);
      const grid = card.querySelector('.dapim-grid');
      if (grid.children.length === 0) {
        renderCellGrid(mode, grid, unit);
      }
    } else {
      expandedUnits.delete(name);
    }
  });

  if (expandedUnits.has(name)) {
    const grid = card.querySelector('.dapim-grid');
    renderCellGrid(mode, grid, unit);
  }

  return card;
}

function renderCellGrid(mode, grid, unit) {
  grid.innerHTML = '';
  const name = mode.unitName(unit);
  for (let c = mode.cellStart; c <= mode.cellEnd(unit); c++) {
    grid.appendChild(createCell(mode, name, c));
  }
}

function createCell(mode, unitName, cellNum) {
  const count = getCellCount(mode, unitName, String(cellNum));
  const cell = document.createElement('div');
  cell.className = 'daf-cell';
  cell.setAttribute('data-unit', unitName);
  cell.setAttribute('data-cell', cellNum);
  applyCellStyle(cell, count);

  cell.innerHTML = `
    <span class="daf-number">${cellNum}</span>
    <span class="daf-count">${count > 0 ? count : ''}</span>
  `;

  cell.addEventListener('click', (e) => {
    e.preventDefault();
    incrementCell(mode, unitName, String(cellNum));
    updateCell(mode, cell, unitName, cellNum);
    updateUnitCard(mode, unitName);
    updateGroupStats(mode, unitName);
    renderOverallStats(mode);
  });

  cell.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    decrementCell(mode, unitName, String(cellNum));
    updateCell(mode, cell, unitName, cellNum);
    updateUnitCard(mode, unitName);
    updateGroupStats(mode, unitName);
    renderOverallStats(mode);
  });

  let longPressTimer = null;
  cell.addEventListener('touchstart', (e) => {
    longPressTimer = setTimeout(() => {
      e.preventDefault();
      decrementCell(mode, unitName, String(cellNum));
      updateCell(mode, cell, unitName, cellNum);
      updateUnitCard(mode, unitName);
      updateGroupStats(mode, unitName);
      renderOverallStats(mode);
      longPressTimer = null;
    }, 500);
  }, { passive: true });

  cell.addEventListener('touchend', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  cell.addEventListener('touchmove', () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  });

  return cell;
}

function applyCellStyle(cell, count) {
  cell.classList.remove('learned-3plus');
  if (count >= 3) {
    cell.setAttribute('data-count', '3');
    cell.classList.add('learned-3plus');
  } else {
    cell.setAttribute('data-count', String(count));
  }
}

function updateCell(mode, cell, unitName, cellNum) {
  const count = getCellCount(mode, unitName, String(cellNum));
  applyCellStyle(cell, count);
  cell.querySelector('.daf-count').textContent = count > 0 ? count : '';
}

function updateUnitCard(mode, unitName) {
  const card = document.querySelector(`.tractate-card[data-unit="${unitName}"]`);
  if (!card) return;

  const unitData = findUnit(mode, unitName);
  if (!unitData) return;

  const totalCells = mode.learnableCount(unitData);
  const stats = computeUnitStats(mode, unitName, totalCells);

  card.querySelector('.tractate-stats').textContent =
    `${stats.learned}/${stats.total} (${formatPct(stats.percentage)}%)`;
  card.querySelector('.tractate-progress .progress-fill').style.width = stats.percentage + '%';

  if (stats.percentage >= 100) {
    card.classList.add('completed');
  } else {
    card.classList.remove('completed');
  }
}

function updateGroupStats(mode, unitName) {
  const group = findGroupForUnit(mode, unitName);
  if (!group) return;

  const stats = computeGroupStats(mode, group);
  const name = mode.groupName(group);
  const section = document.querySelector(`.seder[data-group="${name}"]`);
  if (!section) return;

  section.querySelector('.seder-stats').textContent =
    `${stats.learned} / ${stats.total} (${formatPct(stats.percentage)}%)`;
  section.querySelector('.seder-progress .progress-fill').style.width = stats.percentage + '%';
}

// ===== Lookups =====
function findUnit(mode, name) {
  for (const group of mode.groups()) {
    for (const u of mode.units(group)) {
      if (mode.unitName(u) === name) return u;
    }
  }
  return null;
}

function findGroupForUnit(mode, unitName) {
  for (const group of mode.groups()) {
    for (const u of mode.units(group)) {
      if (mode.unitName(u) === unitName) return group;
    }
  }
  return null;
}

// ===== Tab Switching =====
function switchMode(modeKey) {
  activeMode = modeKey;
  const mode = MODES[modeKey];

  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    const isActive = tab.getAttribute('data-mode') === modeKey;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  expandedUnits.clear();
  renderContent(mode);
}

// ===== Export / Import / Reset =====
function attachGlobalListeners() {
  // Tab switching
  document.querySelectorAll('#tab-bar .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchMode(tab.getAttribute('data-mode'));
    });
  });

  document.getElementById('export-btn').addEventListener('click', () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      alert('No data to export.');
      return;
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daf-tracker-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.version === 2) {
          talmudProgress = imported.talmudProgress || {};
          tanachProgress = imported.tanachProgress || {};
        } else if (imported.version === 1 || imported.progress) {
          talmudProgress = imported.progress || {};
          tanachProgress = {};
        } else {
          alert('Invalid backup file — missing progress data.');
          return;
        }
        saveProgress();
        expandedUnits.clear();
        renderContent(MODES[activeMode]);
      } catch {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      talmudProgress = {};
      tanachProgress = {};
      expandedUnits.clear();
      renderContent(MODES[activeMode]);
    }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('assets/tanach.json');
    appData = await response.json();
  } catch {
    document.getElementById('sedarim-container').innerHTML =
      '<p style="padding:20px;color:#c1121f;">Failed to load data. Make sure tanach.json exists and you are serving the page via a web server.</p>';
    return;
  }

  const saved = loadProgress();
  talmudProgress = saved.talmudProgress;
  tanachProgress = saved.tanachProgress;
  saveProgress();

  renderContent(MODES[activeMode]);
  attachGlobalListeners();
});
