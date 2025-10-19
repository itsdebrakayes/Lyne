const _jsxFileName = "";import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, BarChart3, Briefcase, LogOut } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Customers', path: '/admin/customers', icon: Users },
  { name: 'Services', path: '/admin/services', icon: Briefcase },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

export const AdminSidebar = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    React.createElement('aside', { className: "admin-sidebar fixed left-0 top-0 h-screen w-64 flex flex-col border-r border-white/10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}
      /* Logo */
      , React.createElement('div', { className: "p-6 border-b border-white/10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}
        , React.createElement('h1', { className: "text-2xl font-bold text-white"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}, "TAJ Queues"
        )
        , React.createElement('p', { className: "text-xs text-white/60 mt-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}, "Facilitated by "
          , React.createElement('span', { className: "text-primary font-medium"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}, "QmeNow")
        )
      )

      /* Navigation */
      , React.createElement('nav', { className: "flex-1 p-4 space-y-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 26}}
        , navItems.map((item) => (
          React.createElement(NavLink, {
            key: item.path,
            to: item.path,
            end: item.path === '/admin',
            className: ({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                "text-white/70 hover:text-white hover:bg-white/5",
                isActive && "admin-nav-item-active text-white"
              ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}}

            , React.createElement(item.icon, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}} )
            , React.createElement('span', { className: "font-medium"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, item.name)
          )
        ))
      )

      /* User Profile */
      , React.createElement('div', { className: "p-4 border-t border-white/10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 53}}
        , React.createElement(Popover, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 54}}
          , React.createElement(PopoverTrigger, { asChild: true, __self: this, __source: {fileName: _jsxFileName, lineNumber: 55}}
            , React.createElement('button', { className: "w-full flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 56}}
              , React.createElement('div', { className: "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 57}}
                , admin?.name?.substring(0, 2).toUpperCase() || "AD"
              )
              , React.createElement('div', { className: "flex-1 min-w-0 text-left"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}}
                , React.createElement('p', { className: "text-sm font-medium text-white truncate"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 61}}, admin?.name || "Admin User")
                , React.createElement('p', { className: "text-xs text-white/60 truncate"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 62}}, "Administrator")
              )
            )
          )
          , React.createElement(PopoverContent, { className: "w-56 p-2", align: "end", side: "right", __self: this, __source: {fileName: _jsxFileName, lineNumber: 66}}
            , React.createElement(Button, {
              variant: "ghost",
              className: "w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50",
              onClick: handleLogout, __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}}
              , React.createElement(LogOut, { className: "w-4 h-4 mr-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 71}} )
              , "Log Out"
            )
          )
        )
      )
    )
  );
};
