const _jsxFileName = "";import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";


import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

const ToggleGroupContext = React.createContext({
  size: "default",
  variant: "default",
});

const ToggleGroup = React.forwardRef


(({ className, variant, size, children, ...props }, ref) => (
  React.createElement(ToggleGroupPrimitive.Root, { ref: ref, className: cn("flex items-center justify-center gap-1", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 17}}
    , React.createElement(ToggleGroupContext.Provider, { value: { variant, size }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 18}}, children)
  )
));

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef


(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);

  return (
    React.createElement(ToggleGroupPrimitive.Item, {
      ref: ref,
      className: cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      ),
      ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 31}}

      , children
    )
  );
});

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
