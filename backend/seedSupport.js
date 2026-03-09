const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Customer = require('./models/Customer');
const SupportTicket = require('./models/SupportTicket');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard')
    .then(async () => {
        console.log("Connected to MongoDB");

        // Clear old
        await SupportTicket.deleteMany({});

        // Find customers
        const customers = await Customer.find().limit(2);
        if (customers.length === 0) {
            console.log("No customers found to attach tickets to.");
            process.exit(0);
        }

        const t1 = new SupportTicket({
            customerId: customers[0]._id,
            subject: "Where is my order? It is delayed.",
            type: 'Shipping Issue',
            status: 'Open',
            priority: 'High',
            messages: [
                { sender: 'Customer', message: "Hi, tracking shows it's stuck in transit for 4 days.", senderModel: 'Customer', senderId: customers[0]._id }
            ]
        });

        const t2 = new SupportTicket({
            customerId: customers[1] ? customers[1]._id : customers[0]._id,
            subject: "Defective switch on the mechanical keyboard",
            type: 'RMA Request',
            status: 'In Progress',
            priority: 'Urgent',
            messages: [
                { sender: 'Customer', message: "The 'W' key is stuck straight out of the box.", senderModel: 'Customer' },
                { sender: 'Agent', message: "I'm so sorry to hear that. Can you send a photo of the serial number? We will initialize an RMA.", senderModel: 'User' }
            ]
        });

        await t1.save();
        await t2.save();

        console.log("Seeded 2 Support Tickets successfully.");
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
