// This function runs when the results page has finished loading.
window.onload = function() {
    
    // --- Load Data from localStorage ---
    // It retrieves the data saved by game.js.
    // If no data exists, it uses an empty array to prevent errors.
    const sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];

    // If there's no data, show a message. Otherwise, draw the charts.
    if (sessionHistory.length === 0) {
        document.querySelector('.card').innerHTML = "<h1>No Session Data Found</h1><p>Play a session to see your progress here!</p><button onclick=\"window.location.href='index.html'\">Play Now</button>";
        return;
    }

    // --- Prepare Data for Charts ---
    const labels = sessionHistory.map(s => `Session ${s.session}`);
    const missesData = sessionHistory.map(s => s.totalMisses);
    const timeData = sessionHistory.map(s => s.avgTimePerOrb);

    // --- Create Graph 1: Total Misses/Errors (Code is identical to before) ---
    const missesCtx = document.getElementById('missesChart').getContext('2d');
    new Chart(missesCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Misses / Errors per Session',
                data: missesData,
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Error Rate Trend' } }
        }
    });

    // --- Create Graph 2: Average Time per Orb (Code is identical to before) ---
    const timeCtx = document.getElementById('timeChart').getContext('2d');
    new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Time per Orb (seconds)',
                data: timeData,
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Speed and Efficiency Trend' } }
        }
    });
};
