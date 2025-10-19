const _jsxFileName = "";import React from 'react';
import { cn } from "@/lib/utils";











const colorClasses = {
  primary: "stroke-primary",
  secondary: "stroke-secondary",
  accent: "stroke-accent",
};

export const CircularProgress = ({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  className,
  children,
  color = "primary",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, (value / max) * 100);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    React.createElement('div', { className: cn("relative inline-flex items-center justify-center", className), __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}
      , React.createElement('svg', { width: size, height: size, className: "transform -rotate-90" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}}
        /* Background circle */
        , React.createElement('circle', {
          cx: size / 2,
          cy: size / 2,
          r: radius,
          strokeWidth: strokeWidth,
          className: "stroke-muted fill-none" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}
        )
        /* Progress circle */
        , React.createElement('circle', {
          cx: size / 2,
          cy: size / 2,
          r: radius,
          strokeWidth: strokeWidth,
          className: cn("fill-none transition-all duration-1000 ease-out", colorClasses[color]),
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          strokeLinecap: "round", __self: this, __source: {fileName: _jsxFileName, lineNumber: 45}}
        )
      )
      , React.createElement('div', { className: "absolute inset-0 flex items-center justify-center"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 56}}, children)
    )
  );
};
