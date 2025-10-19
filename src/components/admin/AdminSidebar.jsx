const _jsxFileName = "";import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, BarChart3, Briefcase } from 'lucide-react';
import { cn } from "@/lib/utils";

const navItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Customers', path: '/admin/customers', icon: Users },
  { name: 'Services', path: '/admin/services', icon: Briefcase },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

export const AdminSidebar = () => {
  return (
    React.createElement('aside', { className: "admin-sidebar fixed left-0 top-0 h-screen w-64 flex flex-col border-r border-white/10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}
      /* Logo */
      , React.createElement('div', { className: "p-6 border-b border-white/10" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}
        , React.createElement('h1', { className: "text-2xl font-bold text-white"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}, "Qme"
          , React.createElement('span', { className: "text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}, "Now")
        )
        , React.createElement('p', { className: "text-xs text-white/60 mt-1"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 22}}, "Admin Dashboard")
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
      , React.createElement('div', { className: "p-4 border-t border-white/10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
        , React.createElement('div', { className: "flex items-center gap-3 p-3 rounded-lg bg-white/5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}}
          , React.createElement('div', { className: "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}
            , "AD"
          )
          , React.createElement('div', { className: "flex-1 min-w-0"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}}
            , React.createElement('p', { className: "text-sm font-medium text-white truncate"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 52}}, "Admin User")
            , React.createElement('p', { className: "text-xs text-white/60 truncate"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 53}}, "Administrator")
          )
        )
      )
    )
  );
};
