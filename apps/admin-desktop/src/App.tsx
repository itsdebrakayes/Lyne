import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuth } from './hooks/useAdminAuth';
import LoginPage from './pages/Login';
import StaffDashboard from './pages/StaffDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import LoadingScreen from './components/LoadingScreen';
import DesignPreview from './pages/DesignPreview';
import KioskApp from './kiosk/KioskApp';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <LoadingScreen />;
  if (!admin) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(admin.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRouter() {
  const { admin, loading } = useAdminAuth();
  if (loading) return <LoadingScreen />;
  if (!admin) return <Navigate to="/login" replace />;
  switch (admin.role) {
    case 'executive':  return <Navigate to="/executive"  replace />;
    case 'manager':    return <Navigate to="/manager"    replace />;
    case 'supervisor': return <Navigate to="/supervisor" replace />;
    default:           return <Navigate to="/staff"      replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleRouter />} />

      {/* Design harness — dev builds only, so it can never ship. Lets the layout
          be reviewed without a linked Supabase login. */}
      {import.meta.env.DEV ? <Route path="/design-preview" element={<DesignPreview />} /> : null}
      {import.meta.env.DEV ? <Route path="/kiosk-preview" element={<KioskApp />} /> : null}

      <Route
        path="/staff"
        element={
          <ProtectedRoute roles={['line_staff']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supervisor"
        element={
          <ProtectedRoute roles={['supervisor']}>
            <SupervisorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/manager"
        element={
          <ProtectedRoute roles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive"
        element={
          <ProtectedRoute roles={['executive']}>
            <ExecutiveDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
