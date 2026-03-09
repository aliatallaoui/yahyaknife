require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function run() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const formattedHistory = [
        { role: 'model', parts: [{ text: 'Hello! I am Cortex AI.' }] },
        { role: 'user', parts: [{ text: 'product' }] }
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: formattedHistory
        });
        console.log("Success:", response.text);
    } catch (e) {
        console.error("Caught error:", e.message || e);
    }
}
run();
