// app.js — Dashboard (game), Calendar (journal), Results. LocalStorage only.

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------
const JOURNAL_KEY = 'irt:journal'; // { "YYYY-MM-DD": { mood, wellbeing, pain, notes, date } }
function loadJournal() { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '{}'); }
function saveJournal(j) { localStorage.setItem(JOURNAL_KEY, JSON.stringify(j)); }

// Optional: sessions (used when game posts results)
const SESS_KEY = 'irt:sessions';
function saveSession(s) {
  const arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
  arr.push(s);
  localStorage.setItem(SESS_KEY, JSON.stringify(arr));
}
function loadSessions(limit = 50) {
  const arr = JSON.parse(localStorage.getItem(SESS_KEY) || '[]');
  return arr.slice(-limit);
}

// -----------------------------------------------------------------------------
// Router
// -----------------------------------------------------------------------------
const app = document.getElementById('app');

function router() {
  const route = (location.hash || '#/dashboard').replace('#','');
  if (route.startsWith('/dashboard')) return DashboardPage();
  if (route.startsWith('/calendar'))  return CalendarPage();
  if (route.startsWith('/results'))   return ResultsPage();
  app.innerHTML = `<section class="panel"><h1>Not Found</h1></section>`;
}
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// -----------------------------------------------------------------------------
// Pages
// -----------------------------------------------------------------------------
function DashboardPage() {
  app.innerHTML = `
    <section class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <div><h1>Dashboard</h1><p>Play the game here. Use the Calendar tab to log wellbeing.</p></div>
        <div class="row" style="gap:8px">
          <a class="btn secondary" href="#/calendar">Calendar</a>
          <a class="btn secondary" href="#/results">Results</a>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <div class="row" style="gap:8px;">
            <h2 style="margin:0">Game</h2>
            <span class="badge">Live</span>
          </div>
          <button class="btn secondary" id="reset-game">Reset</button>
        </div>

        <div class="canvas-wrap" style="margin-top:8px">
          <!-- IDs expected by game.js -->
          <div id="level-info"></div>
          <div id="reward-info"></div>
          <canvas id="game-canvas" width="960" height="420"></canvas>
          <button id="next-level-btn" class="btn">Next Level</button>
          <div id="stats"></div>
        </div>
      </div>
    </section>
  `;

  // Init game AFTER DOM is present
  if (typeof window.initInjuryGame === 'function') {
    window.initInjuryGame();
  } else {
    console.warn("initInjuryGame() not found. Ensure ./game/game.js defines it.");
  }

  // Optional session hook (your game may call this later)
  window.onGameSessionComplete = (payload) => {
    const s = {
      date: payload?.date || new Date().toISOString(),
      level: Number(payload?.level || 1),
      metrics: {
        avgSpeedSec: Number(payload?.avgSpeedSec || 0),
        errors: Number(payload?.errors || 0),
        romZones: Number(payload?.romZones || 0)
      },
      recoveryIndex: Number(payload?.recoveryIndex ?? 0.5)
    };
    saveSession(s);
    location.hash = '#/results';
  };

  // Reset
  document.getElementById('reset-game')?.addEventListener('click', () => {
    if (typeof window.initInjuryGame === 'function') window.initInjuryGame();
  });
}

function CalendarPage() {
  const today = ymd(new Date());
  const j = loadJournal();
  const selected = j[today] || { date: today, mood: 3, wellbeing: 'okay', pain: '', notes: '' };

  app.innerHTML = `
    <section class="panel">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <div><h1>Calendar</h1><p>Track mood, wellbeing and pain daily.</p></div>
        <a class="btn secondary" href="#/dashboard">Back to Game</a>
      </div>

      <div class="grid grid-2" style="margin-top:12px">
        <!-- Calendar -->
        <div class="card">
          <h2>Monthly View</h2>
          <div id="calendar" class="calendar" style="margin-top:8px"></div>
        </div>

        <!-- Daily Check-in -->
        <div class="card">
          <h2>Daily Check-in</h2>
          <form id="checkin-form" class="grid" style="gap:10px">
            <div>
              <label for="mood">Mood (1–5)</label>
              <input id="mood" class="input" type="range" min="1" max="5" value="${selected.mood}" />
              <div class="row" style="justify-content:space-between;">
                <small>😞 1</small><small>😐 3</small><small>😊 5</small>
              </div>
            </div>

            <div>
              <label for="wellbeing">Wellbeing</label>
              <select id="wellbeing" class="input">
                ${['great','good','okay','meh','poor'].map(v => `<option ${v===selected.wellbeing?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>

            <div>
              <label for="pain">Pain (optional — area or 0–10)</label>
              <input id="pain" class="input" placeholder="e.g., left knee 3/10" value="${escapeHtml(selected.pain||'')}" />
            </div>

            <div>
              <label for="notes">Notes</label>
              <textarea id="notes" rows="4" class="input" placeholder="How is everything going?">${escapeHtml(selected.notes||'')}</textarea>
            </div>

            <div class="row" style="justify-content:flex-end;">
              <button class="btn" type="submit">Save</button>
            </div>
          </form>
          <div id="save-msg" style="margin-top:8px; color:#93c5fd;"></div>
        </div>
      </div>
    </section>
  `;

  // Calendar
  const calEl = document.getElementById('calendar');
  const state = { cursor: new Date(), selected: new Date(today) };
  drawCalendar(calEl, state, loadJournal());

  // Save check-in
  document.getElementById('checkin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const day = ymd(state.selected);
    const journal = loadJournal();
    journal[day] = {
      date: day,
      mood: Number(document.getElementById('mood').value),
      wellbeing: document.getElementById('wellbeing').value,
      pain: document.getElementById('pain').value.trim(),
      notes: document.getElementById('notes').value.trim()
    };
    saveJournal(journal);
    document.getElementById('save-msg').textContent = `Saved ${day} ✔`;
    drawCalendar(calEl, state, journal);
  });
}

function ResultsPage() {
  const j = loadJournal();
  const days = Object.keys(j).sort();
  const latest = days.length ? j[days.at(-1)] : null;

  const sessions = loadSessions(30);
  const last = sessions.at(-1);

  app.innerHTML = `
    <section class="panel">
      <div class="row" style="justify-content:space-between;">
        <div><h1>Results</h1><p>Summary of your check-ins${sessions.length ? ' and recent game sessions' : ''}.</p></div>
        <a class="btn secondary" href="#/dashboard">Dashboard</a>
      </div>

      <div class="grid grid-3" style="margin-top:12px">
        <div class="card">
          <h2>Latest Check-in</h2>
          ${latest ? renderEntry(latest) : '<p>No entries yet.</p>'}
        </div>
        <div class="card">
          <h2>Average Mood</h2>
          <p style="font-size:40px; margin: 12px 0;">${avg(Object.values(j).map(e => e.mood || 0)).toFixed(1)}</p>
          <p class="badge">${Object.keys(j).length} days logged</p>
        </div>
        <div class="card">
          <h2>Wellbeing Breakdown</h2>
          ${renderWellbeingBars(Object.values(j))}
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <h2>Recent Game Sessions (last 10)</h2>
        ${sessions.length ? `
          <table class="table">
            <thead><tr><th>Date</th><th>Level</th><th>Avg Speed (s)</th><th>Errors</th><th>ROM</th><th>RI</th></tr></thead>
            <tbody>
              ${sessions.slice(-10).reverse().map(s => `
                <tr>
                  <td>${(s.date||'').slice(0,10)}</td>
                  <td>${s.level}</td>
                  <td>${(s.metrics?.avgSpeedSec||0).toFixed(2)}</td>
                  <td>${s.metrics?.errors||0}</td>
                  <td>${s.metrics?.romZones||0}</td>
                  <td>${Math.round((s.recoveryIndex||0)*100)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No sessions yet.</p>'}
      </div>
    </section>
  `;
}

// -----------------------------------------------------------------------------
// Calendar rendering
// -----------------------------------------------------------------------------
function drawCalendar(root, state, journal) {
  const cur = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  const year = cur.getFullYear();
  const month = cur.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayStr = ymd(new Date());
  const selectedStr = ymd(state.selected);

  root.innerHTML = `
    <div class="cal-head">
      <button class="btn secondary" id="prev-month">◀</button>
      <div><strong>${cur.toLocaleString(undefined,{month:'long'})}</strong> ${year}</div>
      <button class="btn secondary" id="next-month">▶</button>
    </div>
    <div class="cal-grid">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}
      ${Array.from({length:firstDow}).map(()=>'<div></div>').join('')}
      ${Array.from({length:daysInMonth}, (_,i)=>{
        const d = i+1;
        const dateStr = ymd(new Date(year, month, d));
        const has = Boolean(journal[dateStr]);
        const isToday = dateStr === todayStr;
        const isSel = dateStr === selectedStr;
        const cls = ['cal-cell', has?'has-entry':'', isToday?'today':'', isSel?'selected':''].join(' ').trim();
        return `<div class="${cls}" data-date="${dateStr}">${d}</div>`;
      }).join('')}
    </div>
  `;

  root.querySelector('#prev-month').onclick = () => {
    state.cursor = new Date(year, month-1, 1);
    drawCalendar(root, state, journal);
  };
  root.querySelector('#next-month').onclick = () => {
    state.cursor = new Date(year, month+1, 1);
    drawCalendar(root, state, journal);
  };
  root.querySelectorAll('.cal-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      state.selected = new Date(cell.dataset.date);
      // load selected day into form (if present)
      const j = loadJournal();
      const e = j[cell.dataset.date] || { date: cell.dataset.date, mood: 3, wellbeing: 'okay', pain:'', notes:'' };
      const mood = document.getElementById('mood');
      if (mood) {
        document.getElementById('mood').value = e.mood;
        document.getElementById('wellbeing').value = e.wellbeing;
        document.getElementById('pain').value = e.pain || '';
        document.getElementById('notes').value = e.notes || '';
      }
      drawCalendar(root, state, j);
    });
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function ymd(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10); }
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function renderEntry(e){
  return `<p><strong>${e.date}</strong></p>
          <p>Mood: ${e.mood}/5</p>
          <p>Wellbeing: ${e.wellbeing}</p>
          <p>Pain: ${escapeHtml(e.pain||'—')}</p>
          <p>Notes: ${escapeHtml(e.notes||'—')}</p>`;
}
function renderWellbeingBars(entries){
  if (!entries.length) return '<p>No data yet.</p>';
  const counts = entries.reduce((acc, e) => (acc[e.wellbeing]=(acc[e.wellbeing]||0)+1, acc), {});
  const all = ['great','good','okay','meh','poor'];
  const total = entries.length || 1;
  return all.map(k=>{
    const n = counts[k]||0; const pct = Math.round((n/total)*100);
    return `<div style="margin:8px 0;">
      <div class="row" style="justify-content:space-between;">
        <span>${k}</span><span>${n} (${pct}%)</span>
      </div>
      <div style="height:8px; background:#0b1530; border:1px solid #203260; border-radius:999px; overflow:hidden;">
        <div style="height:100%; width:${pct}%; background:#60a5fa;"></div>
      </div>
    </div>`;
  }).join('');
}

//theme toggle icon
const toggleButton = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
let isDark = false;

toggleButton.addEventListener('click', () => {
    isDark = !isDark;
    
    // Toggle the dark theme class on the body
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);

    // Change the icon based on the theme
    if (isDark) {
        themeIcon.src = "./img/mode.png";  // Dark theme icon
        themeIcon.alt = 'Dark theme';
    } else {
        themeIcon.src = "./img/dark-mode.png";  // Light theme icon
        themeIcon.alt = 'Light theme';
    }
});

