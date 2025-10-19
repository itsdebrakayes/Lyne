const _jsxFileName = "";import React from 'react';
import { Navbar } from "@/components/Navbar";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin } from "lucide-react";

const JoinUs = () => {
  return (
    React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 10}}
      , React.createElement(Navbar, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 11}} )

      , React.createElement('div', { className: "pt-32 pb-16 px-4 md:px-8"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}
        , React.createElement('div', { className: "max-w-6xl mx-auto space-y-16"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}
          /* Header */
          , React.createElement('div', { className: "text-center space-y-4 animate-fade-in"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}}
            , React.createElement('h1', { className: "text-4xl md:text-6xl font-bold text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}, "Join Us"

            )
            , React.createElement('p', { className: "text-xl text-muted-foreground max-w-3xl mx-auto"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 20}}, "Have questions or feedback? We'd love to hear from you. Get in touch with our team."

            )
          )

          , React.createElement('div', { className: "grid md:grid-cols-2 gap-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 25}}
            /* Contact Form */
            , React.createElement(GlassCard, { className: "p-8 animate-slide-up" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 27}}
              , React.createElement('form', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}}
                , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 29}}
                  , React.createElement('label', { className: "text-sm font-medium text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 30}}, "Name")
                  , React.createElement(Input, { 
                    placeholder: "Your full name"  , 
                    className: "bg-white/50", __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}}
                  )
                )

                , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 37}}
                  , React.createElement('label', { className: "text-sm font-medium text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 38}}, "Email")
                  , React.createElement(Input, { 
                    type: "email", 
                    placeholder: "your.email@example.com", 
                    className: "bg-white/50", __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}}
                  )
                )

                , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 46}}
                  , React.createElement('label', { className: "text-sm font-medium text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 47}}, "Phone")
                  , React.createElement(Input, { 
                    type: "tel", 
                    placeholder: "+1 (876) 000-0000"  , 
                    className: "bg-white/50", __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}
                  )
                )

                , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 55}}
                  , React.createElement('label', { className: "text-sm font-medium text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 56}}, "Message")
                  , React.createElement(Textarea, { 
                    placeholder: "Tell us how we can help..."     ,
                    rows: 5,
                    className: "bg-white/50", __self: this, __source: {fileName: _jsxFileName, lineNumber: 57}}
                  )
                )

                , React.createElement(Button, { 
                  type: "submit", 
                  className: "w-full bg-primary hover:bg-primary-dark text-lg py-6 rounded-full"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 64}}
, "Send Message"

                )
              )
            )

            /* Contact Info */
            , React.createElement('div', { className: "space-y-6 animate-slide-up" , style: { animationDelay: '0.1s' }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 74}}
              , React.createElement(GlassCard, { className: "p-8", __self: this, __source: {fileName: _jsxFileName, lineNumber: 75}}
                , React.createElement('div', { className: "space-y-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 76}}
                  , React.createElement('h2', { className: "text-2xl font-bold text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 77}}, "Contact Information" )

                  , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}}
                    , React.createElement('div', { className: "flex items-start gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 80}}
                      , React.createElement('div', { className: "w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 81}}
                        , React.createElement(Mail, { className: "h-6 w-6 text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 82}} )
                      )
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 84}}
                        , React.createElement('div', { className: "font-medium text-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 85}}, "Email")
                        , React.createElement('div', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 86}}, "support@quemenow.com")
                      )
                    )

                    , React.createElement('div', { className: "flex items-start gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 90}}
                      , React.createElement('div', { className: "w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 91}}
                        , React.createElement(Phone, { className: "h-6 w-6 text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 92}} )
                      )
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 94}}
                        , React.createElement('div', { className: "font-medium text-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 95}}, "Phone")
                        , React.createElement('div', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 96}}, "+1 (876) 000-0000"  )
                      )
                    )

                    , React.createElement('div', { className: "flex items-start gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 100}}
                      , React.createElement('div', { className: "w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0"       , __self: this, __source: {fileName: _jsxFileName, lineNumber: 101}}
                        , React.createElement(MapPin, { className: "h-6 w-6 text-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 102}} )
                      )
                      , React.createElement('div', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 104}}
                        , React.createElement('div', { className: "font-medium text-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 105}}, "Location")
                        , React.createElement('div', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}}, "Tax Administration Jamaica"
                            , React.createElement('br', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 107}} ), "Kingston, Jamaica"

                        )
                      )
                    )
                  )
                )
              )

              , React.createElement(GlassCard, { className: "p-8", __self: this, __source: {fileName: _jsxFileName, lineNumber: 116}}
                , React.createElement('div', { className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 117}}
                  , React.createElement('h3', { className: "text-xl font-bold text-foreground"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 118}}, "Office Hours" )
                  , React.createElement('div', { className: "space-y-2 text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 119}}
                    , React.createElement('div', { className: "flex justify-between" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 120}}
                      , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 121}}, "Monday - Friday"  )
                      , React.createElement('span', { className: "font-medium", __self: this, __source: {fileName: _jsxFileName, lineNumber: 122}}, "8:00 AM - 4:00 PM"    )
                    )
                    , React.createElement('div', { className: "flex justify-between" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 124}}
                      , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 125}}, "Saturday")
                      , React.createElement('span', { className: "font-medium", __self: this, __source: {fileName: _jsxFileName, lineNumber: 126}}, "Closed")
                    )
                    , React.createElement('div', { className: "flex justify-between" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 128}}
                      , React.createElement('span', {__self: this, __source: {fileName: _jsxFileName, lineNumber: 129}}, "Sunday")
                      , React.createElement('span', { className: "font-medium", __self: this, __source: {fileName: _jsxFileName, lineNumber: 130}}, "Closed")
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  );
};

export default JoinUs;
