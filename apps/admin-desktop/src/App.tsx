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
import SetupWizard from './pages/SetupWizard';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <LoadingScreen />;
  if (!admin) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(admin.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRouter() {
  const { admin, loading } = useAdminAuth();
  /* A business with no branches has nothing any dashboard can show, and no
     screen that would let you fix it — so an executive lands in setup instead
     of on an empty overview. Only executives can create the first branch, so
     nobody else is sent here. */
  const branches = useQuery({
    queryKey: ['setup-branches', admin?.staffRecord.business_id],
    queryFn: () => api.get<any[]>(`/branches?business_id=${admin!.staffRecord.business_id}`),
    enabled: !!admin?.staffRecord.business_id && admin?.role === 'executive',
    staleTime: 60_000,
  });

  if (loading) return <LoadingScreen />;
  if (!admin) return <Navigate to="/login" replace />;
  if (admin.role === 'executive') {
    if (branches.isLoading) return <LoadingScreen />;
    if (branches.data && branches.data.length === 0) return <Navigate to="/setup" replace />;
  }
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
      <Route
        path="/setup"
        element={
          <ProtectedRoute roles={['executive']}>
            <SetupWizard onDone={() => { window.location.hash = '#/executive'; window.location.reload(); }} />
          </ProtectedRoute>
        }
      />

      {/* Design harness — dev builds only, so it can never ship. Lets the layout
          be reviewed without a linked Supabase login. */}
      {import.meta.env.DEV ? <Route path="/design-preview" element={<DesignPreview />} /> : null}
      {import.meta.env.DEV ? <Route path="/kiosk-preview" element={<KioskApp />} /> : null}
      {/* First-run setup is auth-gated and only appears for a business with no
          branches, so it is otherwise impossible to review. */}
      {import.meta.env.DEV ? <Route path="/setup-preview" element={<SetupWizard />} /> : null}

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
