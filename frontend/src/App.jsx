import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Overview from './pages/Overview';
import Financial from './pages/Financial';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Couriers from './pages/Couriers';
import CourierDetails from './pages/CourierDetails';
import DispatchCenter from './pages/DispatchCenter';
import CustomerInsight from './pages/CustomerInsight';
// ... rest of imports are identical, so I'll target the route directly in App.jsx.
import CustomerProfile from './pages/CustomerProfile';
import Warehouses from './pages/Warehouses';
import HRSnapshot from './pages/HRSnapshot';
import EmployeeProfile from './pages/EmployeeProfile';
import WorkerCard from './pages/WorkerCard';
import HRAttendance from './pages/HRAttendance';
import HRPayroll from './pages/HRPayroll';
import HRReports from './pages/HRReports';
import ProjectStatus from './pages/ProjectStatus';
import GlobalTaskBoard from './pages/GlobalTaskBoard';
import ProjectDetail from './pages/ProjectDetail';
import ProductionFloor from './pages/ProductionFloor';
import KnifeDashboard from './pages/KnifeDashboard';
import KnifeLibrary from './pages/KnifeLibrary';
import KnivesInProduction from './pages/KnivesInProduction';
import KnifeBuilder from './pages/KnifeBuilder';
import ToolManagement from './pages/ToolManagement';
import ProcurementHub from './pages/ProcurementHub';
import SettingsLayout from './pages/settings/SettingsLayout';
import SettingsProfile from './pages/settings/SettingsProfile';
import SettingsGeneral from './pages/settings/SettingsGeneral';
import SettingsSecurity from './pages/settings/SettingsSecurity';
import SettingsAlerts from './pages/settings/SettingsAlerts';
import SettingsUsers from './pages/settings/SettingsUsers';
import SettingsRoles from './pages/settings/SettingsRoles'; // <== Added Roles import
import CourierSettings from './pages/CourierSettings';
import SupportDesk from './pages/SupportDesk';
import CallCenterDashboard from './pages/callcenter/CallCenterDashboard';
import CallCenterManager from './pages/callcenter/CallCenterManager';
import OrderControlCenter from './pages/OrderControlCenter';
import CopilotWidget from './components/CopilotWidget';

import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { SalesProvider } from './context/SalesContext';
import { InventoryProvider } from './context/InventoryContext';
import { ManufacturingProvider } from './context/ManufacturingContext';
import { CustomerProvider } from './context/CustomerContext';
import { ProjectProvider } from './context/ProjectContext';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const Layout = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { i18n } = useTranslation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // RTL DOM Flipper - reacts to i18n.language so any changeLanguage() call takes effect
  useEffect(() => {
    const lang = user?.preferences?.language || localStorage.getItem('i18nextLng') || 'ar';
    // On initial load, sync from user preferences or localStorage
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, [user?.preferences?.language]); // eslint-disable-line

  // Watch i18n.language directly so the Header language selector takes effect immediately
  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area - shifts based on sidebar state */}
      <main
        className={`flex-1 flex flex-col min-h-screen overflow-x-hidden transition-all duration-300 ${sidebarOpen ? 'md:ms-[260px]' : 'md:ms-[72px]'
          }`}
      >
        {/* Header - Contextual */}
        <Header setMobileMenuOpen={setMobileMenuOpen} />

        {/* Dashboard Content Pages */}
        <div className="px-4 pt-10 pb-12 sm:px-8 lg:px-10 xl:px-14 2xl:px-16 w-full flex-1 flex flex-col">
          <Routes>
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Overview />} />
              <Route path="/financial" element={<Financial />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/orders-hub" element={<OrderControlCenter />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/couriers" element={<Couriers />} />
              <Route path="/couriers/:id" element={<CourierDetails />} />
              <Route path="/couriers/dispatch" element={<DispatchCenter />} />
              <Route path="/customers" element={<CustomerInsight />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />
              <Route path="/hr" element={<HRSnapshot />} />
              <Route path="/hr/employees/:id" element={<EmployeeProfile />} />
              <Route path="/production/workers/:id" element={<WorkerCard />} />
              <Route path="/hr/attendance" element={<HRAttendance />} />
              <Route path="/hr/payroll" element={<HRPayroll />} />
              <Route path="/hr/reports" element={<HRReports />} />
              <Route path="/projects" element={<ProjectStatus />} />
              <Route path="/projects/tasks" element={<GlobalTaskBoard />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/production" element={<ProductionFloor />} />
              <Route path="/knife-builder" element={<KnifeBuilder />} />
              <Route path="/knives" element={<KnifeDashboard />} />
              <Route path="/knives/library" element={<KnifeLibrary />} />
              <Route path="/knives/production" element={<KnivesInProduction />} />
              <Route path="/procurement" element={<ProcurementHub />} />
              <Route path="/support" element={<SupportDesk />} />
              <Route path="/production/tools" element={<ToolManagement />} />

              {/* Call Center Routes */}
              <Route path="/call-center" element={<CallCenterDashboard />} />
              <Route path="/call-center/manager" element={<CallCenterManager />} />

              {/* Settings Hub Nested Routing */}
              <Route path="/settings" element={<SettingsLayout />}>
                <Route path="profile" element={<SettingsProfile />} />
                <Route path="general" element={<SettingsGeneral />} />
                <Route path="security" element={<SettingsSecurity />} />
                <Route path="alerts" element={<SettingsAlerts />} />
                <Route path="users" element={<SettingsUsers />} />
                <Route path="roles" element={<SettingsRoles />} /> {/* <== Added Roles route */}
                <Route path="couriers" element={<CourierSettings />} />
                {/* Default redirect for /settings */}
                <Route path="" element={<Navigate to="profile" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Global AI Copilot */}
      {!isAuthPage && <CopilotWidget />}
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
                <ProjectProvider>
                  <Router>
                    <Layout />
                  </Router>
                </ProjectProvider>
              </CustomerProvider>
            </ManufacturingProvider>
          </InventoryProvider>
        </SalesProvider>
      </TransactionProvider>
    </AuthProvider>
  );
}

export default App;
