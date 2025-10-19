const _jsxFileName = "";import React from 'react';
import { GlassCard } from "./GlassCard";






export const TicketDisplay = ({ ticketNumber, service }) => {
  return (
    React.createElement(GlassCard, { ticket: true, className: "p-8 text-center space-y-4 animate-bounce-in"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 10}}
      , React.createElement('div', { className: "text-sm font-medium text-muted-foreground uppercase tracking-wider"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 11}}, "Token Number"

      )
      , React.createElement('div', { className: "text-7xl font-bold text-primary tracking-tight"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}
        , ticketNumber
      )
      , React.createElement('div', { className: "h-px bg-border my-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}} )
      , React.createElement('div', { className: "text-xl font-semibold uppercase tracking-wider"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}
        , service
      )
    )
  );
};
