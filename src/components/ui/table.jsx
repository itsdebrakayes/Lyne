const _jsxFileName = "";import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('div', { className: "relative w-full overflow-auto"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 7}}
      , React.createElement('table', { ref: ref, className: cn("w-full caption-bottom text-sm", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8}} )
    )
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef(
  ({ className, ...props }, ref) => React.createElement('thead', { ref: ref, className: cn("[&_tr]:border-b", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('tbody', { ref: ref, className: cn("[&_tr:last-child]:border-0", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}} )
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('tfoot', { ref: ref, className: cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}} )
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('tr', {
      ref: ref,
      className: cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className),
      ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}}
    )
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('th', {
      ref: ref,
      className: cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      ),
      ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
    )
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('td', { ref: ref, className: cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}} )
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('caption', { ref: ref, className: cn("mt-4 text-sm text-muted-foreground", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}} )
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
