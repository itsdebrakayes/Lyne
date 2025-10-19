const _jsxFileName = "";import React from 'react';
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    React.createElement('div', { className: "flex min-h-screen items-center justify-center bg-gray-100"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 12}}
      , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
        , React.createElement('h1', { className: "mb-4 text-4xl font-bold"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}, "404")
        , React.createElement('p', { className: "mb-4 text-xl text-gray-600"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}, "Oops! Page not found"   )
        , React.createElement('a', { href: "/", className: "text-blue-500 underline hover:text-blue-700"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}, "Return to Home"

        )
      )
    )
  );
};

export default NotFound;
