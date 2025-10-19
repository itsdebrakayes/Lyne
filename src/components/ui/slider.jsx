const _jsxFileName = "";import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef


(({ className, ...props }, ref) => (
  React.createElement(SliderPrimitive.Root, {
    ref: ref,
    className: cn("relative flex w-full touch-none select-none items-center", className),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 10}}

    , React.createElement(SliderPrimitive.Track, { className: "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 15}}
      , React.createElement(SliderPrimitive.Range, { className: "absolute h-full bg-primary"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 16}} )
    )
    , React.createElement(SliderPrimitive.Thumb, { className: "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"              , __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}} )
  )
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
