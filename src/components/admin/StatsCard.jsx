const _jsxFileName = "";import React from 'react';
import { cn } from "@/lib/utils";

export const StatsCard = ({ title, value, subtitle, icon: Icon, gradient = false }) => {
  return (
    React.createElement('div', {
      className: cn(
        "rounded-xl p-6 flex flex-col justify-center space-y-3",
        gradient
          ? "bg-gradient-to-br from-blue-600 to-slate-700 text-white"
          : "glass"
      ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 5}}

      , Icon && React.createElement(Icon, { className: cn("w-10 h-10", gradient ? "text-white/90" : "text-primary"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 13}} )
      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}
        , React.createElement('p', { className: cn("text-sm font-medium", gradient ? "text-white/80" : "text-muted-foreground"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}, title)
        , React.createElement('p', { className: cn("text-5xl font-bold mt-2", gradient ? "text-white" : "text-foreground"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}, value)
        , subtitle && React.createElement('p', { className: cn("text-xs mt-1", gradient ? "text-white/70" : "text-muted-foreground"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}, subtitle)
      )
    )
  );
};
