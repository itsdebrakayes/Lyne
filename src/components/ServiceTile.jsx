const _jsxFileName = "";import React from 'react';
import { GlassCard } from "./GlassCard";
import { LoadBar } from "./LoadBar";

import { cn } from "@/lib/utils";












export const ServiceTile = ({
  title,
  icon: Icon,
  queueLength,
  eta,
  activeCounters,
  loadPercentage,
  onClick,
  className,
}) => {
  return (
    React.createElement(GlassCard, { hover: true, onClick: onClick, className: cn("p-6 space-y-4", className), __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}}
      , React.createElement('div', { className: "flex items-start justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}
        , React.createElement('div', { className: "p-3 rounded-lg bg-primary/10"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}
          , React.createElement(Icon, { className: "w-6 h-6 text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}} )
        )
        , React.createElement('div', { className: "text-right", __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
          , React.createElement('div', { className: "text-xs text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}, activeCounters, " active" )
        )
      )

      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}
        , React.createElement('h3', { className: "font-semibold text-lg mb-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}, title)
        , React.createElement('div', { className: "text-sm text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}
          , queueLength, " " , queueLength === 1 ? "person" : "people"
        )
      )

      , React.createElement(LoadBar, { percentage: loadPercentage, __self: this, __source: {fileName: _jsxFileName, lineNumber: 45}} )

      , React.createElement('div', { className: "flex items-center justify-between text-sm"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}}
        , React.createElement('span', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}, "ETA")
        , React.createElement('span', { className: "font-semibold text-primary" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}, eta)
      )
    )
  );
};
