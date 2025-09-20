// server.js
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Load your API key from a .env file for security
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// Define your API endpoint
app.post('/analyze-data', async (req, res) => {
    try {
        const patientData = req.body.data;
        const prompt = `Here is session data from a rehabilitation game:\n\n${patientData.map(d => `Session ${d.session}: average time ${d.avgTime}, errors ${d.errors}, range of motion zones ${d.range}`).join("\n")}\n\nWhat correlations, if any, can you find between range of motion and number of errors? Respond in plain language.`;
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        res.json({ analysis: response.text() });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to analyze data.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});