const OpenAI = require('openai');

const generateExecutiveInsights = async (dashboardData) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            console.warn("OPENAI_API_KEY is missing. Skipping AI insights generation.");
            return "AI Insights are currently disabled. Please configure your OpenAI API key.";
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Compile a lean data prompt
        const promptData = `
        Executive summary required for SaaS dashboard. Data context:
        - Total Sales: ${dashboardData.kpis.totalSales.value} DZ (Trend: ${dashboardData.kpis.totalSales.trend}%)
        - Net Profit: ${dashboardData.kpis.netProfit.value} DZ (Trend: ${dashboardData.kpis.netProfit.trend}%)
        - Total Orders: ${dashboardData.kpis.totalOrders.value}
        - Top Acquisition Channels: ${dashboardData.channels.slice(0, 3).map(c => c.name).join(', ')}

        Generate a concise, 2-3 sentence executive summary highlighting the most important insight and a recommended actionable step. Do not use filler text. 
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective model
            messages: [
                { role: "system", content: "You are a senior business intelligence AI analyst advising an e-commerce CEO." },
                { role: "user", content: promptData }
            ],
            temperature: 0.7,
            max_tokens: 150,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("AI Insights Error:", error.message);
        return "Insight generation failed. Please try again later.";
    }
};

module.exports = { generateExecutiveInsights };
