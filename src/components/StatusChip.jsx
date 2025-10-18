const _jsxFileName = "";import React from 'react';
import { cn } from "@/lib/utils";








const statusConfig = {
  busy: {
    label: "Busy",
    className: "bg-status-busy text-white",
  },
  moderate: {
    label: "Moderate",
    className: "bg-status-moderate text-white",
  },
  light: {
    label: "Light",
    className: "bg-status-light text-white",
  },
};

export const StatusChip = ({ status, className }) => {
  const config = statusConfig[status];

  return (
    React.createElement('div', {
      className: cn(
        "inline-flex items-center px-6 py-3 rounded-full font-semibold text-lg shadow-lg animate-pulse-glow",
        config.className,
        className
      ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}

      , config.label
    )
  );
};
