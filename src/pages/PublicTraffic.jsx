const _jsxFileName = "";import React from 'react';
import { GlassCard } from "@/components/GlassCard";
import { StatusChip } from "@/components/StatusChip";
import { ServiceTile } from "@/components/ServiceTile";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import {
  DollarSign,
  FileText,
  CreditCard,
  Hash,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";

// Mock data - will be replaced with real-time data later
const mockTrafficData = {
  status: "moderate" ,
  estWaitMin: 24,
  estWaitMax: 35,
  activeCounters: 4,
  services: [
    {
      id: "cashier",
      title: "Cashier",
      icon: DollarSign,
      queueLength: 18,
      eta: "~22 min",
      activeCounters: 3,
      loadPercentage: 75,
    },
    {
      id: "titles",
      title: "Titles",
      icon: FileText,
      queueLength: 12,
      eta: "~18 min",
      activeCounters: 2,
      loadPercentage: 60,
    },
    {
      id: "license",
      title: "License",
      icon: CreditCard,
      queueLength: 24,
      eta: "~32 min",
      activeCounters: 4,
      loadPercentage: 85,
    },
    {
      id: "trn",
      title: "TRN",
      icon: Hash,
      queueLength: 8,
      eta: "~12 min",
      activeCounters: 2,
      loadPercentage: 40,
    },
    {
      id: "other",
      title: "Other Services",
      icon: MoreHorizontal,
      queueLength: 6,
      eta: "~10 min",
      activeCounters: 1,
      loadPercentage: 30,
    },
  ],
};

const PublicTraffic = () => {
  const navigate = useNavigate();

  return (
    React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 pb-8"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 75}}
      /* Logo/Home Button */
      , React.createElement('button', {
        onClick: () => navigate("/"),
        className: "fixed top-4 left-4 md:top-6 md:left-6 z-50 glass bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl flex items-center gap-2 hover:bg-primary/10 transition-all"                    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 77}}

        , React.createElement(Home, { className: "h-4 w-4 md:h-5 md:w-5 text-primary"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 81}} )
        , React.createElement('span', { className: "text-sm md:text-base font-bold text-primary"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 82}}, "QueMe Now" )
      )

      , React.createElement('div', { className: "max-w-7xl mx-auto space-y-8 pt-20 p-4 md:p-8"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 85}}
        /* Header */
        , React.createElement('div', { className: "text-center space-y-2 md:space-y-4 animate-slide-up"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 87}}
          , React.createElement('h1', { className: "text-3xl md:text-4xl lg:text-5xl font-bold"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 88}}, "Live Traffic at TAJ"

          )
          , React.createElement('p', { className: "text-base md:text-lg text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 91}}, "facilitated by QueMeNow"

          )
          , React.createElement('p', { className: "text-xs md:text-sm text-muted-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 94}}, "Updated just now • "
                , mockTrafficData.activeCounters, " counters active"
          )
        )

        /* Mind Map Layout - Desktop */
        , React.createElement('div', { className: "hidden md:block relative min-h-[800px]"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 100}}
          /* SVG for connecting lines */
          , React.createElement('svg', { className: "absolute inset-0 w-full h-full pointer-events-none"    , style: { zIndex: 0 }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 102}}
            , mockTrafficData.services.map((service, index) => {
              const angle = (index / mockTrafficData.services.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 280;
              const x1 = 50;
              const y1 = 50;
              const x2 = 50 + Math.cos(angle) * (radius / 8);
              const y2 = 50 + Math.sin(angle) * (radius / 8);
              
              return (
                React.createElement('line', {
                  key: service.id,
                  x1: `${x1}%`,
                  y1: `${y1}%`,
                  x2: `${x2}%`,
                  y2: `${y2}%`,
                  stroke: "hsl(var(--primary))",
                  strokeWidth: "2",
                  strokeOpacity: "0.3",
                  strokeDasharray: "5,5",
                  className: "animate-pulse", __self: this, __source: {fileName: _jsxFileName, lineNumber: 112}}
                )
              );
            })
          )

          /* Center Circle - Status */
          , React.createElement('div', { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 129}}
            , React.createElement(GlassCard, { className: "w-64 h-64 rounded-full flex flex-col items-center justify-center space-y-4 animate-slide-up"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 130}}
              , React.createElement(StatusChip, { status: mockTrafficData.status, __self: this, __source: {fileName: _jsxFileName, lineNumber: 131}} )
              , React.createElement('div', { className: "text-center space-y-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 132}}
                , React.createElement('div', { className: "text-4xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 133}}
                  , mockTrafficData.estWaitMin, "–", mockTrafficData.estWaitMax
                )
                , React.createElement('p', { className: "text-xs text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 136}}, "minutes")
              )
            )
          )

          /* Services around the circle */
          , mockTrafficData.services.map((service, index) => {
            const angle = (index / mockTrafficData.services.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 280;
            const x = 50 + Math.cos(angle) * (radius / 8);
            const y = 50 + Math.sin(angle) * (radius / 8);
            
            return (
              React.createElement('div', {
                key: service.id,
                className: "absolute animate-slide-up" ,
                style: {
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  animationDelay: `${index * 0.1}s`,
                  zIndex: 1,
                }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 149}}

                , React.createElement('div', { className: "w-48", __self: this, __source: {fileName: _jsxFileName, lineNumber: 160}}
                  , React.createElement(ServiceTile, {
                    ...service,
                    onClick: () => navigate("/signup"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 161}}
                  )
                )
              )
            );
          })
        )

        /* Mobile Layout - Stacked */
        , React.createElement('div', { className: "md:hidden space-y-6" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 172}}
          /* Center Status Card */
          , React.createElement(GlassCard, { className: "p-6 flex flex-col items-center justify-center space-y-4 animate-slide-up mx-auto max-w-sm"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 174}}
            , React.createElement(StatusChip, { status: mockTrafficData.status, __self: this, __source: {fileName: _jsxFileName, lineNumber: 175}} )
            , React.createElement('div', { className: "text-center space-y-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 176}}
              , React.createElement('div', { className: "text-3xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 177}}
                , mockTrafficData.estWaitMin, "–", mockTrafficData.estWaitMax
              )
              , React.createElement('p', { className: "text-xs text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 180}}, "minutes estimated wait"  )
            )
          )

          /* Services List */
          , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 185}}
            , mockTrafficData.services.map((service, index) => (
              React.createElement('div', {
                key: service.id,
                className: "animate-slide-up",
                style: { animationDelay: `${index * 0.1}s` }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 187}}

                , React.createElement(ServiceTile, {
                  ...service,
                  onClick: () => navigate("/signup"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 192}}
                )
              )
            ))
          )
        )

        /* Action Area */
        , React.createElement('div', { className: "flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 202}}
          , React.createElement(Button, {
            size: "lg",
            className: "text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full bg-primary hover:bg-primary-dark w-full sm:w-auto"          ,
            onClick: () => navigate("/signup"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 203}}
, "Join Queue"

            , React.createElement(ArrowRight, { className: "ml-2 h-4 w-4 md:h-5 md:w-5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 209}} )
          )
          , React.createElement(Button, {
            variant: "outline",
            size: "lg",
            className: "text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full glass w-full sm:w-auto"         ,
            onClick: () => navigate("/login"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 211}}
, "Already have a ticket?"

          )
        )

        /* Live Ticker - Placeholder for future */
        , React.createElement(GlassCard, { className: "p-3 md:p-4 text-center text-xs md:text-sm text-muted-foreground"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 222}}
          , React.createElement('div', { className: "animate-pulse-glow", __self: this, __source: {fileName: _jsxFileName, lineNumber: 223}}, "🔴 Live • System operational • All services available"

          )
        )
      )
    )
  );
};

export default PublicTraffic;
