import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";

// Public Pages
import About from "./pages/About";
import JoinUs from "./pages/JoinUs";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ServiceSelect from "./pages/ServiceSelect";
import Ticket from "./pages/Ticket";
import NotFound from "./pages/NotFound";

// New Client Pages
import ClientDirectory from "./pages/ClientDirectory";
import ClientLanding from "./pages/ClientLanding";

// Admin Pages
import { AdminLayout } from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Customers from "./pages/admin/Customers";
import Services from "./pages/admin/Services";
import Analytics from "./pages/admin/Analytics";
import Settings from "./pages/admin/Settings";
import AdminLogin from "./pages/admin/Login";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

const queryClient = new QueryClient();

const App = () => (
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
            <Route path="/client/:slug/ticket" element={<Ticket />} />
            
            {/* Legacy Routes (keep for backward compatibility) */}
            <Route path="/join-us" element={<JoinUs />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/service-select" element={<ServiceSelect />} />
            <Route path="/ticket" element={<Ticket />} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/admin/customers" element={<ProtectedAdminRoute><AdminLayout><Customers /></AdminLayout></ProtectedAdminRoute>} />
            <Route path="/admin/services" element={<ProtectedAdminRoute><AdminLayout><Services /></AdminLayout></ProtectedAdminRoute>} />
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

export default App;
