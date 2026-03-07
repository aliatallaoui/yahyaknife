# Enterprise SaaS Operations & Manufacturing Dashboard

A comprehensive, full-stack Enterprise Resource Planning (ERP) and Operations dashboard built on the MERN stack (MongoDB, Express.js, React, Node.js) with Tailwind CSS. It is designed specifically to handle the operations of a Direct-to-Consumer (D2C) e-commerce and manufacturing business, particularly those utilizing high-volume Cash-On-Delivery (COD) models.

## 🚀 Key Features

### 1. Advanced Sales & Order Management
*   **11-Stage Lifecycles:** Track orders from 'New' -> 'Confirmed' -> 'Dispatched' -> 'Delivered' -> 'Paid'.
*   **Customer Relationship Hub (CRM):** Track lifetime value (LTV), acquisition costs, anomalies, and active support tickets.

### 2. Live Inventory & Immutable Ledgers
*   **Granular States:** Reserve stock on confirmation, deduct on dispatch, or restock on refusal.
*   **Logistics & Couriers:** Real-time dispatch boards, courier liability tracking, and cash settlement reconciliation for COD orders.

### 3. Manufacturing OS & BOM Engine
*   **Bill of Materials (BOM):** Build production recipes consisting of multiple raw materials.
*   **Production Floor Kanban:** Move production orders across work centers (Planned -> In Progress -> QA -> Done) with automatic raw material deduction and finished goods injection upon completion.
*   **Procurement Hub:** Manage Purchase Orders (POs) for raw materials, auto-restocking the physical warehouse boundaries upon receiving.

### 4. Human Resources & Attendance Pointage
*   **Daily Pointage System:** Track check-ins, calculate missing minutes, late penalties, and recognize "Weekend Rules".
*   **Automated Payroll Generator:** Aggregate an entire month of attendance to automatically generate base salaries, overtime bonuses, and lateness deductions based on dynamic employee contracts.
*   **Reporting:** Generate dynamic `.xlsx` (Excel) and `.pdf` reports for accounting.

### 5. Algorithmic Ecosystem Intelligence
*   **Consolidated P&L:** A true profitability engine that aggregates exact COGS, Courier liabilities/fees, and HR Payroll into a real-time revenue report.
*   **AI Insight Feed:** Algorithms running in the background detect sudden jumps in refusal rates, impending inventory stockouts, or suspicious multi-order customers, alerting the user immediately.

### 6. Role-Based Access Control (RBAC)
*   **Granular Enterprise Roles:** Isolate modules natively in both the Frontend (React Router/Sidebar) and Backend (Express Middleware).
*   **Supported Sub-Domains:** `Super Admin`, `HR Manager`, `Finance Controller`, `Production Lead`, `Warehouse Supervisor`, and `Sales Representative`.

---

## 🛠 Tech Stack

*   **Frontend:** React (Vite), React Router v6, Tailwind CSS, Recharts (Data Viz), Lucide-React (Icons), Moment.js, Context API.
*   **Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT (JSON Web Tokens) Authentication, BcryptJS.
*   **Report Generation:** `jspdf` & `jspdf-autotable` (PDFs), `xlsx` (Excel data exports).

---

## 💻 Local Setup & Development

### 1. Clone & Install Dependencies
Navigate into both directories and install the necessary NPM packages:
```bash
# Terminal 1 - Background API
cd backend
npm install

# Terminal 2 - Frontend UI
cd frontend
npm install
```

### 2. Environment Variables (.env)
Create a `.env` file in the root of the `/backend` folder. Insert your MongoDB connection string and a JWT secret.
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/saas-dashboard
JWT_SECRET=super_secret_enterprise_key_123
```

### 3. Database Seeding (Optional but needed for demo)
The application includes extensive database seeding engines to instantly populate mock data for demonstrations or testing.
```bash
cd backend
node seedGeneral.js     # Seeds Auth Admins & Legacy Data (Run 1st)
node seedBusiness.js    # Seeds thousands of realistic Orders, Inventory, and PnL Data (Run 2nd)
node seedHRTest.js      # Seeds 50+ fictional Employees with random contracts (Run 3rd)
```

### 4. Boot Up Systems
Run the servers to start the application.

**Backend Server (Runs on port 5000):**
```bash
cd backend
npm run dev
```

**Frontend Vite Server (Runs on port 5173):**
```bash
cd frontend
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## 🔒 Default System Credentials

After running the seed scripts, use these credentials to log in as a Master user:
*   **Email:** `admin@example.com`
*   **Password:** `password`
*   **Role Setup:** For managing additional profiles or experiencing RBAC logic, use the "User Directory & RBAC" panel within the Dashboard Settings.
