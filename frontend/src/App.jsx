import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, Suspense, useContext, useEffect, useState, Component } from 'react';
import { useTranslation } from 'react-i18next';
import { Sentry } from './sentry';

// Shell components — always loaded (they wrap every page)
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';

import { InventoryProvider } from './context/InventoryContext';
import { CustomerProvider } from './context/CustomerContext';
import { ThemeProvider } from './context/ThemeContext';

// ─── Lazy-loaded pages (route-based code splitting) ──────────────────────────

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Overview = lazy(() => import('./pages/Overview'));
const Financial = lazy(() => import('./pages/Financial'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Couriers = lazy(() => import('./pages/Couriers'));
const CourierDetails = lazy(() => import('./pages/CourierDetails'));
const CourierFinanceDesk = lazy(() => import('./pages/CourierFinanceDesk'));
const DispatchCenter = lazy(() => import('./pages/DispatchCenter'));
const RTOArrivalScanner = lazy(() => import('./pages/RTOArrivalScanner'));
const CustomerInsight = lazy(() => import('./pages/CustomerInsight'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const Warehouses = lazy(() => import('./pages/Warehouses'));
const HRSnapshot = lazy(() => import('./pages/HRSnapshot'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const HRAttendance = lazy(() => import('./pages/HRAttendance'));
const HRPayroll = lazy(() => import('./pages/HRPayroll'));
const HRReports = lazy(() => import('./pages/HRReports'));
const ProcurementHub = lazy(() => import('./pages/ProcurementHub'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const SettingsProfile = lazy(() => import('./pages/settings/SettingsProfile'));
const SettingsGeneral = lazy(() => import('./pages/settings/SettingsGeneral'));
const SettingsSecurity = lazy(() => import('./pages/settings/SettingsSecurity'));
const SettingsAlerts = lazy(() => import('./pages/settings/SettingsAlerts'));
const SettingsUsers = lazy(() => import('./pages/settings/SettingsUsers'));
const SettingsRoles = lazy(() => import('./pages/settings/SettingsRoles'));
const SettingsWorkspace = lazy(() => import('./pages/settings/SettingsWorkspace'));
const CourierSettings = lazy(() => import('./pages/CourierSettings'));
const SupportDesk = lazy(() => import('./pages/SupportDesk'));
const CallCenterDashboard = lazy(() => import('./pages/callcenter/CallCenterDashboard'));
const CallCenterManager = lazy(() => import('./pages/callcenter/CallCenterManager'));
const OrderControlCenter = lazy(() => import('./pages/OrderControlCenter'));
const CopilotWidget = lazy(() => import('./components/CopilotWidget'));

// Sales Channels
const SalesChannels = lazy(() => import('./pages/SalesChannels'));
const SalesChannelDetail = lazy(() => import('./pages/SalesChannelDetail'));
const PageBuilder = lazy(() => import('./pages/PageBuilder'));
const Storefront = lazy(() => import('./pages/Storefront'));
const StorefrontPreview = lazy(() => import('./pages/StorefrontPreview'));

const PlatformAdmin = lazy(() => import('./pages/PlatformAdmin'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SubscriptionExpired = lazy(() => import('./pages/SubscriptionExpired'));

import TrialBanner from './components/TrialBanner';

// ─── Loading Spinner (shown while lazy chunks load) ──────────────────────────

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}

// ─── Error Boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
          <p className="text-gray-600 mb-6 max-w-md">
            An unexpected error occurred. Please refresh the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const Layout = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { i18n } = useTranslation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();

  const isPublicRoute = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/' || location.pathname === '/forgot-password' || location.pathname.startsWith('/reset-password') || location.pathname === '/subscription-expired' || location.pathname.startsWith('/s/') || location.pathname === '/onboarding';

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

  // Listen for 402 subscription-expired events from apiFetch
  useEffect(() => {
    const handler = () => navigate('/subscription-expired');
    window.addEventListener('subscription-expired', handler);
    return () => window.removeEventListener('subscription-expired', handler);
  }, [navigate]);

  // Listen for plan-limit-reached events from apiFetch (403 + PLAN_LIMIT_*)
  useEffect(() => {
    const handler = (e) => {
      const { message } = e.detail || {};
      const toastMsg = message || 'Plan limit reached. Upgrade your plan.';
      // Dynamic import to avoid loading toast eagerly
      import('react-hot-toast').then(({ default: hotToast }) => {
        hotToast.error(toastMsg, { duration: 6000, id: 'plan-limit' });
      });
    };
    window.addEventListener('plan-limit-reached', handler);
    return () => window.removeEventListener('plan-limit-reached', handler);
  }, []);

  // Redirect authenticated users away from auth pages to the dashboard (or onboarding)
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/forgot-password' || location.pathname.startsWith('/reset-password') || location.pathname === '/';
  const needsOnboarding = user && !user.onboardingCompleted;
  if (user && isAuthPage) {
    return <Navigate to={needsOnboarding ? '/onboarding' : '/orders-hub'} replace />;
  }
  // Redirect to onboarding if not completed (except when already on /onboarding or public pages)
  if (needsOnboarding && !isPublicRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isPublicRoute) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/s/:channelSlug/:pageSlug" element={<Storefront />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex bg-gray-50 dark:bg-gray-900 min-h-screen">
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
        {/* Trial Banner */}
        <TrialBanner />
        {/* Header - Contextual */}
        <Header setMobileMenuOpen={setMobileMenuOpen} />

        {/* Dashboard Content Pages */}
        <div className="px-4 pt-10 pb-12 sm:px-8 lg:px-10 xl:px-14 2xl:px-16 w-full flex-1 flex flex-col">
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Navigate to="/orders-hub" replace />} />
                <Route path="/dashboard" element={<Overview />} />
                <Route path="/financial" element={<Financial />} />
                <Route path="/sales" element={<Navigate to={`/orders-hub${window.location.search}`} replace />} />
                <Route path="/orders-hub" element={<OrderControlCenter />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/warehouses" element={<Warehouses />} />
                <Route path="/inventory/rto-scanner" element={<RTOArrivalScanner />} />
                <Route path="/couriers" element={<Couriers />} />
                <Route path="/couriers/finance" element={<CourierFinanceDesk />} />
                <Route path="/couriers/:id" element={<CourierDetails />} />
                <Route path="/couriers/dispatch" element={<DispatchCenter />} />
                <Route path="/customers" element={<CustomerInsight />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />
                <Route path="/hr" element={<HRSnapshot />} />
                <Route path="/hr/employees/:id" element={<EmployeeProfile />} />
                <Route path="/hr/attendance" element={<HRAttendance />} />
                <Route path="/hr/payroll" element={<HRPayroll />} />
                <Route path="/hr/reports" element={<HRReports />} />
                <Route path="/procurement" element={<ProcurementHub />} />
                <Route path="/support" element={<SupportDesk />} />

                {/* Sales Channels */}
                <Route path="/sales-channels" element={<SalesChannels />} />
                <Route path="/sales-channels/:id" element={<SalesChannelDetail />} />
                <Route path="/sales-channels/:channelId/pages/:pageId/builder" element={<PageBuilder />} />
                <Route path="/sales-channels/:channelId/pages/:pageId/preview" element={<StorefrontPreview />} />

                {/* Call Center Routes */}
                <Route path="/call-center" element={<CallCenterDashboard />} />
                <Route path="/call-center/manager" element={<CallCenterManager />} />

                {/* Platform Admin */}
                <Route path="/platform-admin" element={<PlatformAdmin />} />

                {/* Settings Hub Nested Routing */}
                <Route path="/settings" element={<SettingsLayout />}>
                  <Route path="profile" element={<SettingsProfile />} />
                  <Route path="general" element={<SettingsGeneral />} />
                  <Route path="security" element={<SettingsSecurity />} />
                  <Route path="alerts" element={<SettingsAlerts />} />
                  <Route path="users" element={<SettingsUsers />} />
                  <Route path="roles" element={<SettingsRoles />} />
                  <Route path="workspace" element={<SettingsWorkspace />} />
                  <Route path="couriers" element={<CourierSettings />} />
                  {/* Default redirect for /settings */}
                  <Route path="" element={<Navigate to="profile" replace />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Global AI Copilot */}
      <Suspense fallback={null}>
        {!isPublicRoute && <CopilotWidget />}
      </Suspense>
    </div>
  );
};

import { Toaster } from 'react-hot-toast';

// ─── App Root ────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <TransactionProvider>
            <InventoryProvider>
              <CustomerProvider>
                <Router>
                  <Layout />
                  <Toaster position="bottom-right" />
                </Router>
              </CustomerProvider>
            </InventoryProvider>
          </TransactionProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
