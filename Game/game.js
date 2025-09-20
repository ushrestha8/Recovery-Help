// The application of this game is to be used in cases
// for hospitalized children to adults who have gone through a life-threatening
// event such as an accident. The objective of this game is to measure 
// the motor functions of a person during the period of recovery
//
// This game measures three performance skills:
// 1) Average speed: measured in seconds
// 2) Misses & Errors: The Misses and errors within a session or level of the game
// 3) Range of Motion: Identifies the zones that the patient goes to retrieve an element to be scored

// ---------------- DOM refs are set inside initInjuryGame() ----------------
let canvas, ctx, levelInfo, rewardInfo, nextLevelBtn, statsDiv;

// Game variables (kept global so handlers can access)
let level = 1;
let orbs = [];
let draggingOrb = null;
let dragOffset = {x:0, y:0};
let dragon = { x: 480, y: 270, radius: 60 }; // will be updated once canvas exists
const MAX_LEVEL = 10;

// Dynamic level scaling function
function getLevelConfig(lvl) {
  return {
    orbCount: Math.min(lvl, MAX_LEVEL),   // Level 1 -> 1 orb, up to 10
    orbRadius: Math.max(40 - lvl * 2, 20),
    speed: Math.max(1200 - lvl * 50, 500)
  };
}

let obstacles = [];
let colorSequence = [];
let requiredSequenceIndex = 0;
let stats = {
  speed: [],
  accuracy: 0,
  rangeOfMotion: new Set()
};
let levelStartedAt = null;
let rewards = [
  'Dragon gets shiny armor!',
  'Dragon earns a glowing scale!',
  'Dragon explores a new magical forest!',
  'Dragon finds a treasure chest!',
  'Dragon learns to fly higher!',
];
let currentReward = null;
let gameActive = false;

// ---- Geometry helpers for spawn/path checks ----
function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const s1x = bx - ax, s1y = by - ay;
    const s2x = dx - cx, s2y = dy - cy;
    const denom = (s2x * s1y - s2y * s1x);
    if (denom === 0) return false;
    const s = (-s1y * (ax - cx) + s1x * (ay - cy)) / denom;
    const t = ( s2x * (ay - cy) - s2y * (ax - cx)) / denom;
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
  }
  const left   = segSeg(x1,y1,x2,y2, rx,    ry,     rx,    ry+rh);
  const right  = segSeg(x1,y1,x2,y2, rx+rw, ry,     rx+rw, ry+rh);
  const top    = segSeg(x1,y1,x2,y2, rx,    ry,     rx+rw, ry);
  const bottom = segSeg(x1,y1,x2,y2, rx,    ry+rh,  rx+rw, ry+rh);
  const inside = (x1 >= rx && x1 <= rx+rw && y1 >= ry && y1 <= ry+rh);
  return inside || left || right || top || bottom;
}

// Returns true if the segment (x1,y1)->(x2,y2) crosses any rectangle in `rects`
function segmentHitsAnyRect(x1, y1, x2, y2, rects) {
  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const s1x = bx - ax, s1y = by - ay;
    const s2x = dx - cx, s2y = dy - cy;
    const denom = (s2x * s1y - s2y * s1x);
    if (denom === 0) return false;
    const s = (-s1y * (ax - cx) + s1x * (ay - cy)) / denom;
    const t = ( s2x * (ay - cy) - s2y * (ax - cx)) / denom;
    return s >= 0 && s <= 1 && t >= 0 && t <= 1;
  }
  for (const r of rects) {
    const rx=r.x, ry=r.y, rw=r.w, rh=r.h;
    if (segSeg(x1,y1,x2,y2, rx,ry, rx,ry+rh)) return true;
    if (segSeg(x1,y1,x2,y2, rx+rw,ry, rx+rw,ry+rh)) return true;
    if (segSeg(x1,y1,x2,y2, rx,ry, rx+rw,ry)) return true;
    if (segSeg(x1,y1,x2,y2, rx,ry+rh, rx+rw,ry+rh)) return true;
    if (x1 >= rx && x1 <= rx+rw && y1 >= ry && y1 <= ry+rh) return true;
  }
  return false;
}

// Utility: randomized position with constraints
function randomPos(radius) {
  const EXCLUDE_R = dragon.radius + Math.max(70, radius + 24); // bigger safe bubble around dragon
  const ORB_PAD   = 10;    // gap vs other orbs
  const OB_PAD    = radius + 24; // inflate obstacles generously
  const MOVE_PAD  = 30;    // widen obstacles along movement axis (horizontal)

  const inflated = obstacles.map(o => ({
    x: o.x - (OB_PAD + MOVE_PAD), y: o.y - OB_PAD,
    w: o.w + 2*(OB_PAD + MOVE_PAD), h: o.h + 2*OB_PAD
  }));

  function overlapsExisting(x, y) {
    for (const o of orbs) {
      if (!o.fed) {
        const dx = x - o.x, dy = y - o.y;
        const minD = (radius + o.radius + ORB_PAD);
        if (dx*dx + dy*dy < minD*minD) return true;
      }
    }
    return false;
  }
  function insideInflatedObstacle(x, y) {
    return inflated.some(r =>
      x + radius > r.x && x - radius < r.x + r.w &&
      y + radius > r.y && y - radius < r.y + r.h
    );
  }
  function hasClearRayToDragon(x, y) {
    const R = Math.max(10, dragon.radius - 8);
    const samples = 12;
    for (let k = 0; k < samples; k++) {
      const a = (Math.PI * 2) * (k / samples);
      const tx = dragon.x + R * Math.cos(a);
      const ty = dragon.y + R * Math.sin(a);
      if (!segmentHitsAnyRect(x, y, tx, ty, inflated)) return true;
    }
    return false;
  }

  for (let tries = 0; tries < 300; tries++) {
    const x = radius + 12 + Math.random() * (canvas.width  - 2*radius - 24);
    const y = radius + 12 + Math.random() * (canvas.height - 2*radius - 24);

    const dx = x - dragon.x, dy = y - dragon.y;
    if ((dx*dx + dy*dy) < EXCLUDE_R*EXCLUDE_R) continue;
    if (insideInflatedObstacle(x, y)) continue;
    if (overlapsExisting(x, y)) continue;
    if (!hasClearRayToDragon(x, y)) continue;
    return { x, y };
  }

  for (let tries = 0; tries < 50; tries++) {
    const x = radius + 12 + Math.random() * (canvas.width  - 2*radius - 24);
    const y = (Math.random() < 0.5) ? (radius + 12) : (canvas.height - radius - 12);
    const dx = x - dragon.x, dy = y - dragon.y;
    if ((dx*dx + dy*dy) < EXCLUDE_R*EXCLUDE_R) continue;
    if (insideInflatedObstacle(x, y)) continue;
    if (overlapsExisting(x, y)) continue;
    if (!hasClearRayToDragon(x, y)) continue;
    return { x, y };
  }

  const corners = [
    { x: radius + 16, y: radius + 16 },
    { x: canvas.width - radius - 16, y: radius + 16 },
    { x: radius + 16, y: canvas.height - radius - 16 },
    { x: canvas.width - radius - 16, y: canvas.height - radius - 16 },
  ];
  for (const c of corners) {
    const dx = c.x - dragon.x, dy = c.y - dragon.y;
    if ((dx*dx + dy*dy) < EXCLUDE_R*EXCLUDE_R) continue;
    if (insideInflatedObstacle(c.x, c.y)) continue;
    if (overlapsExisting(c.x, c.y)) continue;
    if (!hasClearRayToDragon(c.x, c.y)) continue;
    return c;
  }
  return { x: dragon.x + EXCLUDE_R + radius + 5, y: radius + 20 };
}

function setupLevel(lvl) {
  if (typeof MAX_LEVEL !== 'undefined' && lvl > MAX_LEVEL) {
    gameActive = false;
    if (nextLevelBtn) nextLevelBtn.style.display = 'none';
    if (statsDiv) statsDiv.textContent = "🎉 Congratulations! You've completed all 10 levels!";
    return;
  }
  gameActive = true;
  orbs = [];
  stats.speed = [];
  stats.accuracy = 0;
  stats.rangeOfMotion = new Set();
  levelStartedAt = Date.now();
  requiredSequenceIndex = 0;
  colorSequence = [];
  obstacles = [];

  let cfg = getLevelConfig(lvl);
  // For levels 3+, add obstacles and color sequence
  if (lvl >= 3) {
    obstacles = [
      {x: 320, y: 180, w: 80, h: 160, dx: 2, dir: 1},
      {x: 520, y: 330, w: 80, h: 100, dx: -2, dir: -1}
    ];
    // Add color sequence
    let colors = ['#ffd700','#00e6ff','#ff6b81'];
    for (let i=0; i<cfg.orbCount; i++) {
      colorSequence.push(colors[i % colors.length]);
    }
  }

  for (let i=0; i<cfg.orbCount; i++) {
    let pos = randomPos(cfg.orbRadius);
    let color = lvl >= 3 ? colorSequence[i] : '#ffd700'; // gold
    orbs.push({
      x: pos.x,
      y: pos.y,
      radius: cfg.orbRadius,
      color,
      fed: false,
      id: i,
      placedAt: Date.now()
    });
    stats.rangeOfMotion.add(`${Math.round(pos.x)},${Math.round(pos.y)}`);
  }

  drawGame();
  if (levelInfo) levelInfo.textContent = "Level: " + lvl;
  if (rewardInfo) rewardInfo.textContent = "";
  if (nextLevelBtn) nextLevelBtn.style.display = "none";
  if (statsDiv) statsDiv.textContent = "";
}

function drawGame() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Draw dragon
  ctx.save();
  ctx.beginPath();
  ctx.arc(dragon.x, dragon.y, dragon.radius, 0, 2*Math.PI);
  ctx.fillStyle = '#6c3ec1';
  ctx.shadowColor = "#8ee0ea";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = "36px Comic Sans MS";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("🐉", dragon.x, dragon.y+15);
  ctx.restore();

  // Obstacles
  obstacles.forEach(o => {
    ctx.save();
    ctx.fillStyle = "#9b5ded";
    ctx.globalAlpha = 0.7;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.restore();
  });

  // ---- Color helpers for prettier orbs (scoped here) ----
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return {r:255,g:215,b:0};
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }
  function rgbToHex(r,g,b){
    const c = v => ('0' + Math.max(0,Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + c(r)+c(g)+c(b);
  }
  function lighten(hex, amt=0.2){
    const {r,g,b} = hexToRgb(hex);
    return rgbToHex(r + (255 - r)*amt, g + (255 - g)*amt, b + (255 - b)*amt);
  }
  function darken(hex, amt=0.2){
    const {r,g,b} = hexToRgb(hex);
    return rgbToHex(r*(1-amt), g*(1-amt), b*(1-amt));
  }
  function luminance(hex){
    const {r,g,b} = hexToRgb(hex);
    const a = [r,g,b].map(v => {
      v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
    });
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  }
  function idealTextColor(bgHex){ return luminance(bgHex) > 0.5 ? '#111' : '#fff'; }

  // Orbs
  orbs.forEach((orb, i) => {
    if (!orb.fed) {
      const base = orb.color || '#ffd700';
      const lighter = lighten(base, 0.35);
      const darker  = darken(base, 0.35);
      const grad = ctx.createRadialGradient(
        orb.x - orb.radius*0.35, orb.y - orb.radius*0.35, orb.radius*0.2,
        orb.x, orb.y, orb.radius
      );
      grad.addColorStop(0, lighter);
      grad.addColorStop(1, base);

      ctx.save();
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.shadowColor = lighter;
      ctx.shadowBlur = 18;
      ctx.fill();

      // Rim
      ctx.lineWidth = Math.max(2, orb.radius*0.12);
      ctx.strokeStyle = darker;
      ctx.stroke();

      // Gloss
      ctx.beginPath();
      ctx.arc(orb.x - orb.radius*0.35, orb.y - orb.radius*0.35, orb.radius*0.35, 0, Math.PI*2);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.globalAlpha = 1;

      // Number INSIDE the orb (1-based)
      const label = String((orb.id ?? i) + 1);
      ctx.font = `${Math.round(orb.radius * 0.9)}px Arial`;
      ctx.fillStyle = idealTextColor(base);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, orb.x, orb.y + (orb.radius * 0.03));
      ctx.restore();
    }
  });
}

function gameLoop() {
  // Animate obstacles
  obstacles.forEach(o => {
    o.x += o.dx * o.dir;
    if (o.x < 0 || o.x + o.w > canvas.width) o.dir *= -1;
  });
  drawGame();
  if (gameActive) requestAnimationFrame(gameLoop);
}

// ---------------- Input handlers ----------------
function getEventPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  if (e.touches && e.touches[0]) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top)  * scaleY
    };
  }
  // mouse
  const clientX = (e.clientX !== undefined) ? e.clientX : (e.pageX - window.scrollX);
  const clientY = (e.clientY !== undefined) ? e.clientY : (e.pageY - window.scrollY);
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY
  };
}

function startDrag(e) {
  if (!gameActive) return;
  let pos = getEventPos(e);
  let orb = orbs.find(o => !o.fed && dist(pos, o) <= o.radius);
  if (orb) {
    draggingOrb = orb;
    dragOffset.x = pos.x - orb.x;
    dragOffset.y = pos.y - orb.y;
    orb.dragStartedAt = Date.now();
  }
}
function dragOrb(e) {
  if (!gameActive || !draggingOrb) return;
  e.preventDefault();
  let pos = getEventPos(e);
  let newX = pos.x - dragOffset.x;
  let newY = pos.y - dragOffset.y;
  if (!collidesWithObstacle(newX, newY, draggingOrb.radius)) {
    draggingOrb.x = newX;
    draggingOrb.y = newY;
    drawGame();
  } else {
    stats.accuracy++;
  }
}
function endDrag(e) {
  if (!gameActive || !draggingOrb) return;
  let pos = getEventPos(e);
  if (dist({x:dragon.x, y:dragon.y}, draggingOrb) < dragon.radius-10) {
    if (level >= 3 && draggingOrb.id !== requiredSequenceIndex) {
      stats.accuracy++;
      const p = randomPos(draggingOrb.radius);
      draggingOrb.x = p.x; draggingOrb.y = p.y;
    } else {
      let timeTaken = Date.now() - draggingOrb.dragStartedAt;
      stats.speed.push(timeTaken/1000);
      draggingOrb.fed = true;
      requiredSequenceIndex++;
    }
  } else {
    stats.accuracy++;
    const p = randomPos(draggingOrb.radius);
    draggingOrb.x = p.x; draggingOrb.y = p.y;
  }
  draggingOrb = null;
  drawGame();
  checkLevelEnd();
}

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function collidesWithObstacle(x, y, radius) {
  return obstacles.some(o =>
    x+radius > o.x && x-radius < o.x+o.w &&
    y+radius > o.y && y-radius < o.y+o.h
  );
}

function checkLevelEnd() {
    if (orbs.every(o => o.fed)) {
        gameActive = false;
        showStats();
        // Show the correct button depending on if the game is over
        if (level < levelConfig.length) {
            nextLevelBtn.style.display = "inline-block";
        }
        // Always show the dashboard button after a level is complete
        viewDashboardBtn.style.display = "inline-block";
    }
}
    if (level < MAX_LEVEL) {
      if (nextLevelBtn) nextLevelBtn.style.display = "inline-block";
    } else {
      if (nextLevelBtn) nextLevelBtn.style.display = "none";
      if (statsDiv) statsDiv.textContent += "🎉 Congratulations! You've completed all 10 levels!";
    }
  }
}

// function showStats() {
//  let speedAvg = stats.speed.length > 0 ? (stats.speed.reduce((a,b)=>a+b,0)/stats.speed.length).toFixed(2) : 0;
//  let range = stats.rangeOfMotion.size;
//  let acc = stats.accuracy;
//  if (statsDiv) {
//    statsDiv.innerHTML = `
//      <strong>Performance:</strong><br>
//      Average Speed: <b>${speedAvg}s</b><br>
//      Misses/Errors: <b>${acc}</b><br>
//      Range of Motion: <b>${range} zones</b>
//    `;
//  }
//}
function showStats() {
    let speedAvg = stats.speed.length > 0 ? (stats.speed.reduce((a, b) => a + b, 0) / stats.speed.length).toFixed(2) : 0;
    statsDiv.innerHTML = `
        <strong>Level ${level} Complete!</strong><br>
        Average Speed: <b>${speedAvg}s</b> | Misses/Errors: <b>${stats.accuracy}</b>
    `;

    // --- ADD THESE LINES to save the level results ---
    levelHistory.push({
        level: level,
        misses: stats.accuracy,
        avgTime: parseFloat(speedAvg)
    });
}

function giveReward() {
  currentReward = rewards[Math.min(level-1, rewards.length-1)];
  if (rewardInfo) rewardInfo.textContent = "Reward: " + currentReward;
}

// ---------------- One-time DOM binding ----------------
let _listenersBound = false;
function bindDomOnce() {
  if (_listenersBound) return;
  canvas.addEventListener('mousedown', startDrag);
  canvas.addEventListener('touchstart', startDrag, {passive:false});
  canvas.addEventListener('mousemove', dragOrb);
  canvas.addEventListener('touchmove', dragOrb, {passive:false});
  canvas.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchend', endDrag);
  if (nextLevelBtn) {
    nextLevelBtn.addEventListener('click', () => {
      if (level < MAX_LEVEL) {
        level++;
        setupLevel(level);
        requestAnimationFrame(gameLoop);
      }
    });
  }
  _listenersBound = true;
}

// ---------------- PUBLIC INIT (call this from Dashboard) ----------------
window.initInjuryGame = function () {
  // Look up DOM every time in case the Dashboard re-rendered
  canvas = document.getElementById('game-canvas');
  levelInfo = document.getElementById('level-info');
  rewardInfo = document.getElementById('reward-info');
  nextLevelBtn = document.getElementById('next-level-btn');
  statsDiv = document.getElementById('stats');

  if (!canvas) {
    console.error('Game canvas not found. Ensure #game-canvas exists on the Dashboard.');
    return;
  }
  ctx = canvas.getContext('2d');
const viewDashboardBtn = document.getElementById('view-dashboard-btn');
const backToGameBtn = document.getElementById('back-to-game-btn');
const gameContainer = document.getElementById('game-container');
const dashboardContainer = document.getElementById('dashboard-container');

// --- ADD THIS ARRAY to store results from each level ---
let levelHistory = [];
let missesChart, timeChart; // To hold our chart instances
  // Center dragon based on current canvas size
  dragon.x = canvas.width / 2;
  dragon.y = canvas.height / 2;

  // Optional: respect preset start level
  if (typeof window.__IRT_START_LEVEL === 'number') {
    level = Math.max(1, Math.min(10, window.__IRT_START_LEVEL));
  } else {
    level = 1;
  }
// Functions to show/hide the dashboard
viewDashboardBtn.addEventListener('click', () => {
    gameContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    renderCharts(); // Draw the charts when dashboard is viewed
});

backToGameBtn.addEventListener('click', () => {
    dashboardContainer.style.display = 'none';
    gameContainer.style.display = 'block';
});

// Function to draw the graphs
function renderCharts() {
    const labels = levelHistory.map(h => `Level ${h.level}`);
    const missesData = levelHistory.map(h => h.misses);
    const timeData = levelHistory.map(h => h.avgTime);

    if (missesChart) missesChart.destroy();
    if (timeChart) timeChart.destroy();

    const missesCtx = document.getElementById('missesChart').getContext('2d');
    missesChart = new Chart(missesCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Misses / Errors per Level',
                data: missesData,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true, tension: 0.1
            }]
        }
    });

    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Time per Orb (seconds)',
                data: timeData,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: true, tension: 0.1
            }]
        }
    });
}
  // Bind inputs once, then (re)start the game
  bindDomOnce();
  setupLevel(level);
  gameActive = true;
  requestAnimationFrame(gameLoop);
};

// ---------------- IMPORTANT ----------------
// Remove the old auto-start lines that were at the bottom:
//   setupLevel(level);
//   requestAnimationFrame(gameLoop);
//
// The game now starts when your Dashboard calls:
//   if (typeof window.initInjuryGame === 'function') window.initInjuryGame();
