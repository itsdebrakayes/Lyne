const _jsxFileName = "";import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const Pagination = ({ className, ...props }) => (
  React.createElement('nav', {
    role: "navigation",
    'aria-label': "pagination",
    className: cn("mx-auto flex w-full justify-center", className),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 8}}
  )
);
Pagination.displayName = "Pagination";

const PaginationContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('ul', { ref: ref, className: cn("flex flex-row items-center gap-1", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 19}} )
  ),
);
PaginationContent.displayName = "PaginationContent";

const PaginationItem = React.forwardRef(({ className, ...props }, ref) => (
  React.createElement('li', { ref: ref, className: cn("", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 25}} )
));
PaginationItem.displayName = "PaginationItem";






const PaginationLink = ({ className, isActive, size = "icon", ...props }) => (
  React.createElement('a', {
    'aria-current': isActive ? "page" : undefined,
    className: cn(
      buttonVariants({
        variant: isActive ? "outline" : "ghost",
        size,
      }),
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 35}}
  )
);
PaginationLink.displayName = "PaginationLink";

const PaginationPrevious = ({ className, ...props }) => (
  React.createElement(PaginationLink, { 'aria-label': "Go to previous page"   , size: "default", className: cn("gap-1 pl-2.5", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 50}}
    , React.createElement(ChevronLeft, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}} )
    , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 52}}, "Previous")
  )
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = ({ className, ...props }) => (
  React.createElement(PaginationLink, { 'aria-label': "Go to next page"   , size: "default", className: cn("gap-1 pr-2.5", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 58}}
    , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 59}}, "Next")
    , React.createElement(ChevronRight, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}} )
  )
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = ({ className, ...props }) => (
  React.createElement('span', { 'aria-hidden': true, className: cn("flex h-9 w-9 items-center justify-center", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 66}}
    , React.createElement(MoreHorizontal, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}} )
    , React.createElement('span', { className: "sr-only", __self: this, __source: {fileName: _jsxFileName, lineNumber: 68}}, "More pages" )
  )
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
