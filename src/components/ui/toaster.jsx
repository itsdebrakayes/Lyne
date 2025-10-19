const _jsxFileName = "";import React from 'react';
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    React.createElement(ToastProvider, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 8}}
      , toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          React.createElement(Toast, { key: id, ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 11}}
            , React.createElement('div', { className: "grid gap-1" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 12}}
              , title && React.createElement(ToastTitle, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 13}}, title)
              , description && React.createElement(ToastDescription, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 14}}, description)
            )
            , action
            , React.createElement(ToastClose, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 17}} )
          )
        );
      })
      , React.createElement(ToastViewport, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 21}} )
    )
  );
}
