const { GoogleGenAI } = require('@google/genai');
const logger = require('../shared/logger');

// Initialize the SDK. It will automatically use the GEMINI_API_KEY environment variable.
// Make sure to add GEMINI_API_KEY to your backend/.env file!
let ai;
try {
    if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
} catch (error) {
    logger.warn("GoogleGenAI initialized without API key. Please add GEMINI_API_KEY to .env");
}

const SYSTEM_PROMPT = `
You are Cortex AI, the intelligent enterprise assistant for the MERN SaaS Operations Platform. 
Your goal is to help the user manage their business operations, inventory, HR, sales, courier operations, and COD logistics.
You have access to tools that can fetch data or perform actions within the system.

Always maintain a professional, helpful, and concise tone. You act as a seamless part of the user's dashboard.
`;

// Define the schema for the tools the AI can use.
// For V1, we will implement simple read-only data fetching to prove the concept.
const tools = [
    {
        name: "get_financial_summary",
        description: "Returns the current financial overview, including revenue, expenses, and net profit.",
    },
    {
        name: "get_active_shipments",
        description: "Returns the count of active, in-transit, and delivered shipments from the dispatch center.",
    },
    {
        name: "add_expense",
        description: "Creates a new manual expense record in the financial ledger.",
        parameters: {
            type: "OBJECT",
            properties: {
                description: { type: "STRING", description: "A short description of the expense." },
                amount: { type: "NUMBER", description: "The cost of the expense in standard currency amounts." },
                category: {
                    type: "STRING",
                    description: "The category of the expense (e.g., Office Supplies, Services, Logistics, Software). Default to 'General' if unsure."
                }
            },
            required: ["description", "amount"]
        }
    },
    {
        name: "create_customer",
        description: "Creates a new customer profile in the CRM.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The full name of the customer." },
                phone: { type: "STRING", description: "The primary phone number of the customer." },
                wilaya: { type: "STRING", description: "The province or state (Wilaya) in Algeria." },
                commune: { type: "STRING", description: "The municipality or city (Commune) in Algeria." }
            },
            required: ["name", "phone"]
        }
    },
    {
        name: "add_employee",
        description: "Creates a new employee record in the HR system.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "Full name of the employee." },
                department: { type: "STRING", description: "Department (e.g., Sales, Production, Marketing)." },
                role: { type: "STRING", description: "Job title or role." },
                salary: { type: "NUMBER", description: "Monthly salary in DZD." }
            },
            required: ["name", "department", "role"]
        }
    },
    {
        name: "create_product",
        description: "Creates a new product in the inventory systems. You can specify category, brand, price, and initial stock.",
        parameters: {
            type: "OBJECT",
            properties: {
                name: { type: "STRING", description: "The name of the product." },
                categoryName: { type: "STRING", description: "The category name. If it doesn't exist, it will be automatically created." },
                brand: { type: "STRING", description: "The brand of the product (optional)." },
                description: { type: "STRING", description: "A detailed product description." },
                price: { type: "NUMBER", description: "Default selling price for the product variant." },
                stock: { type: "NUMBER", description: "Initial stock level." }
            },
            required: ["name", "categoryName"]
        }
    }
];

// Combine definitions into the declaration format expected by Gemini
const toolsDeclaration = {
    functionDeclarations: tools
};

const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Revenue = require('../models/Revenue');
const Shipment = require('../models/Shipment');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const Product = require('../models/Product');
const ProductVariant = require('../models/ProductVariant');
const Category = require('../models/Category');

async function executeTool(call, tenantId) {
    try {
        if (call.name === 'get_financial_summary') {
            const tenantFilter = { tenant: tenantId };
            const expenses = await Expense.aggregate([{ $match: tenantFilter }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
            const revenues = await Revenue.aggregate([{ $match: tenantFilter }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
            const manualExpenses = expenses.length > 0 ? expenses[0].total : 0;
            const manualRevenue = revenues.length > 0 ? revenues[0].total : 0;

            const orderAgg = await Order.aggregate([
                { $match: { ...tenantFilter, deletedAt: null, status: { $ne: 'Cancelled' } } },
                { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
            ]);
            const totalSales = orderAgg.length > 0 ? orderAgg[0].totalSales : 0;

            return {
                manualRevenue,
                manualExpenses,
                totalSales,
                netProfitEstimate: (manualRevenue + totalSales) - manualExpenses
            };
        }

        if (call.name === 'get_active_shipments') {
            const tenantFilter = { tenant: tenantId };
            const active = await Shipment.countDocuments({ ...tenantFilter, shipmentStatus: { $in: ['Created in Courier', 'In Transit', 'Out for Delivery'] } });
            const delivered = await Shipment.countDocuments({ ...tenantFilter, shipmentStatus: 'Delivered' });
            const returned = await Shipment.countDocuments({ ...tenantFilter, shipmentStatus: { $in: ['Returned', 'Return Initiated'] } });

            return { active, delivered, returned };
        }

        if (call.name === 'add_expense') {
            const { description, amount, category } = call.args || {};
            if (!description || !amount) return { error: "Missing required fields: description or amount" };

            const newExpense = await Expense.create({
                tenant: tenantId,
                description,
                amount: Number(amount),
                category: category || 'General',
                date: new Date()
            });
            return { success: true, message: `Expense logged successfully with ID: ${newExpense._id}`, expense: newExpense };
        }

        if (call.name === 'create_customer') {
            const { name, phone, wilaya, commune } = call.args || {};
            if (!name || !phone) return { error: "Missing required fields: name or phone" };

            const newCust = await Customer.create({
                tenant: tenantId,
                name,
                phone,
                wilayaName: wilaya || '',
                commune: commune || '',
                status: 'Active',
                totalSpent: 0,
                ordersCount: 0
            });
            return { success: true, message: `Customer profile created successfully for ${name}.`, customerId: newCust._id };
        }

        if (call.name === 'add_employee') {
            const { name, department, role, salary } = call.args || {};
            if (!name || !department || !role) return { error: "Missing required fields: name, department, or role" };

            const newEmp = await Employee.create({
                tenant: tenantId,
                name,
                department,
                role,
                salary: Number(salary) || 0,
                status: 'Active',
                joinDate: new Date(),
                leaveBalance: 30
            });
            return { success: true, message: `Employee ${name} added successfully to ${department}.`, employeeId: newEmp._id };
        }

        if (call.name === 'create_product') {
            const { name, categoryName, brand, description, price, stock } = call.args || {};
            if (!name || !categoryName) return { error: "Missing required fields: name or categoryName" };

            // Find or create category
            const escapedCategory = categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let category = await Category.findOne({ tenant: tenantId, name: { $regex: new RegExp(`^${escapedCategory}$`, 'i') } });
            if (!category) {
                category = await Category.create({ tenant: tenantId, name: categoryName, description: 'Created via AI Copilot' });
            }

            const newProduct = await Product.create({
                tenant: tenantId,
                name,
                category: category._id,
                brand: brand || '',
                description: description || ''
            });

            // Always create a default variant if adding a product
            await ProductVariant.create({
                tenant: tenantId,
                productId: newProduct._id,
                sku: `SKU-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
                price: Number(price) || 0,
                cost: 0,
                totalStock: Number(stock) || 0,
                reorderLevel: 10
            });

            return { success: true, message: `Product '${name}' created successfully in category '${categoryName}'.`, productId: newProduct._id };
        }

        return { error: `Unknown tool: ${call.name}` };
    } catch (e) {
        logger.error({ err: e }, 'AI tool execution error');
        return { error: e.isOperational ? e.message : 'Tool execution failed' };
    }
}

/**
 * Handle incoming chat messages from the frontend Copilot Widget.
 * Maintains conversation history and executes tool calls if requested by the LLM.
 */
const handleChat = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) return res.status(403).json({ error: 'Tenant context required' });

        const { messages } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "messages must be a non-empty array." });
        }
        if (messages.length > 100) {
            return res.status(400).json({ error: "Conversation history too long." });
        }

        if (!process.env.GEMINI_API_KEY) {
            logger.error('GEMINI_API_KEY is missing from environment variables');
            return res.status(500).json({
                error: "GEMINI_API_KEY is missing from environment variables.",
                reply: "I cannot connect to my AI brain right now. Please tell the administrator to configure the GEMINI_API_KEY."
            });
        }

        if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        let formattedHistory = messages.map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

        let response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: formattedHistory,
            config: {
                systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
                tools: [toolsDeclaration],
                temperature: 0.2
            }
        });

        // Loop to handle up to 3 chained function calls (e.g. if it wants to call multiple tools)
        let callCount = 0;
        while (response.functionCalls && response.functionCalls.length > 0 && callCount < 3) {
            callCount++;

            // Append model's function call request to history
            formattedHistory.push({
                role: 'model',
                parts: response.functionCalls.map(call => ({ functionCall: call }))
            });

            // Execute all requested tools
            const functionResponses = [];
            for (const call of response.functionCalls) {
                const result = await executeTool(call, tenantId);
                functionResponses.push({
                    functionResponse: {
                        name: call.name,
                        response: result
                    }
                });
            }

            // Append tool results to history
            formattedHistory.push({
                role: 'user', // In Gemini, function responses are provided by the user role
                parts: functionResponses
            });

            // Call the model again with the new history
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: formattedHistory,
                config: {
                    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
                    tools: [toolsDeclaration],
                    temperature: 0.2
                }
            });
        }

        const replyText = response.text || "I processed your request but had nothing to say.";
        res.json({ reply: replyText });

    } catch (error) {
        logger.error({ err: error }, 'AI Controller Error');
        res.status(500).json({
            error: "Failed to process AI request.",
            reply: "I encountered an error while processing your request. Please try again."
        });
    }
};

module.exports = {
    handleChat
};
