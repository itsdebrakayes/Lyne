import { Link, useLocation } from "react-router-dom";
import { Moon, Sun, Home, Info, Users, Building2 } from "lucide-react";
import { useTheme } from "next-themes";

export const Navbar = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "About", path: "/about", icon: Info },
    { name: "Join Us", path: "/join-us", icon: Users },
    { name: "TAJ", path: "/taj", icon: Building2 },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop: Vertical left sidebar */}
      <nav className="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 z-50">
        <div className="glass rounded-2xl p-4 shadow-xl flex flex-col gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group relative"
                title={item.name}
              >
                <div
                  className={`
                    p-3 rounded-xl transition-all duration-300
                    ${
                      isActive(item.path)
                        ? "bg-primary text-primary-foreground shadow-lg"
                        : "text-foreground/60 hover:text-primary hover:bg-primary/10"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-foreground text-background text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                  {item.name}
                </span>
              </Link>
            );
          })}

          <div className="h-px bg-border my-2" />

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-3 rounded-xl text-foreground/60 hover:text-primary hover:bg-primary/10 transition-all duration-300"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile & Tablet: Bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="glass border-t border-white/20 px-4 py-3">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-300 min-w-[70px]
                    ${
                      isActive(item.path)
                        ? "text-primary bg-primary/10"
                        : "text-foreground/60 active:bg-primary/5"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-foreground/60 active:bg-primary/5 transition-all duration-300 min-w-[70px]"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-5 h-5" />
                  <span className="text-xs font-medium">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-5 h-5" />
                  <span className="text-xs font-medium">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
