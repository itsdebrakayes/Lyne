const _jsxFileName = "";import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerTable } from '@/components/admin/CustomerTable';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';

export default function Customers() {
  const { customers, searchTerm, setSearchTerm, filterType, setFilterType } = useCustomerSearch();

  return (
    React.createElement('div', { className: "space-y-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
      /* Header */
      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}
        , React.createElement('h1', { className: "text-4xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}, "Customers")
        , React.createElement('p', { className: "text-muted-foreground mt-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}, "View and manage all customer records")
      )

      /* Search and Filter Bar */
      , React.createElement('div', { className: "flex items-center gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}
        , React.createElement('div', { className: "relative flex-1 max-w-md"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 22}}
          , React.createElement(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 23}} )
          , React.createElement(Input, {
            placeholder: "Search customers...",
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            className: "pl-10", __self: this, __source: {fileName: _jsxFileName, lineNumber: 24}}
          )
        )

        , React.createElement(Select, { value: filterType, onValueChange: setFilterType, __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}}
          , React.createElement(SelectTrigger, { className: "w-[200px]"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
            , React.createElement(SlidersHorizontal, { className: "w-4 h-4 mr-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}} )
            , React.createElement(SelectValue, { placeholder: "Filter by" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}} )
          )
          , React.createElement(SelectContent, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}
            , React.createElement(SelectItem, { value: "recent", __self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}, "Last Visited (Recent)")
            , React.createElement(SelectItem, { value: "oldest", __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}, "Last Visited (Oldest)")
            , React.createElement(SelectItem, { value: "a-z", __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, "Alphabetical (A-Z)")
            , React.createElement(SelectItem, { value: "z-a", __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}, "Alphabetical (Z-A)")
            , React.createElement(SelectItem, { value: "most-visits", __self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}, "Most Visits")
          )
        )

        , React.createElement(Button, { variant: "outline" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}, "Export CSV")
      )

      /* Customer Table */
      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 50}}
        , React.createElement(CustomerTable, { customers: customers, __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}} )
      )

      /* Results Count */
      , React.createElement('div', { className: "text-sm text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 55}}
        , "Showing ", customers.length, " customer", customers.length !== 1 ? 's' : ''
      )
    )
  );
}
