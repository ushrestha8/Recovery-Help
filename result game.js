//This is the most important change. 
//This script now collects data over 10 levels and, 
  //  at the end, 
    // saves a summary object to localStorage.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelInfo = document.getElementById('level-info');
const nextLevelBtn = document.getElementById('next-level-btn');
const viewDashboardBtn = document.getElementById('view-dashboard-btn');
const statsDiv = document.getElementById('stats');

// --- Game Variables ---
let currentLevel = 1;
const MAX_LEVELS = 10;
let orbs = [];
let draggingOrb = null;
let dragon = { x: canvas.width/2, y: canvas.height/2, radius: 50 };

// This object will collect data across all 10 levels
let sessionData = {
    totalMisses: 0,
    allOrbTimes: [] // We'll store the time for every single orb here
};
let gameActive = false;

// --- Game Flow ---
function startLevel() {
    levelInfo.textContent = `Level: ${currentLevel} of ${MAX_LEVELS}`;
    nextLevelBtn.style.display = 'none';
    statsDiv.innerHTML = '';
    
    orbs = [];
    const orbCount = currentLevel; // Level number determines the number of orbs
    for (let i = 0; i < orbCount; i++) {
        orbs.push({
            ...randomPos(30),
            radius: 30,
            color: `hsl(${i * (360 / orbCount)}, 70%, 60%)`,
            fed: false,
            startTime: 0
        });
    }
    
    gameActive = true;
    drawGame();
}

function checkLevelEnd() {
    if (orbs.every(o => o.fed)) {
        gameActive = false;
        if (currentLevel < MAX_LEVELS) {
            nextLevelBtn.style.display = "inline-block";
        } else {
            // --- SESSION COMPLETE ---
            finishSession();
        }
    }
}

nextLevelBtn.addEventListener('click', () => {
    currentLevel++;
    startLevel();
});

function finishSession() {
    // 1. Calculate the final average time
    const totalTime = sessionData.allOrbTimes.reduce((a, b) => a + b, 0);
    const avgTimePerOrb = totalTime / sessionData.allOrbTimes.length || 0;

    // 2. Get existing history from localStorage or create a new array
    const sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];

    // 3. Add the new session data
    sessionHistory.push({
        session: sessionHistory.length + 1,
        totalMisses: sessionData.totalMisses,
        avgTimePerOrb: parseFloat(avgTimePerOrb.toFixed(2))
    });

    // 4. Save the updated history back to localStorage
    localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));

    // 5. Show the button to view the dashboard
    levelInfo.textContent = "Session Complete!";
    viewDashboardBtn.style.display = 'inline-block';
}


// --- Event Handlers & Drawing (logic is the same as before) ---

canvas.addEventListener('mousedown', (e) => {
    if (!gameActive) return;
    const pos = getMousePos(e);
    for(let orb of orbs) {
        if (!orb.fed && dist(pos, orb) < orb.radius) {
            draggingOrb = orb;
            orb.startTime = Date.now(); // Start timing when picked up
            break;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (draggingOrb) {
        const pos = getMousePos(e);
        draggingOrb.x = pos.x;
        draggingOrb.y = pos.y;
        drawGame();
    }
});

canvas.addEventListener('mouseup', () => {
    if (draggingOrb) {
        if (dist(draggingOrb, dragon) < dragon.radius) {
            draggingOrb.fed = true;
            const timeTaken = (Date.now() - draggingOrb.startTime) / 1000;
            sessionData.allOrbTimes.push(timeTaken); // Add time to session data
        } else {
            sessionData.totalMisses++; // Add miss to session data
            // Reset orb to a new random position
            const newPos = randomPos(draggingOrb.radius);
            draggingOrb.x = newPos.x;
            draggingOrb.y = newPos.y;
        }
        draggingOrb = null;
        drawGame();
        checkLevelEnd();
    }
});

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e0f4f8';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#6c3ec1';
    ctx.beginPath();
    ctx.arc(dragon.x, dragon.y, dragon.radius, 0, Math.PI*2);
    ctx.fill();
    orbs.forEach(orb => {
        if (!orb.fed) {
            ctx.fillStyle = orb.color;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI*2);
            ctx.fill();
        }
    });
}

function getMousePos(evt) { const rect = canvas.getBoundingClientRect(); return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }; }
function randomPos(radius) { return { x: radius + Math.random() * (canvas.width - radius * 2), y: radius + Math.random() * (canvas.height - radius * 2) }; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

// --- Initial Game Start ---
startLevel();


