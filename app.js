const STORAGE_KEYS = {
  drills: 'drills',
  history: 'history',
  weeks: 'weeks',
  editing: 'editing'
};

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    if (val === null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(val));
  }
};

async function ensureDrills() {
  const storedDrills = store.get(STORAGE_KEYS.drills, null);
  if (storedDrills?.length) return storedDrills;

  const res = await fetch('./drills.json');
  const drills = await res.json();
  store.set(STORAGE_KEYS.drills, drills);
  return drills;
}

function uid() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function formatDate(d = new Date()) {
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function getHistory() {
  return store.get(STORAGE_KEYS.history, []);
}

function getWeeks() {
  return store.get(STORAGE_KEYS.weeks, []);
}

function setStatus(message, type = 'success') {
  const status = document.getElementById('status');
  if (!status) return;
  status.className = `status ${type}`;
  status.textContent = message;
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 3500);
}

function renderStat(label, value, detail) {
  return `
    <div class="stat">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
    </div>
  `;
}

function renderDashboard() {
  const app = document.getElementById('app');
  const history = getHistory();
  const weeks = getWeeks();
  const successAverage = average(history.map(item => item.success));
  const masteryAverage = average(history.map(item => item.mastery));
  const latest = history.slice(0, 3);
  const categoryCounts = history.reduce((counts, entry) => {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
    return counts;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

  app.innerHTML = `
    <section class="hero card">
      <div>
        <p class="kicker">Training command center</p>
        <h2>Build consistency on the path to 4.0.</h2>
        <p class="small">Track drills, review trends, and keep weekly goals visible every time you practice.</p>
      </div>
      <button class="secondary" data-action="quick-log">Log today's work</button>
    </section>

    <section class="stats-grid">
      ${renderStat('drill sessions', history.length, 'logged locally')}
      ${renderStat('avg success', successAverage == null ? '—' : `${successAverage}%`, 'from measured drills')}
      ${renderStat('avg mastery', masteryAverage == null ? '—' : `${masteryAverage}/5`, 'self-rated')}
      ${renderStat('weekly reviews', weeks.length, topCategory ? `most practiced: ${topCategory[0]}` : 'start with a drill')}
    </section>

    <section class="card">
      <div class="section-heading">
        <div>
          <p class="kicker">Recent activity</p>
          <h3>Last sessions</h3>
        </div>
        <button class="secondary compact" data-action="view-history">View all</button>
      </div>
      ${latest.length ? latest.map(item => renderHistoryItem(item, false)).join('') : '<p>No sessions yet. Log your first drill to start building momentum.</p>'}
    </section>
  `;

  app.querySelector('[data-action="quick-log"]').addEventListener('click', () => switchTab('log'));
  app.querySelector('[data-action="view-history"]').addEventListener('click', () => switchTab('history'));
}

function renderLog(drills) {
  const categories = [...new Set(drills.map(d => d.category))].sort();
  const editing = store.get(STORAGE_KEYS.editing, null);
  const app = document.getElementById('app');
  app.innerHTML = `
    <section class="card">
      <div class="section-heading">
        <div>
          <div class="kicker">${editing ? 'Update entry' : 'New entry'}</div>
          <h2>${editing ? 'Edit training session' : 'Log a drill'}</h2>
        </div>
        <span id="status" class="status"></span>
      </div>
      <form id="entryForm">
        <input type="hidden" id="entryId" value="${escapeHtml(editing?.id || '')}" />
        <label for="date">Date</label>
        <input type="date" id="date" value="${escapeHtml(editing?.date || formatDate())}" required />

        <label for="category">Category</label>
        <select id="category">${categories.map(c => `<option ${editing?.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>

        <label for="drill">Drill</label>
        <select id="drill"></select>

        <label for="result">Result</label>
        <input id="result" placeholder="e.g., 12/15 drops landed" value="${escapeHtml(editing?.result || '')}" />

        <div class="row">
          <div>
            <label for="mastery">Mastery (1–5)</label>
            <select id="mastery">${[1, 2, 3, 4, 5].map(n => `<option ${Number(editing?.mastery || 3) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </div>
          <div>
            <label for="success">Success %</label>
            <input id="success" type="number" min="0" max="100" placeholder="e.g., 80" value="${editing?.success ?? ''}" />
          </div>
        </div>

        <label for="notes">Notes</label>
        <textarea id="notes" placeholder="What worked? What should change next?">${escapeHtml(editing?.notes || '')}</textarea>

        <button type="submit">${editing ? 'Update Entry' : 'Save Entry'}</button>
        ${editing ? '<button type="button" class="secondary" id="cancelEdit">Cancel edit</button>' : ''}
      </form>
    </section>
    <section class="card" id="drillInfo"></section>
  `;

  const catSel = document.getElementById('category');
  const drillSel = document.getElementById('drill');
  const info = document.getElementById('drillInfo');

  function updateDrillsForCategory() {
    const list = drills.filter(d => d.category === catSel.value);
    drillSel.innerHTML = list.map(d => `<option ${editing?.drill === d.name ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
    updateDrillInfo();
  }

  function updateDrillInfo() {
    const drill = drills.find(d => d.name === drillSel.value);
    if (!drill) return;
    info.innerHTML = `
      <div class="list-item">
        <div>
          <div class="badge">${escapeHtml(drill.category)}</div>
          <h3>${escapeHtml(drill.name)}</h3>
          <div class="small">${escapeHtml(drill.description)}</div>
        </div>
        <div class="goal-box">
          <div class="kicker">Goal</div>
          <div>${escapeHtml(drill.goal)}</div>
          <div class="kicker">Reps/Duration</div>
          <div>${escapeHtml(drill.duration)}</div>
        </div>
      </div>
    `;
  }

  catSel.addEventListener('change', updateDrillsForCategory);
  drillSel.addEventListener('change', updateDrillInfo);
  updateDrillsForCategory();

  document.getElementById('entryForm').addEventListener('submit', event => {
    event.preventDefault();
    const id = document.getElementById('entryId').value || uid();
    const entry = {
      id,
      date: document.getElementById('date').value,
      category: catSel.value,
      drill: drillSel.value,
      result: document.getElementById('result').value.trim(),
      mastery: parseInt(document.getElementById('mastery').value, 10),
      success: document.getElementById('success').value ? parseInt(document.getElementById('success').value, 10) : null,
      notes: document.getElementById('notes').value.trim()
    };
    const history = getHistory().filter(item => item.id !== id);
    history.unshift(entry);
    store.set(STORAGE_KEYS.history, history);
    store.set(STORAGE_KEYS.editing, null);
    setStatus(editing ? 'Entry updated.' : 'Entry saved.');
    setTimeout(() => switchTab('dashboard'), 500);
  });

  document.getElementById('cancelEdit')?.addEventListener('click', () => {
    store.set(STORAGE_KEYS.editing, null);
    switchTab('history');
  });
}

function renderHistoryItem(item, withActions = true) {
  return `
    <div class="list-item entry-row">
      <div>
        <span class="badge">${escapeHtml(item.category)}</span>
        <strong>${escapeHtml(item.drill)}</strong>
        <div class="small">${escapeHtml(item.date)}</div>
        ${item.result ? `<div>Result: ${escapeHtml(item.result)}</div>` : ''}
        ${item.notes ? `<div class="small">Notes: ${escapeHtml(item.notes)}</div>` : ''}
      </div>
      <div class="entry-actions">
        ${item.success != null ? `<div><strong>${item.success}%</strong> <span class="small">success</span></div>` : ''}
        <div class="small">Mastery: ${escapeHtml(item.mastery)}/5</div>
        ${withActions ? `<button class="secondary compact" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button><button class="danger compact" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>` : ''}
      </div>
    </div>
  `;
}

function renderHistory() {
  const app = document.getElementById('app');
  const history = getHistory();
  app.innerHTML = history.length
    ? `<section class="card"><p class="kicker">History</p>${history.map(item => renderHistoryItem(item)).join('')}</section>`
    : '<section class="card"><p>No entries yet. Log your first drill to see history.</p></section>';

  app.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set(STORAGE_KEYS.history, getHistory().filter(e => e.id !== btn.dataset.id));
      renderHistory();
    });
  });

  app.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set(STORAGE_KEYS.editing, getHistory().find(e => e.id === btn.dataset.id));
      switchTab('log');
    });
  });
}

function renderWeekly() {
  const app = document.getElementById('app');
  const weeks = getWeeks();
  app.innerHTML = `
    <section class="card">
      <div class="kicker">Weekly Assessment</div>
      <label for="wNum">Week #</label><input id="wNum" type="number" min="1" placeholder="e.g., 1" />
      <label for="wRange">Date Range</label><input id="wRange" placeholder="e.g., Jun 15–21, 2026" />
      <label for="wFocus">Focus Skill</label><input id="wFocus" placeholder="e.g., Third Shot Drop" />
      <label for="wGoal">Goal for Week</label><input id="wGoal" placeholder="e.g., 10 consecutive controlled drops" />
      <label for="wMetric">Measured Metric</label><input id="wMetric" placeholder="e.g., Drop accuracy" />
      <div class="row"><div><label for="wResult">Result</label><input id="wResult" placeholder="e.g., 9/10" /></div><div><label for="wSuccess">Success %</label><input id="wSuccess" type="number" min="0" max="100" placeholder="e.g., 90" /></div></div>
      <label for="wNotes">Notes</label><textarea id="wNotes" placeholder="What improved? What comes next?"></textarea>
      <button id="wSave">Save Week</button>
    </section>
    ${weeks.length ? `<section class="card"><div class="kicker">Saved Weeks</div>${weeks.map(w => `<div class="list-item entry-row"><div><strong>Week ${escapeHtml(w.num)}</strong> — <span class="small">${escapeHtml(w.range)}</span><br><span class="badge">${escapeHtml(w.focus)}</span> <span class="small">${escapeHtml(w.goal)}</span>${w.notes ? `<div class="small">${escapeHtml(w.notes)}</div>` : ''}</div><div class="entry-actions">${w.success != null ? `<div><strong>${w.success}%</strong></div>` : ''}<div class="small">${escapeHtml(w.metric)}</div><button class="danger compact" data-action="delete-week" data-id="${escapeHtml(w.id)}">Delete</button></div></div>`).join('')}</section>` : ''}
  `;

  document.getElementById('wSave').addEventListener('click', () => {
    const week = {
      id: uid(),
      num: parseInt(document.getElementById('wNum').value, 10) || weeks.length + 1,
      range: document.getElementById('wRange').value.trim(),
      focus: document.getElementById('wFocus').value.trim(),
      goal: document.getElementById('wGoal').value.trim(),
      metric: document.getElementById('wMetric').value.trim(),
      result: document.getElementById('wResult').value.trim(),
      success: document.getElementById('wSuccess').value ? parseInt(document.getElementById('wSuccess').value, 10) : null,
      notes: document.getElementById('wNotes').value.trim()
    };
    store.set(STORAGE_KEYS.weeks, [week, ...weeks]);
    renderWeekly();
  });

  app.querySelectorAll('[data-action="delete-week"]').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set(STORAGE_KEYS.weeks, getWeeks().filter(week => week.id !== btn.dataset.id));
      renderWeekly();
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'log') ensureDrills().then(renderLog);
  if (tab === 'history') renderHistory();
  if (tab === 'weekly') renderWeekly();
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

ensureDrills().then(() => switchTab('dashboard'));
