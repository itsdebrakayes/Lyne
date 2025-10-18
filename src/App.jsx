const _jsxFileName = "";import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Home from "./pages/Home";
import About from "./pages/About";
import JoinUs from "./pages/JoinUs";
import PublicTraffic from "./pages/PublicTraffic";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ServiceSelect from "./pages/ServiceSelect";
import Ticket from "./pages/Ticket";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  React.createElement(QueryClientProvider, { client: queryClient, __self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}
    , React.createElement(ThemeProvider, { attribute: "class", defaultTheme: "light", enableSystem: true, __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}
      , React.createElement(TooltipProvider, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 22}}
        , React.createElement(Toaster, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 23}} )
        , React.createElement(Sonner, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 24}} )
        , React.createElement(BrowserRouter, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 25}}
          , React.createElement(Routes, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 26}}
            , React.createElement(Route, { path: "/", element: React.createElement(Home, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 27}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 27}} )
            , React.createElement(Route, { path: "/about", element: React.createElement(About, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 28}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}} )
            , React.createElement(Route, { path: "/join-us", element: React.createElement(JoinUs, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 29}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}} )
            , React.createElement(Route, { path: "/taj", element: React.createElement(PublicTraffic, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 30}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}} )
            , React.createElement(Route, { path: "/signup", element: React.createElement(SignUp, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 31}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}} )
            , React.createElement(Route, { path: "/login", element: React.createElement(Login, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 32}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}} )
            , React.createElement(Route, { path: "/service-select", element: React.createElement(ServiceSelect, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 33}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}} )
            , React.createElement(Route, { path: "/ticket", element: React.createElement(Ticket, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 34}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}} )
            /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
            , React.createElement(Route, { path: "*", element: React.createElement(NotFound, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 36}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 36}} )
          )
        )
      )
    )
  )
);

export default App;
