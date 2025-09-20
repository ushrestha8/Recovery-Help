import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// API endpoint for correlations
app.post('/analyze-data', async (req, res) => {
    try {
        const patientData = req.body.data;
        const dataTable = patientData.map(d =>
            `Session ${d.session}: average time ${d.avgTime}, errors ${d.errors}, range of motion zones ${d.range}`
        ).join("\n");

        const prompt = `
            Here is session data from a rehabilitation game:

            ${dataTable}

            What correlations, if any, can you find between range of motion and number of errors? Respond in plain language.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;

        res.json({ analysis: response.text() });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to analyze data.' });
    }
});

// API endpoint for outlier detection
app.post('/analyze-outliers', async (req, res) => {
    try {
        const patientData = req.body.data;
        const dataTable = JSON.stringify(patientData);

        const prompt = `
            Analyze the following JSON array of patient data for outliers.
            Your response must be a single, valid JSON object, with no surrounding text or formatting.
            The JSON object should have this structure:
            {
              "summary": "a professional summary of the findings",
              "outliers": [
                {
                  "session": number,
                  "metric": "average time" | "errors" | "range",
                  "reason": "a brief explanation for the outlier"
                }
              ]
            }

            The patient data to analyze is:
            ${dataTable}
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        let analysis;
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);

        if (jsonMatch && jsonMatch[1]) {
            // If the model returns a markdown code block
            analysis = JSON.parse(jsonMatch[1]);
        } else {
            // If the model returns pure JSON, parse it directly
            analysis = JSON.parse(responseText.trim());
        }

        res.json({ analysis });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to analyze data.' });
    }
});

// API endpoint for chatbox
app.post('/chatbot', async (req, res) => {
    try {
        const { query, data } = req.body;
        
        const dataTable = data.map(d =>
            `Session ${d.session}: average time ${d.avgTime}, errors ${d.errors}, range of motion zones ${d.range}`
        ).join("\n");

        const prompt = `
            You are an AI assistant designed to help a physical therapist or patient understand their progress data from a therapy game.
            Here is the patient's session data:
            
            ${dataTable}

            The user has a question about this data: "${query}"
            
            Provide a helpful, concise, and professional answer based on the provided data. Do not make up information that is not supported by the data.
        `;
        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        res.json({ response: response.text() });
    } catch (error) {
        console.error('Chatbot endpoint error:', error);
        res.status(500).json({ error: 'Failed to get a response from the chatbot.' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});