import * as React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { ResponsivePage } from './components/ResponsivePage';

// Marketing
import MarketingHome from './pages/MarketingHome';

import About from './pages/About';
import JoinUs from './pages/JoinUs';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';
import Account from './pages/Account';
import MobileMarketingHome from './pages/mobile/MobileMarketingHome';
import MobileAbout from './pages/mobile/MobileAbout';
import MobileJoinUs from './pages/mobile/MobileJoinUs';
import MobilePrivacy from './pages/mobile/MobilePrivacy';
import MobileTerms from './pages/mobile/MobileTerms';
import MobileNotFound from './pages/mobile/MobileNotFound';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ResponsivePage desktop={<MarketingHome />} mobile={<MobileMarketingHome />} />} />
            <Route path="/about" element={<ResponsivePage desktop={<About />} mobile={<MobileAbout />} />} />
            <Route path="/join-us" element={<ResponsivePage desktop={<JoinUs />} mobile={<MobileJoinUs />} />} />
            <Route path="/privacy" element={<ResponsivePage desktop={<Privacy />} mobile={<MobilePrivacy />} />} />
            <Route path="/terms" element={<ResponsivePage desktop={<Terms />} mobile={<MobileTerms />} />} />
            {/* Deliberately absent from the nav, the footer and the sitemap.
                Typing the URL renders <NotFound /> unless the visitor arrived
                from the app with a valid handoff — see pages/Account.tsx. */}
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<ResponsivePage desktop={<NotFound />} mobile={<MobileNotFound />} />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
