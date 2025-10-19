const _jsxFileName = "";import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, ChevronRight, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const MenubarMenu = MenubarPrimitive.Menu;

const MenubarGroup = MenubarPrimitive.Group;

const MenubarPortal = MenubarPrimitive.Portal;

const MenubarSub = MenubarPrimitive.Sub;

const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

const Menubar = React.forwardRef


(({ className, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Root, {
    ref: ref,
    className: cn("flex h-10 items-center space-x-1 rounded-md border bg-background p-1", className),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 21}}
  )
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef


(({ className, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Trigger, {
    ref: ref,
    className: cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
  )
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = React.forwardRef




(({ className, inset, children, ...props }, ref) => (
  React.createElement(MenubarPrimitive.SubTrigger, {
    ref: ref,
    className: cn(
      "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 50}}

    , children
    , React.createElement(ChevronRight, { className: "ml-auto h-4 w-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 60}} )
  )
));
MenubarSubTrigger.displayName = MenubarPrimitive.SubTrigger.displayName;

const MenubarSubContent = React.forwardRef


(({ className, ...props }, ref) => (
  React.createElement(MenubarPrimitive.SubContent, {
    ref: ref,
    className: cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 69}}
  )
));
MenubarSubContent.displayName = MenubarPrimitive.SubContent.displayName;

const MenubarContent = React.forwardRef


(({ className, align = "start", alignOffset = -4, sideOffset = 8, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Portal, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 84}}
    , React.createElement(MenubarPrimitive.Content, {
      ref: ref,
      align: align,
      alignOffset: alignOffset,
      sideOffset: sideOffset,
      className: cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      ),
      ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 85}}
    )
  )
));
MenubarContent.displayName = MenubarPrimitive.Content.displayName;

const MenubarItem = React.forwardRef




(({ className, inset, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Item, {
    ref: ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}}
  )
));
MenubarItem.displayName = MenubarPrimitive.Item.displayName;

const MenubarCheckboxItem = React.forwardRef


(({ className, children, checked, ...props }, ref) => (
  React.createElement(MenubarPrimitive.CheckboxItem, {
    ref: ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    ),
    checked: checked,
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 122}}

    , React.createElement('span', { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 131}}
      , React.createElement(MenubarPrimitive.ItemIndicator, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 132}}
        , React.createElement(Check, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 133}} )
      )
    )
    , children
  )
));
MenubarCheckboxItem.displayName = MenubarPrimitive.CheckboxItem.displayName;

const MenubarRadioItem = React.forwardRef


(({ className, children, ...props }, ref) => (
  React.createElement(MenubarPrimitive.RadioItem, {
    ref: ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      className,
    ),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 145}}

    , React.createElement('span', { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center"      , __self: this, __source: {fileName: _jsxFileName, lineNumber: 153}}
      , React.createElement(MenubarPrimitive.ItemIndicator, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 154}}
        , React.createElement(Circle, { className: "h-2 w-2 fill-current"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 155}} )
      )
    )
    , children
  )
));
MenubarRadioItem.displayName = MenubarPrimitive.RadioItem.displayName;

const MenubarLabel = React.forwardRef




(({ className, inset, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Label, {
    ref: ref,
    className: cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className),
    ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 169}}
  )
));
MenubarLabel.displayName = MenubarPrimitive.Label.displayName;

const MenubarSeparator = React.forwardRef


(({ className, ...props }, ref) => (
  React.createElement(MenubarPrimitive.Separator, { ref: ref, className: cn("-mx-1 my-1 h-px bg-muted", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 181}} )
));
MenubarSeparator.displayName = MenubarPrimitive.Separator.displayName;

const MenubarShortcut = ({ className, ...props }) => {
  return React.createElement('span', { className: cn("ml-auto text-xs tracking-widest text-muted-foreground", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 186}} );
};
MenubarShortcut.displayname = "MenubarShortcut";

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
