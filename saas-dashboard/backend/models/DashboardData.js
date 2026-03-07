const mongoose = require('mongoose');

const DashboardSchema = new mongoose.Schema({
  kpis: {
    totalSales: { value: Number, trend: Number, dateRange: String },
    inventoryValues: { value: Number, trend: Number, warning: String },
    totalOrders: { value: Number, trend: Number }
  },
  channels: [
    { name: String, value: Number, percentage: Number, color: String }
  ],
  monthlyExpenses: [
    { month: String, baseline: Number, actual: Number, assets: Number, salary: Number, monthly: Number }
  ],
  customerFunnel: [
    { step: Number, percentage: Number }
  ],
  orderFrequency: [
    { day: String, hour: String, value: Number }
  ]
});

module.exports = mongoose.model('Dashboard', DashboardSchema);
