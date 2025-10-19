const _jsxFileName = "";import * as React from "react";
import { cva, } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef


(({ className, variant, ...props }, ref) => (
  React.createElement('div', { ref: ref, role: "alert", className: cn(alertVariants({ variant }), className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 25}} )
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('h5', { ref: ref, className: cn("mb-1 font-medium leading-none tracking-tight", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}} )
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    React.createElement('div', { ref: ref, className: cn("text-sm [&_p]:leading-relaxed", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 38}} )
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
