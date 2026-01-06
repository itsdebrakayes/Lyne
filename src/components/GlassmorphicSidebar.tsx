import * as React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { 
  LayoutDashboard, 
  Grid3X3, 
  Users, 
  UserCog,
  BarChart3, 
  Settings, 
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Services', path: '/admin/services', icon: Grid3X3 },
  { name: 'Customers', path: '/admin/customers', icon: Users },
  { name: 'Staff', path: '/admin/staff', icon: UserCog, requiresManager: true },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart3, requiresManager: true },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

interface GlassmorphicSidebarProps {
  userRole?: string;
  onLogout?: () => void;
}

export const GlassmorphicSidebar = ({ userRole = 'staff', onLogout }: GlassmorphicSidebarProps) => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const filteredNavItems = navItems.filter(item => {
    if (item.requiresManager) {
      return userRole === 'manager' || userRole === 'executive';
    }
    return true;
  });

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate('/admin/login');
  };

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
      <div className={cn(
        "flex flex-col items-center py-4 px-2 rounded-full gap-2",
        "bg-background/80 dark:bg-card/80 backdrop-blur-xl",
        "border border-border/50 shadow-xl"
      )}>
        {/* Navigation Items */}
        {filteredNavItems.map((item) => (
          <Tooltip key={item.path}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) => cn(
                  "p-3 rounded-full transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-5 h-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">
              {item.name}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Separator */}
        <div className="w-8 h-px bg-border my-2" />

        {/* Theme Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </TooltipContent>
        </Tooltip>

        {/* Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="p-3 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Logout
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
