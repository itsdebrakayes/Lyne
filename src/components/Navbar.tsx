import { Link, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export const Navbar = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "Join Us", path: "/join-us" },
    { name: "TAJ", path: "/taj" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 flex items-center gap-4 max-w-full">
      <nav className="glass bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-full px-4 md:px-8 py-3 md:py-4 shadow-xl flex items-center gap-4 md:gap-8 overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`
              text-sm md:text-base font-medium transition-all duration-300 relative whitespace-nowrap
              ${
                isActive(item.path)
                  ? "text-primary"
                  : "text-foreground/70 hover:text-primary"
              }
            `}
          >
            {item.name}
            {isActive(item.path) && (
              <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        ))}
      </nav>
      
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="glass bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-2 md:p-3 rounded-full hover:bg-primary/10 transition-colors shadow-xl flex-shrink-0"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4 md:h-5 md:w-5 text-foreground/70" />
        ) : (
          <Moon className="h-4 w-4 md:h-5 md:w-5 text-foreground/70" />
        )}
      </button>
    </div>
  );
};
