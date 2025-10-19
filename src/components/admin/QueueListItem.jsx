const _jsxFileName = "";import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Eye } from 'lucide-react';
import { getInitials } from '@/lib/mockDataUtils';
import { cn } from "@/lib/utils";

export const QueueListItem = ({ customer, service, ticketNumber, position }) => {
  const initials = getInitials(customer.fullName);

  return (
    React.createElement('div', { className: "glass rounded-lg p-4 flex items-center gap-3 hover:bg-white/10 transition-colors"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 12}}
      , React.createElement('div', { className: "w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0"         , __self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
        , initials
      )
      
      , React.createElement('div', { className: "flex-1 min-w-0"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}
        , React.createElement('p', { className: "font-medium text-foreground truncate"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}, customer.fullName)
        , React.createElement('div', { className: "flex items-center gap-2 mt-1"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}
          , React.createElement(Badge, { variant: "secondary", className: "text-xs" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}, service.name)
          , React.createElement('span', { className: "text-xs text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}, `Pos: ${position}`)
        )
      )

      , React.createElement('div', { className: "flex gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 25}}
        , React.createElement(Button, { size: "sm", variant: "outline" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 26}}
          , React.createElement(Phone, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 27}} )
        )
        , React.createElement(Button, { size: "sm", variant: "outline" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}
          , React.createElement(Eye, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}} )
        )
      )
    )
  );
};
