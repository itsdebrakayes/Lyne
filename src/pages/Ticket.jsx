const _jsxFileName = "";import React from 'react';
import { GlassCard } from "@/components/GlassCard";
import { TicketDisplay } from "@/components/TicketDisplay";
import { CircularProgress } from "@/components/CircularProgress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Users, Clock } from "lucide-react";
import { useState, useEffect } from "react";

// Mock ticket data
const mockTicketData = {
  ticketNumber: "TRN-A104",
  service: "TRN Service",
  position: 6,
  totalInQueue: 24,
  estimatedWaitMinutes: 12,
  estimatedWaitSeconds: 40,
  status: "waiting" ,
  counter: null ,
};

const Ticket = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({ fullName: "Guest" });
  const [countdown, setCountdown] = useState(mockTicketData.estimatedWaitMinutes * 60 + mockTicketData.estimatedWaitSeconds);

  useEffect(() => {
    // Get user data
    const stored = localStorage.getItem("userData");
    if (stored) {
      setUserData(JSON.parse(stored));
    }

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    React.createElement('div', { className: "min-h-screen p-4 md:p-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 45}}
      , React.createElement('div', { className: "max-w-6xl mx-auto space-y-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
        /* Welcome Header */
        , React.createElement(GlassCard, { className: "p-6 text-center animate-slide-up"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}
          , React.createElement('h1', { className: "text-2xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}, "Welcome, "
             , userData.fullName.split(" ")[0], "!"
          )
          , React.createElement('p', { className: "text-muted-foreground mt-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 52}}, "Thank you for waiting. You'll be called soon."

          )
        )

        /* Main Ticket Display */
        , React.createElement('div', { className: "grid grid-cols-1 lg:grid-cols-2 gap-6"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 58}}
          /* Left Column - Ticket */
          , React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}}
            , React.createElement(TicketDisplay, {
              ticketNumber: mockTicketData.ticketNumber,
              service: mockTicketData.service, __self: this, __source: {fileName: _jsxFileName, lineNumber: 61}}
            )

            , React.createElement(GlassCard, { className: "p-6 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 66}}
              , React.createElement('p', { className: "text-sm text-muted-foreground mb-2"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}}, "Here's your position in the queue:"

              )
              , React.createElement('div', { className: "text-4xl font-bold text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 70}}, "#", mockTicketData.position)
            )
          )

          /* Right Column - Stats */
          , React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 75}}
            /* Queue Position */
            , React.createElement(GlassCard, { className: "p-8 flex flex-col items-center justify-center space-y-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 77}}
              , React.createElement('div', { className: "flex items-center gap-2 text-muted-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 78}}
                , React.createElement(Users, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}} )
                , React.createElement('span', { className: "text-sm font-medium" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 80}}, "People in Queue"  )
              )
              , React.createElement(CircularProgress, {
                value: mockTicketData.totalInQueue - mockTicketData.position,
                max: mockTicketData.totalInQueue,
                size: 140,
                strokeWidth: 12,
                color: "primary", __self: this, __source: {fileName: _jsxFileName, lineNumber: 82}}

                , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 89}}
                  , React.createElement('div', { className: "text-3xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 90}}, mockTicketData.position)
                  , React.createElement('div', { className: "text-sm text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 91}}, "ahead")
                )
              )
            )

            /* Wait Time */
            , React.createElement(GlassCard, { className: "p-8 flex flex-col items-center justify-center space-y-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 97}}
              , React.createElement('div', { className: "flex items-center gap-2 text-muted-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 98}}
                , React.createElement(Clock, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 99}} )
                , React.createElement('span', { className: "text-sm font-medium" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 100}}, "Estimated Wait Time"  )
              )
              , React.createElement(CircularProgress, {
                value: countdown,
                max: mockTicketData.estimatedWaitMinutes * 60 + mockTicketData.estimatedWaitSeconds,
                size: 140,
                strokeWidth: 12,
                color: "secondary", __self: this, __source: {fileName: _jsxFileName, lineNumber: 102}}

                , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 109}}
                  , React.createElement('div', { className: "text-3xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 110}}
                    , minutes, ":", seconds.toString().padStart(2, "0")
                  )
                  , React.createElement('div', { className: "text-sm text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 113}}, "remaining")
                )
              )
            )

            /* FAQ Chat */
            , React.createElement(GlassCard, { className: "p-8 flex flex-col items-center justify-center space-y-4"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 119}}
              , React.createElement('div', { className: "flex items-center gap-2 text-muted-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 120}}
                , React.createElement(MessageCircle, { className: "w-5 h-5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 121}} )
                , React.createElement('span', { className: "text-sm font-medium" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 122}}, "Need Help?" )
              )
              , React.createElement(Button, {
                variant: "outline",
                className: "glass w-full" ,
                size: "lg", __self: this, __source: {fileName: _jsxFileName, lineNumber: 124}}
, "Open FAQ Chat"

              )
            )
          )
        )

        /* Status Banner */
        , React.createElement(GlassCard, { className: "p-4 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 136}}
          , React.createElement('p', { className: "text-sm", __self: this, __source: {fileName: _jsxFileName, lineNumber: 137}}, "🔴 "
             , React.createElement('span', { className: "font-semibold", __self: this, __source: {fileName: _jsxFileName, lineNumber: 138}}, "Live"), " • You'll receive a notification when it's your turn"
          )
        )

        /* Action Buttons */
        , React.createElement('div', { className: "flex gap-4 justify-center"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 143}}
          , React.createElement(Button, {
            variant: "outline",
            onClick: () => navigate("/"),
            className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 144}}
, "Back to Home"

          )
          , React.createElement(Button, {
            variant: "destructive",
            className: "bg-destructive hover:bg-destructive/90" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 151}}
, "Leave Queue"

          )
        )
      )
    )
  );
};

export default Ticket;
