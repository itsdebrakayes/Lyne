const _jsxFileName = "";import React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getCustomerById, getServiceById, formatWaitTime } from '@/lib/mockDataUtils';
import { cn } from "@/lib/utils";

const statusConfig = {
  waiting: { color: 'bg-yellow-500', label: 'Waiting' },
  serving: { color: 'bg-green-500', label: 'Serving' },
  completed: { color: 'bg-gray-400', label: 'Completed' },
};

export const QueueTable = ({ entries }) => {
  return (
    React.createElement('div', { className: "glass rounded-xl overflow-hidden"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}
      , React.createElement(Table, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}
        , React.createElement(TableHeader, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}
          , React.createElement(TableRow, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}, "Position")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}, "Customer")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}, "Service")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 22}}, "Ticket #")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 23}}, "Status")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 24}}, "Wait Time")
          )
        )
        , React.createElement(TableBody, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 27}}
          , entries.map((entry) => {
            const customer = getCustomerById(entry.customerId);
            const service = getServiceById(entry.serviceId);
            const status = statusConfig[entry.status];

            return (
              React.createElement(TableRow, { key: entry.id, className: "hover:bg-muted/50" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
                , React.createElement(TableCell, { className: "font-medium"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}
                  , entry.status === 'serving' ? 'Now' : `#${entry.position}`
                )
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}, customer?.fullName || 'Unknown')
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}, service?.name || 'Unknown')
                , React.createElement(TableCell, { className: "font-mono text-xs"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}, entry.ticketNumber)
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}
                  , React.createElement('div', { className: "flex items-center gap-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}
                    , React.createElement('div', { className: cn("w-2 h-2 rounded-full", status.color), __self: this, __source: {fileName: _jsxFileName, lineNumber: 42}} )
                    , React.createElement('span', { className: "text-sm"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, status.label)
                  )
                )
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
                  , entry.status === 'waiting' ? formatWaitTime(entry.estimatedWaitMinutes) : '-'
                )
              )
            );
          })
        )
      )
    )
  );
};
