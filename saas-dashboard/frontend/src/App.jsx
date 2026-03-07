import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './pages/Overview';
import Financial from './pages/Financial';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Couriers from './pages/Couriers';
import CustomerInsight from './pages/CustomerInsight';
import Warehouses from './pages/Warehouses';
import HRSnapshot from './pages/HRSnapshot';
import ProjectStatus from './pages/ProjectStatus';
import ProductionFloor from './pages/ProductionFloor';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { SalesProvider } from './context/SalesContext';
import { InventoryProvider } from './context/InventoryContext';
import { ManufacturingProvider } from './context/ManufacturingContext';
import { CustomerProvider } from './context/CustomerContext';

const Layout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar - Fixed */}
      <Sidebar />

      {/* Main Content Area - Fluid */}
      <main className="flex-1 ml-[320px] flex flex-col min-h-screen overflow-x-hidden">
        {/* Header - Contextual */}
        <Header />

        {/* Dashboard Content Pages */}
        <div className="p-8 pt-0">
          <Routes>
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Overview />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/couriers" element={<Couriers />} />
              <Route path="/customers" element={<CustomerInsight />} />
              <Route path="/hr" element={<HRSnapshot />} />
              <Route path="/projects" element={<ProjectStatus />} />
              <Route path="/production" element={<ProductionFloor />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <SalesProvider>
          <InventoryProvider>
            <ManufacturingProvider>
              <CustomerProvider>
                <Router>
                  <Layout />
                </Router>
              </CustomerProvider>
            </ManufacturingProvider>
          </InventoryProvider>
        </SalesProvider>
      </TransactionProvider>
    </AuthProvider>
  );
}

export default App;
