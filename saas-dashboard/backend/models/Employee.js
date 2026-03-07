const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    department: {
        type: String,
        required: true,
        enum: ['Engineering', 'Sales', 'Marketing', 'Operations', 'HR', 'Finance', 'Design']
    },
    salary: { type: Number, required: true },
    joinDate: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['Active', 'On Leave', 'Terminated'],
        default: 'Active'
    },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
