import React from 'react';
import { Link, useLocation } from "react-router-dom";
import { Home, Info, Users, FileText, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export const VerticalSidebar = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { icon: Home, path: "/", label: "Home" },
    { icon: Info, path: "/about", label: "About" },
    { icon: Users, path: "/join-us", label: "Join Us" },
    { icon: FileText, path: "/taj", label: "TAJ" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3">
      {/* Navigation Icons */}
      <div className="glass bg-white/80 backdrop-blur-md rounded-3xl p-3 shadow-xl flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                p-3 rounded-2xl transition-all duration-300 group relative
                ${
                  isActive(item.path)
                    ? "bg-primary text-white shadow-lg"
                    : "text-foreground/60 hover:bg-primary/10 hover:text-primary"
                }
              `}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-4 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="glass bg-white/80 backdrop-blur-md p-3 rounded-2xl hover:bg-primary/10 transition-all shadow-xl group"
        aria-label="Toggle theme"
        title="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5 text-foreground/60 group-hover:text-primary transition-colors" />
        ) : (
          <Moon className="h-5 w-5 text-foreground/60 group-hover:text-primary transition-colors" />
        )}
      </button>
    </div>
  );
};
