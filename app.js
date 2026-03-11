// ===== State =====
let talmudData = null;
let progress = {};
let expandedTractates = new Set();

// ===== localStorage =====
const STORAGE_KEY = 'dafTracker';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data.progress || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      progress: progress
    }));
  } catch {
    alert('Could not save progress — localStorage may be full.');
  }
}

function getDafCount(tractate, daf) {
  return (progress[tractate] && progress[tractate][daf]) || 0;
}

function incrementDaf(tractate, daf) {
  if (!progress[tractate]) progress[tractate] = {};
  progress[tractate][daf] = (progress[tractate][daf] || 0) + 1;
  saveProgress();
}

function decrementDaf(tractate, daf) {
  if (!progress[tractate]) return;
  const current = progress[tractate][daf] || 0;
  if (current <= 1) {
    delete progress[tractate][daf];
    if (Object.keys(progress[tractate]).length === 0) {
      delete progress[tractate];
    }
  } else {
    progress[tractate][daf] = current - 1;
  }
  saveProgress();
}

// ===== Stats =====
function tractateLearnableCount(tractate) {
  return tractate.pages - 1;
}

function computeTractateStats(tractateName, totalDapim) {
  const tp = progress[tractateName] || {};
  let learned = 0;
  let totalReviews = 0;
  for (const daf in tp) {
    if (tp[daf] > 0) {
      learned++;
      totalReviews += tp[daf];
    }
  }
  return {
    learned,
    total: totalDapim,
    percentage: totalDapim > 0 ? (learned / totalDapim) * 100 : 0,
    totalReviews
  };
}

function computeSederStats(seder) {
  let learned = 0, total = 0, totalReviews = 0;
  for (const t of seder.tractates) {
    const cnt = tractateLearnableCount(t);
    const s = computeTractateStats(t.name, cnt);
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

function computeOverallStats() {
  let learned = 0, totalReviews = 0;
  for (const seder of talmudData.talmud_bavli.sedarim) {
    const s = computeSederStats(seder);
    learned += s.learned;
    totalReviews += s.totalReviews;
  }
  const total = talmudData.talmud_bavli.total_pages;
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

function renderOverallStats() {
  const stats = computeOverallStats();
  const el = document.getElementById('overall-stats');
  el.innerHTML = `
    <span>${stats.learned.toLocaleString()} / ${stats.total.toLocaleString()} dapim (${formatPct(stats.percentage)}%)</span>
    <span>Reviews: ${stats.totalReviews.toLocaleString()}</span>
  `;
  document.getElementById('overall-progress-fill').style.width = stats.percentage + '%';
}

function renderApp() {
  renderOverallStats();
  const container = document.getElementById('sedarim-container');
  container.innerHTML = '';

  for (const seder of talmudData.talmud_bavli.sedarim) {
    container.appendChild(createSederElement(seder));
  }
}

function createSederElement(seder) {
  const stats = computeSederStats(seder);
  const section = document.createElement('section');
  section.className = 'seder';
  section.setAttribute('data-seder', seder.order);

  section.innerHTML = `
    <div class="seder-header">
      <span class="seder-name">${seder.order}</span>
      <span class="seder-stats">${stats.learned} / ${stats.total} (${formatPct(stats.percentage)}%)</span>
    </div>
    <div class="seder-progress">
      <div class="progress-bar"><div class="progress-fill" style="width:${stats.percentage}%"></div></div>
    </div>
    <div class="tractates-grid"></div>
  `;

  const grid = section.querySelector('.tractates-grid');
  for (const tractate of seder.tractates) {
    grid.appendChild(createTractateCard(tractate));
  }

  return section;
}

function createTractateCard(tractate) {
  const totalDapim = tractateLearnableCount(tractate);
  const stats = computeTractateStats(tractate.name, totalDapim);

  const card = document.createElement('div');
  card.className = 'tractate-card';
  card.setAttribute('data-tractate', tractate.name);
  if (stats.percentage >= 100) card.classList.add('completed');
  if (expandedTractates.has(tractate.name)) card.classList.add('expanded');

  card.innerHTML = `
    <div class="tractate-header">
      <span class="tractate-name">${tractate.name}</span>
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

  // Expand/collapse
  const header = card.querySelector('.tractate-header');
  header.addEventListener('click', () => {
    const isExpanded = card.classList.toggle('expanded');
    if (isExpanded) {
      expandedTractates.add(tractate.name);
      // Lazy-render daf cells on first expand
      const grid = card.querySelector('.dapim-grid');
      if (grid.children.length === 0) {
        renderDafGrid(grid, tractate);
      }
    } else {
      expandedTractates.delete(tractate.name);
    }
  });

  // If already expanded (re-render), populate grid
  if (expandedTractates.has(tractate.name)) {
    const grid = card.querySelector('.dapim-grid');
    renderDafGrid(grid, tractate);
  }

  return card;
}

function renderDafGrid(grid, tractate) {
  grid.innerHTML = '';
  for (let d = 2; d <= tractate.pages; d++) {
    grid.appendChild(createDafCell(tractate.name, d));
  }
}

function createDafCell(tractateName, dafNum) {
  const count = getDafCount(tractateName, String(dafNum));
  const cell = document.createElement('div');
  cell.className = 'daf-cell';
  cell.setAttribute('data-tractate', tractateName);
  cell.setAttribute('data-daf', dafNum);
  applyDafStyle(cell, count);

  cell.innerHTML = `
    <span class="daf-number">${dafNum}</span>
    <span class="daf-count">${count > 0 ? count : ''}</span>
  `;

  // Tap → increment
  cell.addEventListener('click', (e) => {
    e.preventDefault();
    incrementDaf(tractateName, String(dafNum));
    updateDafCell(cell, tractateName, dafNum);
    updateTractateCard(tractateName);
    updateSederStats(tractateName);
    renderOverallStats();
  });

  // Right-click → decrement (desktop)
  cell.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    decrementDaf(tractateName, String(dafNum));
    updateDafCell(cell, tractateName, dafNum);
    updateTractateCard(tractateName);
    updateSederStats(tractateName);
    renderOverallStats();
  });

  // Long-press → decrement (mobile)
  let longPressTimer = null;
  cell.addEventListener('touchstart', (e) => {
    longPressTimer = setTimeout(() => {
      e.preventDefault();
      decrementDaf(tractateName, String(dafNum));
      updateDafCell(cell, tractateName, dafNum);
      updateTractateCard(tractateName);
      updateSederStats(tractateName);
      renderOverallStats();
      longPressTimer = null;
    }, 500);
  }, { passive: true });

  cell.addEventListener('touchend', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  cell.addEventListener('touchmove', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  return cell;
}

function applyDafStyle(cell, count) {
  cell.classList.remove('learned-3plus');
  if (count >= 3) {
    cell.setAttribute('data-count', '3');
    cell.classList.add('learned-3plus');
  } else {
    cell.setAttribute('data-count', String(count));
  }
}

function updateDafCell(cell, tractateName, dafNum) {
  const count = getDafCount(tractateName, String(dafNum));
  applyDafStyle(cell, count);
  cell.querySelector('.daf-count').textContent = count > 0 ? count : '';
}

function updateTractateCard(tractateName) {
  const card = document.querySelector(`.tractate-card[data-tractate="${tractateName}"]`);
  if (!card) return;

  const tractateData = findTractate(tractateName);
  if (!tractateData) return;

  const totalDapim = tractateLearnableCount(tractateData);
  const stats = computeTractateStats(tractateName, totalDapim);

  card.querySelector('.tractate-stats').textContent =
    `${stats.learned}/${stats.total} (${formatPct(stats.percentage)}%)`;
  card.querySelector('.tractate-progress .progress-fill').style.width = stats.percentage + '%';

  if (stats.percentage >= 100) {
    card.classList.add('completed');
  } else {
    card.classList.remove('completed');
  }
}

function updateSederStats(tractateName) {
  const seder = findSederForTractate(tractateName);
  if (!seder) return;

  const stats = computeSederStats(seder);
  const section = document.querySelector(`.seder[data-seder="${seder.order}"]`);
  if (!section) return;

  section.querySelector('.seder-stats').textContent =
    `${stats.learned} / ${stats.total} (${formatPct(stats.percentage)}%)`;
  section.querySelector('.seder-progress .progress-fill').style.width = stats.percentage + '%';
}

// ===== Lookups =====
function findTractate(name) {
  for (const seder of talmudData.talmud_bavli.sedarim) {
    for (const t of seder.tractates) {
      if (t.name === name) return t;
    }
  }
  return null;
}

function findSederForTractate(tractateName) {
  for (const seder of talmudData.talmud_bavli.sedarim) {
    for (const t of seder.tractates) {
      if (t.name === tractateName) return seder;
    }
  }
  return null;
}

// ===== Export / Import / Reset =====
function attachGlobalListeners() {
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
        if (imported.progress) {
          progress = imported.progress;
          saveProgress();
          expandedTractates.clear();
          renderApp();
        } else {
          alert('Invalid backup file — missing progress data.');
        }
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
      progress = {};
      expandedTractates.clear();
      renderApp();
    }
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('assets/dapim.json');
    talmudData = await response.json();
  } catch {
    document.getElementById('sedarim-container').innerHTML =
      '<p style="padding:20px;color:#c1121f;">Failed to load dapim.json. Make sure the file exists and you are serving the page via a web server.</p>';
    return;
  }

  progress = loadProgress();
  renderApp();
  attachGlobalListeners();
});
