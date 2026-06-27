import * as React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

// Marketing
import MarketingHome from './pages/MarketingHome';

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
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Marketing Home */}
              <Route path="/" element={<MarketingHome />} />
              {/* Client Directory */}
              <Route path="/explore" element={<ClientDirectory />} />
              
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
