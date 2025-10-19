const _jsxFileName = "";import React from 'react';
import { GlassCard } from "@/components/GlassCard";
import { ServiceTile } from "@/components/ServiceTile";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  DollarSign,
  FileText,
  CreditCard,
  Hash,
  MoreHorizontal,
} from "lucide-react";

const services = [
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
];

const ServiceSelect = () => {
  const navigate = useNavigate();

  const handleServiceSelect = (serviceId) => {
    // Store selected service
    localStorage.setItem("selectedService", serviceId);
    navigate("/ticket");
  };

  return (
    React.createElement('div', { className: "min-h-screen p-4 md:p-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 72}}
      , React.createElement('div', { className: "max-w-6xl mx-auto space-y-8"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 73}}
        , React.createElement(Button, {
          variant: "ghost",
          className: "mb-4",
          onClick: () => navigate(-1), __self: this, __source: {fileName: _jsxFileName, lineNumber: 74}}

          , React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}} ), "Back"

        )

        , React.createElement('div', { className: "text-center space-y-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 83}}
          , React.createElement('h1', { className: "text-3xl md:text-4xl font-bold"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 84}}, "Select Your Service"  )
          , React.createElement('p', { className: "text-muted-foreground text-lg" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 85}}, "Choose the service you need assistance with"

          )
        )

        , React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"    , __self: this, __source: {fileName: _jsxFileName, lineNumber: 90}}
          , services.map((service, index) => (
            React.createElement('div', {
              key: service.id,
              className: "animate-slide-up",
              style: { animationDelay: `${index * 0.1}s` }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 92}}

              , React.createElement(ServiceTile, {
                ...service,
                onClick: () => handleServiceSelect(service.id), __self: this, __source: {fileName: _jsxFileName, lineNumber: 97}}
              )
            )
          ))
        )

        , React.createElement(GlassCard, { className: "p-6 text-center" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 105}}
          , React.createElement('p', { className: "text-sm text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}}, "Select a service to receive your queue ticket"

          )
        )
      )
    )
  );
};

export default ServiceSelect;
