const _jsxFileName = "";import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from "@/lib/utils";

export const ServiceStatBox = ({ count, label, icon, className }) => {
  const IconComponent = Icons[icon] || Icons.Circle;

  return (
    React.createElement('div', { className: cn("glass rounded-xl p-6 flex flex-col items-center justify-center space-y-3 hover:scale-105 transition-transform", className), __self: this, __source: {fileName: _jsxFileName, lineNumber: 8}}
      , React.createElement(IconComponent, { className: "w-12 h-12 text-primary" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 9}} )
      , React.createElement('div', { className: "text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 10}}
        , React.createElement('p', { className: "text-4xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 11}}, count)
        , React.createElement('p', { className: "text-sm text-muted-foreground mt-1"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 12}}, label)
      )
    )
  );
};
