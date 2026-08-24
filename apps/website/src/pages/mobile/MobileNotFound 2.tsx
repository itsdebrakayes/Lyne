import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";

export default function MobileNotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-lyne-night text-white">
      <MobileMarketingNav />
      <main className="flex flex-1 items-center justify-center px-5 py-16 text-center">
        <div>
          <h1 className="text-6xl font-bold tracking-tight">404</h1>
          <p className="mt-4 text-lg text-lyne-lavender/70">Oops! Page not found</p>
          <a href="/" className="btn btn-primary mt-8 min-h-12 w-full">
            Return to home
          </a>
        </div>
      </main>
      <MobileMarketingFooter />
    </div>
  );
}
