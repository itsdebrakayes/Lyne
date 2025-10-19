const _jsxFileName = "";import React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { getInitials } from '@/lib/mockDataUtils';
import { formatDistanceToNow } from 'date-fns';

export const CustomerTable = ({ customers }) => {
  return (
    React.createElement('div', { className: "glass rounded-xl overflow-hidden"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 11}}
      , React.createElement(Table, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 12}}
        , React.createElement(TableHeader, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
          , React.createElement(TableRow, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}, "Customer")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}, "Email")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}, "Phone")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}, "Last Visited")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 19}}, "Total Visits")
            , React.createElement(TableHead, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}, "Services Used")
            , React.createElement(TableHead, { className: "w-[50px]"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}})
          )
        )
        , React.createElement(TableBody, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 24}}
          , customers.map((customer) => {
            const initials = getInitials(customer.fullName);
            const lastVisited = formatDistanceToNow(new Date(customer.lastVisited), { addSuffix: true });

            return (
              React.createElement(TableRow, { key: customer.id, className: "hover:bg-muted/50 cursor-pointer" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 31}}
                  , React.createElement('div', { className: "flex items-center gap-3"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}}
                    , React.createElement('div', { className: "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
                      , initials
                    )
                    , React.createElement('span', { className: "font-medium"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 36}}, customer.fullName)
                  )
                )
                , React.createElement(TableCell, { className: "text-sm text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}, customer.email)
                , React.createElement(TableCell, { className: "text-sm text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, customer.phone)
                , React.createElement(TableCell, { className: "text-sm"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}, lastVisited)
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}
                  , React.createElement(Badge, { variant: "secondary", __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, customer.totalVisits)
                )
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 45}}
                  , React.createElement('div', { className: "flex flex-wrap gap-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
                    , customer.servicesUsed.slice(0, 2).map((service, idx) => (
                      React.createElement(Badge, { key: idx, variant: "outline", className: "text-xs" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}
                        , service
                      )
                    ))
                    , customer.servicesUsed.length > 2 && (
                      React.createElement(Badge, { variant: "outline", className: "text-xs" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 53}}
                        , "+", customer.servicesUsed.length - 2
                      )
                    )
                  )
                )
                , React.createElement(TableCell, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 59}}
                  , React.createElement(Button, { variant: "ghost", size: "sm" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}}
                    , React.createElement(MoreVertical, { className: "w-4 h-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 61}} )
                  )
                )
              )
            );
          })
        )
      )
    )
  );
};
