require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/saas-dashboard';

const namesToInsert = [
    'أحمد',
    'ريان',
    'حيدر',
    'جابر',
    'يحيى',
    'الشيخ',
    'أيمن',
    'آدم'
];

const departmentMap = ['Manufacturing', 'Warehouse', 'Dispatch', 'Sales', 'Engineering'];

const generateEmail = (name) => {
    // Very basic transliteration or just index-based email for simplicity
    const translit = {
        'أحمد': 'ahmed',
        'ريان': 'rayan',
        'حيدر': 'haider',
        'جابر': 'jaber',
        'يحيى': 'yahya',
        'الشيخ': 'elsheikh',
        'أيمن': 'aymen',
        'آدم': 'adam'
    };
    return `${translit[name] || 'employee'}.${Math.floor(Math.random() * 1000)}@company.com`;
};

const insertEmployees = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('📦 Connected to MongoDB');

        let createdCount = 0;

        for (const [index, name] of Object.entries(namesToInsert)) {
            // Check if already exists by name
            const exists = await Employee.findOne({ name });
            if (!exists) {
                const newEmp = new Employee({
                    name: name,
                    email: generateEmail(name),
                    phone: `0555 ${Math.floor(100000 + Math.random() * 900000)}`,
                    role: 'Staff',
                    department: departmentMap[index % departmentMap.length],
                    salary: 85000 + (Math.floor(Math.random() * 5) * 5000), // 85k to 110k
                    contractSettings: {
                        monthlySalary: 85000 + (Math.floor(Math.random() * 5) * 5000),
                        dailyRequiredMinutes: 480,
                        schedule: {
                            morningStart: '08:00', morningEnd: '12:00',
                            eveningStart: '13:00', eveningEnd: '17:00'
                        },
                        overtimeEnabled: true,
                        overtimeRateMultiplier: 1.5,
                        latenessGracePeriodMin: 15,
                        deductionRules: { missedMinutes: true }
                    }
                });
                await newEmp.save();
                console.log(`✅ Created Employee: ${name} (${newEmp.email}) in ${newEmp.department}`);
                createdCount++;
            } else {
                console.log(`⚠️ Employee already exists: ${name}`);
            }
        }

        console.log(`\n🎉 Successfully inserted ${createdCount} employees.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding Error:', err);
        process.exit(1);
    }
};

insertEmployees();
