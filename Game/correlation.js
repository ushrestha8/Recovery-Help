// Sample patient data used for testing the AI Integration
const patientData = [
    { session: 1, avgTime: 3.5, errors: 7, range: 4 },
    { session: 2, avgTime: 3.1, errors: 5, range: 5 },
    { session: 3, avgTime: 2.8, errors: 4, range: 6 },
    { session: 4, avgTime: 2.5, errors: 3, range: 7 },
    { session: 5, avgTime: 2.3, errors: 2, range: 8 },
    { session: 6, avgTime: 2.1, errors: 1, range: 9 },
    { session: 7, avgTime: 2.0, errors: 1, range: 9 },
    { session: 8, avgTime: 1.9, errors: 0, range: 10 }
];

// Correlation analysis functionality
document.getElementById("analyze-btn").addEventListener("click", async () => {
    const outputDiv = document.getElementById("ai-analysis-output");
    outputDiv.textContent = "Analyzing data with AI...";

    try {
        const response = await fetch('http://localhost:3000/analyze-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: patientData })
        });
        
        if (!response.ok) {
            throw new Error('Server response was not ok');
        }

        const result = await response.json();
        outputDiv.textContent = result.analysis;
    } catch (e) {
        outputDiv.textContent = "There was an error analyzing the data.";
        console.error("Fetch error:", e);
    }
});

// Outlier detection functionality
document.getElementById("outliers-btn").addEventListener("click", async () => {
    const outputDiv = document.getElementById("ai-analysis-output");
    outputDiv.textContent = "Analyzing data for outliers...";

    try {
        const response = await fetch('http://localhost:3000/analyze-outliers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: patientData })
        });
        
        if (!response.ok) {
            throw new Error('Server response was not ok');
        }

        const result = await response.json();
        if (result.analysis.summary) {
            let html = `<h3>${result.analysis.summary}</h3>`;
        if (result.analysis.outliers && result.analysis.outliers.length > 0) {
            html += "<h2>Outliers Found:</h2><ul>";
            result.analysis.outliers.forEach(outlier => {
                html += `<li><strong>Session ${outlier.session}</strong>: An unusual ${outlier.metric} was detected. Reason: ${outlier.reason}</li>`;
            });
            html += "</ul>";
        } 
        else {
            html += "<p>No significant outliers were detected.</p>";
        }
        outputDiv.innerHTML = html;
    } 
    else {
    // fallback if AI didn’t return JSON correctly
    outputDiv.textContent = JSON.stringify(result.analysis, null, 2);
}

    } catch (e) {
        outputDiv.textContent = "There was an error analyzing the data for outliers.";
        console.error("Fetch error:", e);
    }
});

// Chatbot functionality
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const chatbox = document.getElementById("chatbox");
let hasGreeted = false; // Add a flag to track if the greeting has been cleared

function addMessageToChatbox(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message");
    messageDiv.classList.add(sender === "user" ? "user-message" : "system-message");
    messageDiv.textContent = text;
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight; // Auto-scroll to the bottom
}

chatSendBtn.addEventListener("click", async () => {
    const userMessage = chatInput.value.trim();
    if (userMessage === "") return;
    
    // Clear the initial greeting message if it hasn't been cleared yet
    if (!hasGreeted) {
        chatbox.innerHTML = "";
        hasGreeted = true;
    }

    addMessageToChatbox(userMessage, "user");
    chatInput.value = "";

    try {
        addMessageToChatbox("Typing...", "system");
        
        const response = await fetch('http://localhost:3000/chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: userMessage, data: patientData })
        });

        const result = await response.json();
        
        // Remove "Typing..." message
        chatbox.removeChild(chatbox.lastChild);
        
        addMessageToChatbox(result.response, "system");
    } catch (e) {
        // Remove "Typing..." message
        chatbox.removeChild(chatbox.lastChild);
        
        addMessageToChatbox("Sorry, I could not process that request.", "system");
        console.error("Chatbot error:", e);
    }
});

chatInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        chatSendBtn.click();
    }
});