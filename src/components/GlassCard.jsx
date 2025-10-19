const _jsxFileName = "";import React from 'react';
import { cn } from "@/lib/utils";











export const GlassCard = ({ children, className, hover = false, ticket = false, onClick, style }) => {
  return (
    React.createElement('div', {
      className: cn(
        "rounded-lg",
        ticket ? "glass-ticket" : "glass",
        hover && "glass-hover cursor-pointer",
        className
      ),
      onClick: onClick,
      style: style, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}

      , children
    )
  );
};
