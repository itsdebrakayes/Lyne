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
import { AdminLayout } from "./components/admin/AdminLayout";
import { Dashboard, Customers, Services, Analytics, Settings } from "./pages/admin";
import AdminLogin from "./pages/admin/Login";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";

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
            /* Admin Routes */
            , React.createElement(Route, { path: "/admin/login", element: React.createElement(AdminLogin, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 39}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}} )
            , React.createElement(Route, { path: "/admin", element: React.createElement(ProtectedAdminRoute, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, React.createElement(AdminLayout, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, React.createElement(Dashboard, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 40}} ))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}} )
            , React.createElement(Route, { path: "/admin/customers", element: React.createElement(ProtectedAdminRoute, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}, React.createElement(AdminLayout, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}, React.createElement(Customers, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 41}} ))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}} )
            , React.createElement(Route, { path: "/admin/services", element: React.createElement(ProtectedAdminRoute, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}, React.createElement(AdminLayout, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}, React.createElement(Services, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 42}} ))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 42}} )
            , React.createElement(Route, { path: "/admin/analytics", element: React.createElement(ProtectedAdminRoute, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, React.createElement(AdminLayout, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}, React.createElement(Analytics, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 43}} ))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}} )
            , React.createElement(Route, { path: "/admin/settings", element: React.createElement(ProtectedAdminRoute, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}, React.createElement(AdminLayout, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}, React.createElement(Settings, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 44}} ))), __self: this, __source: {fileName: _jsxFileName, lineNumber: 44}} )
            /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
            , React.createElement(Route, { path: "*", element: React.createElement(NotFound, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 36}} ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 36}} )
          )
        )
      )
    )
  )
);

export default App;
