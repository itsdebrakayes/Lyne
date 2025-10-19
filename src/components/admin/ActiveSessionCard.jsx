const _jsxFileName = "";import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CircularProgress } from '@/components/CircularProgress';
import { CheckCircle } from 'lucide-react';
import { getCustomerById, getServiceById, calculateTimeRemaining } from '@/lib/mockDataUtils';
import { cn } from "@/lib/utils";

export const ActiveSessionCard = ({ session, queueEntry }) => {
  const [timeRemaining, setTimeRemaining] = useState(
    calculateTimeRemaining(session.startedAt, session.timeLimitMinutes)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(session.startedAt, session.timeLimitMinutes);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startedAt, session.timeLimitMinutes]);

  const customer = getCustomerById(queueEntry.customerId);
  const service = getServiceById(queueEntry.serviceId);
  const progress = ((session.timeLimitMinutes - timeRemaining) / session.timeLimitMinutes) * 100;

  return (
    React.createElement('div', { className: "glass rounded-xl p-6 space-y-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}
      , React.createElement('div', { className: "flex items-center justify-between"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}
        , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 31}}
          , React.createElement('p', { className: "font-semibold text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}}, customer?.fullName || 'Unknown')
          , React.createElement('p', { className: "text-sm text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}, queueEntry.ticketNumber)
        )
        , React.createElement(Badge, { variant: "outline", className: "text-xs" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}}
          , "Counter ", session.counterNumber
        )
      )

      , React.createElement('div', { className: "flex items-center justify-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}
        , React.createElement(CircularProgress, { value: timeRemaining, max: session.timeLimitMinutes, size: 120, color: "primary", __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}
          , React.createElement('div', { className: "text-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}
            , React.createElement('p', { className: "text-3xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, timeRemaining)
            , React.createElement('p', { className: "text-xs text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}, "min left")
          )
        )
      )

      , React.createElement('div', { className: "space-y-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}
        , React.createElement(Badge, { className: "w-full justify-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 50}}, service?.name || 'Service')
        , React.createElement(Button, { className: "w-full", variant: "default" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}}
          , React.createElement(CheckCircle, { className: "w-4 h-4 mr-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 52}} )
          , "Complete Service"
        )
      )
    )
  );
};
