import * as React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

// Public Pages
import About from './pages/About';
import JoinUs from './pages/JoinUs';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import ServiceSelect from './pages/ServiceSelect';
import Ticket from './pages/Ticket';
import NotFound from './pages/NotFound';

// New Client Pages
import ClientDirectory from './pages/ClientDirectory';
import ClientLanding from './pages/ClientLanding';
import JoinQueue from './pages/JoinQueue';

// Protected Route
import { ProtectedRoute } from './components/ProtectedRoute';

// Admin Pages
import { AdminLayout } from './components/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Customers from './pages/admin/Customers';
import Services from './pages/admin/Services';
import Staff from './pages/admin/Staff';
import StaffDetail from './pages/admin/StaffDetail';
import Analytics from './pages/admin/Analytics';
import Settings from './pages/admin/Settings';
import AdminLogin from './pages/admin/Login';
import { ProtectedAdminRoute } from './components/admin/ProtectedAdminRoute';

// Client Pages
import BestTime from './pages/BestTime';

// Create QueryClient outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* New Home - Client Directory */}
              <Route path="/" element={<ClientDirectory />} />
              
              {/* About Page (former Home content) */}
              <Route path="/about" element={<About />} />
              
              {/* Client Routes */}
              <Route path="/client/:slug" element={<ClientLanding />} />
              <Route path="/client/:slug/join" element={<JoinQueue />} />
              <Route path="/client/:slug/ticket" element={<Ticket />} />
              <Route path="/client/:slug/best-time" element={<BestTime />} />
              
              {/* Auth Routes */}
              <Route path="/join-us" element={<JoinUs />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected User Routes */}
              <Route path="/service-select" element={<ProtectedRoute><ServiceSelect /></ProtectedRoute>} />
              <Route path="/ticket" element={<ProtectedRoute><Ticket /></ProtectedRoute>} />
              
              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/customers" element={<ProtectedAdminRoute><AdminLayout><Customers /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/services" element={<ProtectedAdminRoute><AdminLayout><Services /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/staff" element={<ProtectedAdminRoute><AdminLayout><Staff /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/staff/:userId" element={<ProtectedAdminRoute><AdminLayout><StaffDetail /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/analytics" element={<ProtectedAdminRoute><AdminLayout><Analytics /></AdminLayout></ProtectedAdminRoute>} />
              <Route path="/admin/settings" element={<ProtectedAdminRoute><AdminLayout><Settings /></AdminLayout></ProtectedAdminRoute>} />
              
              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
