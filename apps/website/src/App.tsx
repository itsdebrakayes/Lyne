import * as React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

// Marketing
import MarketingHome from './pages/MarketingHome';

import About from './pages/About';
import JoinUs from './pages/JoinUs';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import Account from './pages/Account';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MarketingHome />} />
            <Route path="/about" element={<About />} />
            <Route path="/join-us" element={<JoinUs />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Deliberately absent from the nav, the footer and the sitemap.
                Typing the URL renders <NotFound /> unless the visitor arrived
                from the app with a valid handoff — see pages/Account.tsx. */}
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
