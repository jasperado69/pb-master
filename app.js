const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

const DATA_KEY = 'borisBowlWatch';
const ADMIN_PIN = '0420';

const defaultState = {
  startDate: new Date().toISOString(),
  adminUnlocked: false,
  movements: [],
  bets: []
};

function getState() {
  return { ...defaultState, ...store.get(DATA_KEY, defaultState) };
}

function setState(next) {
  store.set(DATA_KEY, next);
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function pad(value) {
  return value.toString().padStart(2, '0');
}

function toDateInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(date, time) {
  return new Date(`${date}T${time || '00:00'}`).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function campaignEnd(state) {
  const start = new Date(state.startDate);
  return new Date(start.getTime() + (3 * 24 * 60 * 60 * 1000));
}

function remainingText(state) {
  const remaining = campaignEnd(state) - new Date();
  if (remaining <= 0) return 'Challenge complete';
  const hours = Math.floor(remaining / 36e5);
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

function sortedMovements(state) {
  return [...state.movements].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

function mapSrc(location) {
  if (location?.lat && location?.lng) {
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
  }
  return '';
}

function renderSummary(state) {
  const total = state.movements.length;
  const bets = state.bets.length;
  const latest = sortedMovements(state)[0];
  return `
    <section class="hero card">
      <div>
        <p class="eyebrow">Boris’s 3-day window</p>
        <h2>${remainingText(state)}</h2>
        <p class="small">Started ${new Date(state.startDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
      </div>
      <div class="stats">
        <div><strong>${total}</strong><span>logs</span></div>
        <div><strong>${bets}</strong><span>bets</span></div>
        <div><strong>${latest ? formatDateTime(latest.date, latest.time) : '—'}</strong><span>latest</span></div>
      </div>
    </section>
  `;
}

function renderMovementCard(item) {
  const src = mapSrc(item.location);
  return `
    <article class="card movement">
      <div class="list-item top-align">
        <div>
          <span class="badge">${item.type}</span>
          <h3>${formatDateTime(item.date, item.time)}</h3>
          <p class="small">${escapeHtml(item.location?.label || 'Location not recorded')}</p>
        </div>
        <div class="score">${item.confidence}/5</div>
      </div>
      ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}
      ${src ? `<iframe title="Map for ${escapeHtml(item.location?.label || 'Boris movement')}" class="map" loading="lazy" src="${src}"></iframe>` : '<p class="small">Add latitude and longitude in Boris Admin to show a map pin.</p>'}
    </article>
  `;
}

function renderDashboard() {
  const state = getState();
  const movements = sortedMovements(state);
  document.getElementById('app').innerHTML = `
    ${renderSummary(state)}
    <section class="card">
      <div class="section-title">
        <div><p class="eyebrow">Public feed</p><h2>Verified bowl movements</h2></div>
        <button class="secondary small-button" data-switch="bets">Make a bet</button>
      </div>
      ${movements.length ? movements.map(renderMovementCard).join('') : '<p>No Boris-confirmed movements yet. Ask the admin to log the first splash.</p>'}
    </section>
  `;
  bindTabLinks();
}

function renderAdmin() {
  const state = getState();
  const now = new Date();
  if (!state.adminUnlocked) {
    document.getElementById('app').innerHTML = `
      <section class="card narrow">
        <p class="eyebrow">Boris only</p>
        <h2>Admin unlock</h2>
        <p class="small">Demo PIN: ${ADMIN_PIN}. In a real shared app, put this behind proper authentication.</p>
        <label for="pin">PIN</label>
        <input id="pin" inputmode="numeric" placeholder="Enter Boris admin PIN" />
        <button id="unlock">Unlock Admin</button>
      </section>
    `;
    document.getElementById('unlock').addEventListener('click', () => {
      if (document.getElementById('pin').value === ADMIN_PIN) {
        setState({ ...state, adminUnlocked: true });
        renderAdmin();
      } else alert('Wrong PIN');
    });
    return;
  }

  document.getElementById('app').innerHTML = `
    ${renderSummary(state)}
    <section class="card">
      <p class="eyebrow">Boris admin</p>
      <h2>Log date, time, and location</h2>
      <div class="row">
        <div><label>Date</label><input id="date" type="date" value="${toDateInput(now)}" /></div>
        <div><label>Time</label><input id="time" type="time" value="${toTimeInput(now)}" /></div>
      </div>
      <label>Movement type</label>
      <select id="type"><option>Confirmed bowl movement</option><option>False alarm</option><option>Bonus round</option></select>
      <label>Location label</label>
      <input id="locationLabel" placeholder="Bathroom, coffee shop, airport gate..." />
      <div class="row">
        <div><label>Latitude</label><input id="lat" inputmode="decimal" placeholder="Optional" /></div>
        <div><label>Longitude</label><input id="lng" inputmode="decimal" placeholder="Optional" /></div>
        <div class="align-end"><button id="geo" class="secondary">Use my location</button></div>
      </div>
      <label>Confidence</label>
      <select id="confidence">${[5,4,3,2,1].map(n => `<option>${n}</option>`).join('')}</select>
      <label>Notes</label>
      <textarea id="notes" placeholder="Optional details for the friends..."></textarea>
      <button id="save">Save Boris Log</button>
      <button id="resetWindow" class="ghost">Restart 3-day window</button>
    </section>
  `;

  document.getElementById('geo').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocation is not available in this browser.');
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById('lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('lng').value = pos.coords.longitude.toFixed(6);
      if (!document.getElementById('locationLabel').value) document.getElementById('locationLabel').value = 'Current location';
    }, () => alert('Could not read location. You can type a label instead.'));
  });

  document.getElementById('save').addEventListener('click', () => {
    const movement = {
      id: uid(),
      date: document.getElementById('date').value,
      time: document.getElementById('time').value,
      type: document.getElementById('type').value,
      confidence: Number(document.getElementById('confidence').value),
      notes: document.getElementById('notes').value.trim(),
      location: {
        label: document.getElementById('locationLabel').value.trim(),
        lat: document.getElementById('lat').value.trim(),
        lng: document.getElementById('lng').value.trim()
      }
    };
    if (!movement.date || !movement.time) return alert('Date and time are required.');
    setState({ ...getState(), movements: [movement, ...getState().movements] });
    alert('Boris log saved ✅');
    renderAdmin();
  });

  document.getElementById('resetWindow').addEventListener('click', () => {
    if (confirm('Restart the 3-day challenge window? Existing logs and bets stay saved.')) {
      setState({ ...getState(), startDate: new Date().toISOString() });
      renderAdmin();
    }
  });
}

function renderBets() {
  const state = getState();
  const bets = [...state.bets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById('app').innerHTML = `
    ${renderSummary(state)}
    <section class="card">
      <p class="eyebrow">Friends table</p>
      <h2>Place a bet</h2>
      <div class="row">
        <div><label>Name</label><input id="bettor" placeholder="Your name" /></div>
        <div><label>Stake</label><input id="stake" placeholder="$5, coffee, bragging rights..." /></div>
      </div>
      <label>Prediction</label>
      <textarea id="prediction" placeholder="Example: 2 confirmed bowl movements before Saturday noon, one at Chipotle."></textarea>
      <button id="betSave">Lock in bet</button>
    </section>
    <section class="card">
      <p class="eyebrow">Bet board</p>
      ${bets.length ? bets.map(bet => `<div class="bet"><strong>${escapeHtml(bet.name)}</strong><span>${escapeHtml(bet.stake || 'No stake')}</span><p>${escapeHtml(bet.prediction)}</p><p class="small">${new Date(bet.createdAt).toLocaleString()}</p></div>`).join('') : '<p>No bets yet. Be first on the board.</p>'}
    </section>
  `;
  document.getElementById('betSave').addEventListener('click', () => {
    const bet = {
      id: uid(),
      name: document.getElementById('bettor').value.trim(),
      stake: document.getElementById('stake').value.trim(),
      prediction: document.getElementById('prediction').value.trim(),
      createdAt: new Date().toISOString()
    };
    if (!bet.name || !bet.prediction) return alert('Name and prediction are required.');
    setState({ ...getState(), bets: [bet, ...getState().bets] });
    renderBets();
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'admin') renderAdmin();
  if (tab === 'bets') renderBets();
}

function bindTabLinks() {
  document.querySelectorAll('[data-switch]').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.switch));
  });
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

switchTab('dashboard');
