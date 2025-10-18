const _jsxFileName = "";import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "@/lib/utils";

const Separator = React.forwardRef


(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  React.createElement(SeparatorPrimitive.Root, {
    ref: ref,
    decorative: decorative,
    orientation: orientation,
    className: cn("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 10}}
  )
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
