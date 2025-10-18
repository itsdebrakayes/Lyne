const _jsxFileName = "";import React from 'react';
import { Button } from "@/components/ui/button";
import { VerticalSidebar } from "@/components/VerticalSidebar";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Clock, Shield } from "lucide-react";
import heroImage from "@/assets/hero-image.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    React.createElement('div', { className: "min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50/30"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 11}}
      , React.createElement(VerticalSidebar, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 12}} )
      
      /* Live Queue Updates Badge */
      , React.createElement('div', { className: "fixed top-8 left-1/2 -translate-x-1/2 z-40"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}
        , React.createElement('div', { className: "glass bg-white/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg flex items-center gap-2"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}
          , React.createElement('span', { className: "w-2 h-2 bg-green-500 rounded-full animate-pulse"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}} )
          , React.createElement('span', { className: "text-sm font-medium text-foreground/70"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}, "Live Queue Updates"  )
        )
      )

      /* Decorative blue circles */
      , React.createElement('div', { className: "absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}} )
      , React.createElement('div', { className: "absolute bottom-20 right-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl animate-pulse"        , style: { animationDelay: '1s' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}} )
      , React.createElement('div', { className: "absolute top-1/2 left-1/4 w-24 h-24 bg-primary/10 rounded-full blur-2xl"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}} )

      /* Hero Section */
      , React.createElement('section', { className: "min-h-screen flex items-center pt-24 pb-12 relative overflow-hidden"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 22}}
        , React.createElement('div', { className: "max-w-7xl mx-auto px-8 md:px-16 w-full relative"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 23}}
          , React.createElement('div', { className: "grid md:grid-cols-2 gap-12 lg:gap-16 items-center relative"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 24}}
            /* Left Content */
            , React.createElement('div', { className: "space-y-8 md:space-y-10 animate-fade-in z-10 pl-16"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 26}}
              , React.createElement('div', { className: "space-y-4 md:space-y-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 27}}
                , React.createElement('h1', { className: "text-6xl sm:text-7xl md:text-8xl font-bold leading-tight"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}}
                  , React.createElement('span', { className: "text-gray-900", __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}, "QMe")
                  , React.createElement('br', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 30}} )
                  , React.createElement('span', { className: "text-primary", __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}}, "Now")
                )
                , React.createElement('p', { className: "text-2xl sm:text-3xl md:text-4xl text-gray-700 font-medium max-w-xl"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}, "Join the Line ", React.createElement('span', { className: "text-gray-500", __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}, "— Without Standing In It"  )

                )
                , React.createElement('p', { className: "text-lg md:text-xl text-gray-600 max-w-lg leading-relaxed"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 36}}, "Smart digital queue management for Tax Administration Jamaica. Check live traffic, join remotely, and track your position in real-time."

                )
              )

              , React.createElement('div', { className: "flex flex-col sm:flex-row gap-4 md:gap-5"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 41}}
                , React.createElement(Button, {
                  size: "lg",
                  className: "text-base md:text-lg px-8 py-6 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl transition-all w-full sm:w-auto font-semibold"              ,
                  onClick: () => navigate("/taj"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 42}}
, "Join Queue (TAJ)"

                  , React.createElement(ArrowRight, { className: "ml-2 h-5 w-5"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}} )
                )
                , React.createElement(Button, {
                  size: "lg",
                  variant: "outline",
                  className: "text-base md:text-lg px-8 py-6 rounded-2xl bg-white border-0 text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg transition-all w-full sm:w-auto font-semibold"              ,
                  onClick: () => navigate("/about"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}
, "Learn More"

                )
              )

              /* Stats */
              , React.createElement('div', { className: "flex flex-wrap gap-4 md:gap-6 pt-8 md:pt-10"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 59}}
                , React.createElement('div', { className: "glass bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all min-w-[140px]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}}
                  , React.createElement('div', { className: "flex items-center gap-2 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 61}}
                    , React.createElement(Zap, { className: "h-5 w-5 text-yellow-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 62}} )
                  )
                  , React.createElement('div', { className: "text-3xl md:text-4xl font-bold text-gray-900"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 64}}, "1000+")
                  , React.createElement('div', { className: "text-sm text-gray-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 65}}, "Daily Users" )
                )
                , React.createElement('div', { className: "glass bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all min-w-[140px]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}}
                  , React.createElement('div', { className: "flex items-center gap-2 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 68}}
                    , React.createElement(Clock, { className: "h-5 w-5 text-cyan-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 69}} )
                  )
                  , React.createElement('div', { className: "text-3xl md:text-4xl font-bold text-gray-900"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 71}}, "24/7")
                  , React.createElement('div', { className: "text-sm text-gray-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 72}}, "Live Updates" )
                )
                , React.createElement('div', { className: "glass bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md hover:shadow-lg transition-all min-w-[140px]"        , __self: this, __source: {fileName: _jsxFileName, lineNumber: 74}}
                  , React.createElement('div', { className: "flex items-center gap-2 mb-2"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 75}}
                    , React.createElement(Shield, { className: "h-5 w-5 text-purple-500" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 76}} )
                  )
                  , React.createElement('div', { className: "text-3xl md:text-4xl font-bold text-gray-900"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 78}}, "100%")
                  , React.createElement('div', { className: "text-sm text-gray-600 mt-1"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}}, "Secure")
                )
              )
            )

            /* Right Content - Hero Image */
            , React.createElement('div', { className: "relative animate-fade-in md:block hidden"   , style: { animationDelay: '0.2s' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 83}}
              , React.createElement('img', { 
                src: heroImage, 
                alt: "QueMe Now Queue Management"   , 
                className: "w-full h-auto max-w-4xl xl:max-w-5xl ml-auto object-contain drop-shadow-2xl"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 84}}
              )
            )

            /* Mobile Hero Image - Bottom Right */
            , React.createElement('img', { 
              src: heroImage, 
              alt: "QueMe Now Queue Management"   , 
              className: "md:hidden fixed bottom-0 right-0 w-96 sm:w-[450px] h-auto object-contain opacity-30 z-0 pointer-events-none"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 92}}
            )
          )
        )
      )
    )
  );
};

export default Home;
