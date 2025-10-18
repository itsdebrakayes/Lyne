const _jsxFileName = "";import React from 'react';
import { Navbar } from "@/components/Navbar";
import { GlassCard } from "@/components/GlassCard";
import { Clock, Users, Shield, Zap } from "lucide-react";

const About = () => {
  const features = [
    {
      icon: Clock,
      title: "Save Time",
      description: "Check wait times before you leave home and plan your visit accordingly.",
    },
    {
      icon: Users,
      title: "Real-time Updates",
      description: "Get live updates on queue status and your position in line.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and handled with the highest security standards.",
    },
    {
      icon: Zap,
      title: "Fast & Efficient",
      description: "Streamlined process to get you in and out as quickly as possible.",
    },
  ];

  return (
    React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}
      , React.createElement(Navbar, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 31}} )

      , React.createElement('div', { className: "pt-32 pb-16 px-4 md:px-8"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
        , React.createElement('div', { className: "max-w-6xl mx-auto space-y-16"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}
          /* Header */
          , React.createElement('div', { className: "text-center space-y-4 animate-fade-in"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 36}}
            , React.createElement('h1', { className: "text-4xl md:text-6xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}, "About QueMe Now"

            )
            , React.createElement('p', { className: "text-xl text-muted-foreground max-w-3xl mx-auto"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 40}}, "Revolutionizing the way you interact with Tax Administration Jamaica through smart technology and real-time data."

            )
          )

          /* Mission */
          , React.createElement(GlassCard, { className: "p-8 md:p-12 animate-slide-up"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
            , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}}
              , React.createElement('h2', { className: "text-3xl font-bold text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}, "Our Mission" )
              , React.createElement('p', { className: "text-lg text-muted-foreground leading-relaxed"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}, "QueMe Now is designed to eliminate the frustration of long wait times and uncertainty. We provide real-time traffic information, remote queue joining, and live position tracking to make your visit to Tax Administration Jamaica as smooth and efficient as possible."



              )
            )
          )

          /* Features Grid */
          , React.createElement('div', { className: "grid md:grid-cols-2 gap-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 58}}
            , features.map((feature, index) => (
              React.createElement(GlassCard, {
                key: feature.title,
                className: "p-8 animate-slide-up" ,
                style: { animationDelay: `${index * 0.1}s` }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}}

                , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 65}}
                  , React.createElement('div', { className: "w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 66}}
                    , React.createElement(feature.icon, { className: "h-8 w-8 text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}} )
                  )
                  , React.createElement('h3', { className: "text-2xl font-bold text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 69}}, feature.title)
                  , React.createElement('p', { className: "text-muted-foreground leading-relaxed" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 70}}
                    , feature.description
                  )
                )
              )
            ))
          )

          /* How It Works */
          , React.createElement('div', { className: "space-y-8 animate-slide-up" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}}
            , React.createElement('h2', { className: "text-3xl md:text-4xl font-bold text-center text-foreground"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 80}}, "How It Works"

            )
            , React.createElement('div', { className: "grid md:grid-cols-3 gap-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 83}}
              , [
                { step: 1, title: "Check Traffic", desc: "View live traffic data for all services" },
                { step: 2, title: "Join Queue", desc: "Select your service and get your ticket" },
                { step: 3, title: "Track Position", desc: "Monitor your position in real-time" },
              ].map((item) => (
                React.createElement(GlassCard, { key: item.step, className: "p-8 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 89}}
                  , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 90}}
                    , React.createElement('div', { className: "w-16 h-16 mx-auto bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold"          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 91}}
                      , item.step
                    )
                    , React.createElement('h3', { className: "text-xl font-bold text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 94}}, item.title)
                    , React.createElement('p', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 95}}, item.desc)
                  )
                )
              ))
            )
          )
        )
      )
    )
  );
};

export default About;
