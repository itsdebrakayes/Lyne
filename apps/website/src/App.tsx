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
import { ScrollToTop } from './components/ScrollToTop';
import useSeo from './lib/useSeo';
import MobileMarketingHome from './pages/mobile/MobileMarketingHome';
import MobileAbout from './pages/mobile/MobileAbout';
import MobileJoinUs from './pages/mobile/MobileJoinUs';
import MobilePrivacy from './pages/mobile/MobilePrivacy';
import MobileTerms from './pages/mobile/MobileTerms';
import MobileNotFound from './pages/mobile/MobileNotFound';

// The account portal needs Supabase values that are intentionally not part of
// the public repository. Load it only for /account so missing account secrets
// can never prevent the public marketing and legal pages from starting.
const Account = React.lazy(() => import('./pages/Account'));
const accountPortalConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

function AccountRoute() {
  if (!accountPortalConfigured) {
    return <ResponsivePage desktop={<NotFound />} mobile={<MobileNotFound />} />;
  }

  return (
    <React.Suspense fallback={null}>
      <Account />
    </React.Suspense>
  );
}

/**
 * Route wrapper that sets the page's own title, description and canonical.
 *
 * Written once here rather than inside each page, because every route has a
 * desktop and a mobile component and the words describing the page are a
 * property of the ROUTE, not of which layout happened to render.
 *
 * The descriptions are written for a search result, not for the page: each one
 * has to make sense read on its own, next to nine competitors, by somebody who
 * has not seen the site. That is also what an answer engine quotes.
 */
function Seo({
  title, description, path, children,
}: { title: string; description: string; path: string; children: React.ReactNode }) {
  useSeo({ title, description, path });
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={
              <Seo
                path="/"
                title="Lyne — Skip the Wait, Hold Your Spot From Your Phone"
                description="See how long the wait is before you leave home, join the line from your phone, and arrive when you are nearly up. Live queue times for agencies, banks and credit unions in Jamaica.">
                <ResponsivePage desktop={<MarketingHome />} mobile={<MobileMarketingHome />} />
              </Seo>} />
            <Route path="/about" element={
              <Seo
                path="/about"
                title="About Lyne — Why We Built a Better Queue"
                description="Lyne is a Jamaican queue management platform built to end the waiting room. Learn who we are, the problem we set out to fix, and how virtual queueing works.">
                <ResponsivePage desktop={<About />} mobile={<MobileAbout />} />
              </Seo>} />
            <Route path="/join-us" element={
              <Seo
                path="/join-us"
                title="Bring Lyne to Your Branch"
                description="Give your customers live wait times and let them hold their place from their phone, while your staff work from a live queue dashboard. Talk to us about your branches.">
                <ResponsivePage desktop={<JoinUs />} mobile={<MobileJoinUs />} />
              </Seo>} />
            <Route path="/privacy" element={
              <Seo
                path="/privacy"
                title="Privacy Policy"
                description="How Lyne collects, uses and protects your personal information, what we keep, and the choices you have.">
                <ResponsivePage desktop={<Privacy />} mobile={<MobilePrivacy />} />
              </Seo>} />
            <Route path="/terms" element={
              <Seo
                path="/terms"
                title="Terms of Service"
                description="The terms that apply when you use Lyne to join a queue or manage one.">
                <ResponsivePage desktop={<Terms />} mobile={<MobileTerms />} />
              </Seo>} />
            {/* Deliberately absent from the nav, the footer and the sitemap.
                Typing the URL renders <NotFound /> unless the visitor arrived
                from the app with a valid handoff — see pages/Account.tsx. */}
            <Route
              path="/account"
              element={<AccountRoute />}
            />
            <Route path="*" element={<ResponsivePage desktop={<NotFound />} mobile={<MobileNotFound />} />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
