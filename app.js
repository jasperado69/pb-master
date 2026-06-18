
// Simple localStorage helpers
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

// Preload drills on first run
async function ensureFixtures() {
  let drills = store.get('drills', null);
  if (!drills) {
    const res = await fetch('./drills.json');
    drills = await res.json();
    store.set('drills', drills);
  }
  return drills;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatDate(d = new Date()) {
  const pad = n => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// Views
function renderLog(drills) {
  const categories = [...new Set(drills.map(d => d.category))].sort();
  const app = document.getElementById('app');
  app.innerHTML = `
  <section class="card">
    <div class="kicker">New Match Entry</div>
    <label>Date</label>
    <input type="date" id="date" value="${formatDate()}"/>

    <label>Competition Area</label>
    <select id="category">
      ${categories.map(c => `<option>${c}</option>`).join('')}
    </select>

    <label>Fixture</label>
    <select id="drill"></select>

    <label>Result / Score</label>
    <input id="result" placeholder="e.g., Borris 2–1 Rival"/>

    <div class="row">
      <div>
        <label>Performance (1–5)</label>
        <select id="mastery">
          ${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Win %</label>
        <input id="success" type="number" min="0" max="100" placeholder="e.g., 80"/>
      </div>
    </div>

    <label>Notes</label>
    <textarea id="notes" placeholder="Key moments, standout plays, next adjustments"></textarea>

    <button id="save">Save Match</button>
    <p class="small">Match goals appear automatically for each fixture.</p>
  </section>

  <section class="card" id="drillInfo"></section>
  `;

  const catSel = document.getElementById('category');
  const drillSel = document.getElementById('drill');
  const info = document.getElementById('drillInfo');

  function updateFixturesForCompetition() {
    const cat = catSel.value;
    const list = drills.filter(d => d.category === cat);
    drillSel.innerHTML = list.map(d => `<option>${d.name}</option>`).join('');
    updateFixtureInfo();
  }
  function updateFixtureInfo() {
    const drill = drills.find(d => d.name === drillSel.value);
    info.innerHTML = `
      <div class="list-item">
        <div>
          <div class="badge">${drill.category}</div>
          <h3 style="margin:6px 0 4px;">${drill.name}</h3>
          <div class="small">${drill.description}</div>
        </div>
        <div style="text-align:right;">
          <div class="kicker">Goal</div>
          <div>${drill.goal}</div>
          <div class="kicker" style="margin-top:6px;">Stage / Duration</div>
          <div>${drill.duration}</div>
        </div>
      </div>
    `;
  }

  catSel.addEventListener('change', updateFixturesForCompetition);
  drillSel.addEventListener('change', updateFixtureInfo);
  updateFixturesForCompetition();

  document.getElementById('save').addEventListener('click', () => {
    const entry = {
      id: uid(),
      date: document.getElementById('date').value,
      category: catSel.value,
      drill: drillSel.value,
      result: document.getElementById('result').value,
      mastery: parseInt(document.getElementById('mastery').value, 10),
      success: document.getElementById('success').value ? parseInt(document.getElementById('success').value, 10) : null,
      notes: document.getElementById('notes').value
    };
    const history = store.get('history', []);
    history.unshift(entry);
    store.set('history', history);
    alert('Saved ✅');
  });
}

function renderHistory() {
  const app = document.getElementById('app');
  const history = store.get('history', []);
  if (!history.length) {
    app.innerHTML = `<section class="card"><p>No entries yet. Log your first match to see history.</p></section>`;
    return;
  }
  app.innerHTML = history.map(item => `
    <section class="card">
      <div class="list-item">
        <div>
          <span class="badge">${item.category}</span>
          <strong>${item.drill}</strong>
          <div class="small">${item.date}</div>
        </div>
        <div style="text-align:right;">
          ${item.success!=null?`<div><strong>${item.success}%</strong> <span class="small">win rate</span></div>`:''}
          <div class="small">Performance: ${item.mastery}/5</div>
        </div>
      </div>
      ${item.result?`<div style="margin-top:8px;">Result: ${item.result}</div>`:''}
      ${item.notes?`<div class="small" style="margin-top:8px;">Notes: ${item.notes}</div>`:''}
      <div class="row" style="margin-top:10px;">
        <button data-action="edit" data-id="${item.id}">Edit</button>
        <button data-action="delete" data-id="${item.id}">Delete</button>
      </div>
    </section>
  `).join('');

  // Edit/Delete handlers
  app.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const hist = store.get('history', []).filter(e => e.id !== id);
      store.set('history', hist);
      renderHistory();
    });
  });

  app.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const hist = store.get('history', []);
      const e = hist.find(x => x.id === id);
      // Simple edit: push back to log with prefilled values
      store.set('editing', e);
      switchTab('log');
    });
  });
}

function renderWeekly() {
  const app = document.getElementById('app');
  const weeks = store.get('weeks', []);
  app.innerHTML = `
    <section class="card">
      <div class="kicker">World Cup Standings</div>
      <label>Round #</label><input id="wNum" type="number" min="1" placeholder="e.g., 1" />
      <label>Matchday / Date Range</label><input id="wRange" placeholder="e.g., Oct 27–Nov 2, 2025" />
      <label>Featured Team</label><input id="wFocus" placeholder="e.g., Team Borris" />
      <label>Target for Round</label><input id="wGoal" placeholder="e.g., Finish top of the group" />
      <label>Measured Metric</label><input id="wMetric" placeholder="e.g., Points / goal difference" />
      <div class="row">
        <div><label>Result</label><input id="wResult" placeholder="e.g., 3 pts / +2 GD" /></div>
        <div><label>Win %</label><input id="wSuccess" type="number" min="0" max="100" placeholder="e.g., 90" /></div>
      </div>
      <label>Notes</label><textarea id="wNotes" placeholder="Table movement, key result, what to improve next"></textarea>
      <button id="wSave">Save Round</button>
    </section>

    ${weeks.length ? `<section class="card"><div class="kicker">Saved Rounds</div>${
      weeks.map(w => `
        <div class="list-item" style="margin:10px 0;">
          <div>
            <strong>Round ${w.num}</strong> — <span class="small">${w.range}</span><br/>
            <span class="badge">${w.focus}</span> <span class="small">${w.goal}</span>
          </div>
          <div style="text-align:right;">
            ${w.success!=null?`<div><strong>${w.success}%</strong></div>`:''}
            <div class="small">${w.metric}</div>
          </div>
        </div>
      `).join('')
    }</section>` : ''}
  `;

  document.getElementById('wSave').addEventListener('click', () => {
    const week = {
      id: uid(),
      num: parseInt(document.getElementById('wNum').value, 10),
      range: document.getElementById('wRange').value,
      focus: document.getElementById('wFocus').value,
      goal: document.getElementById('wGoal').value,
      metric: document.getElementById('wMetric').value,
      result: document.getElementById('wResult').value,
      success: document.getElementById('wSuccess').value ? parseInt(document.getElementById('wSuccess').value, 10) : null,
      notes: document.getElementById('wNotes').value
    };
    const weeks = store.get('weeks', []);
    weeks.unshift(week);
    store.set('weeks', weeks);
    alert('Round saved ✅');
    renderWeekly();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'log') ensureFixtures().then(renderLog);
  if (tab === 'history') renderHistory();
  if (tab === 'weekly') renderWeekly();
}

// Tab listeners
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

// Seed and render initial
ensureFixtures().then(renderLog);

// If editing from history
const editing = store.get('editing', null);
if (editing) {
  switchTab('log');
  // Prefill after first render tick
  setTimeout(() => {
    document.getElementById('date').value = editing.date;
    document.getElementById('category').value = editing.category;
    const event = new Event('change');
    document.getElementById('category').dispatchEvent(event);
    setTimeout(()=>{
      document.getElementById('drill').value = editing.drill;
    }, 0);
    document.getElementById('result').value = editing.result || '';
    document.getElementById('mastery').value = editing.mastery || 3;
    document.getElementById('success').value = editing.success ?? '';
    document.getElementById('notes').value = editing.notes || '';
    // Clear edit flag
    store.set('editing', null);
  }, 50);
}
