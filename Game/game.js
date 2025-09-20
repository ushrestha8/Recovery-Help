// The application of this game is to be used in cases
// for hositalized children to adults who have gone through a life-threatening
// event such as an accident. The objective of this game is to measure and improve
// the motor functions of a person.
//
// This game measures three performance skills:
// 1) Average speed: measured in seconds
// 2) Misses & Errors: The Misses and erros within a session or level of the game
// 3) Range of Motion: Identifies the zones that the patient goes to retreive an element to be scored

//code start:

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelInfo = document.getElementById('level-info');
const rewardInfo = document.getElementById('reward-info');
const nextLevelBtn = document.getElementById('next-level-btn');
const statsDiv = document.getElementById('stats');

// Game variables
let level = 1;
let orbs = [];
let draggingOrb = null;
let dragOffset = {x:0, y:0};
let dragon = { x: canvas.width/2, y: canvas.height/2, radius: 60 };
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

// Utility
function randomPos(radius) {
    // Place orbs in corners and random locations
    const positions = [
        {x: radius+10, y: radius+10},
        {x: canvas.width-radius-10, y: radius+10},
        {x: radius+10, y: canvas.height-radius-10},
        {x: canvas.width-radius-10, y: canvas.height-radius-10}
    ];
    if (orbs.length < 4) return positions[orbs.length];
    // Random anywhere
    return {
        x: Math.random() * (canvas.width-radius*2) + radius,
        y: Math.random() * (canvas.height-radius*2) + radius
    };
}

function setupLevel(lvl) {
    if (typeof MAX_LEVEL !== 'undefined' && lvl > MAX_LEVEL) {
        gameActive = false;
        nextLevelBtn.style.display = 'none';
        statsDiv.textContent = "🎉 Congratulations! You've completed all 10 levels!";
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
        /// Add color sequence
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
    levelInfo.textContent = "Level: " + lvl;
    rewardInfo.textContent = "";
    nextLevelBtn.style.display = "none";
    statsDiv.textContent = "";
}

function drawGame() {
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

    // Orbs
    orbs.forEach((orb, i) => {
        if (!orb.fed) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.radius, 0, 2*Math.PI);
            ctx.fillStyle = orb.color;
            ctx.shadowColor = "#fff";
            ctx.shadowBlur = 20;
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.font = "18px Arial";
            ctx.fillStyle = "#333";
            ctx.textAlign = "center";
            ctx.fillText("✨", orb.x, orb.y+7);
            ctx.restore();
            // If color sequence needed
            if (level >= 3) {
                ctx.save();
                ctx.font = "12px Arial";
                ctx.fillStyle = "#222";
                ctx.textAlign = "center";
                ctx.fillText(`${i+1}`, orb.x, orb.y-orb.radius-8);
                ctx.restore();
            }
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

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('touchstart', startDrag);
canvas.addEventListener('mousemove', dragOrb);
canvas.addEventListener('touchmove', dragOrb);
canvas.addEventListener('mouseup', endDrag);
canvas.addEventListener('touchend', endDrag);

function getEventPos(e) {
    if (e.touches) {
        return { x: e.touches[0].clientX-canvas.getBoundingClientRect().left,
                 y: e.touches[0].clientY-canvas.getBoundingClientRect().top };
    }
    return { x: e.offsetX, y: e.offsetY };
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
    // Move orb, check collision with obstacles
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
    // Check if dropped on dragon
    if (dist({x:dragon.x, y:dragon.y}, draggingOrb) < dragon.radius-10) {
        // If level 3+ check sequence
        if (level >= 3 && draggingOrb.id !== requiredSequenceIndex) {
            stats.accuracy++;
            draggingOrb.x = randomPos(draggingOrb.radius).x;
            draggingOrb.y = randomPos(draggingOrb.radius).y;
        } else {
            let timeTaken = Date.now() - draggingOrb.dragStartedAt;
            stats.speed.push(timeTaken/1000);
            draggingOrb.fed = true;
            requiredSequenceIndex++;
        }
    } else {
        stats.accuracy++;
        draggingOrb.x = randomPos(draggingOrb.radius).x;
        draggingOrb.y = randomPos(draggingOrb.radius).y;
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
    if (orbs.every(o=>o.fed)) {
        gameActive = false;
        // Show stats and reward
        showStats();
        giveReward();
        if (level < MAX_LEVEL) {
            nextLevelBtn.style.display = "inline-block";
        } else {
            nextLevelBtn.style.display = "none";
            statsDiv.textContent += "🎉 Congratulations! You've completed all 10 levels!";
        }
    }
}

function showStats() {
    let speedAvg = stats.speed.length > 0 ? (stats.speed.reduce((a,b)=>a+b,0)/stats.speed.length).toFixed(2) : 0;
    let range = stats.rangeOfMotion.size;
    let acc = stats.accuracy;
    statsDiv.innerHTML = `
        <strong>Performance:</strong><br>
        Average Speed: <b>${speedAvg}s</b><br>
        Misses/Errors: <b>${acc}</b><br>
        Range of Motion: <b>${range} zones</b>
    `;
}

function giveReward() {
    currentReward = rewards[Math.min(level-1, rewards.length-1)];
    rewardInfo.textContent = "Reward: " + currentReward;
}

// Next level button
nextLevelBtn.addEventListener('click', () => {
    if (level < MAX_LEVEL) {
        level++;
        setupLevel(level);
        requestAnimationFrame(gameLoop);
    }
});

// Initial game setup
setupLevel(level);
requestAnimationFrame(gameLoop);