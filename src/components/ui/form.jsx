const _jsxFileName = ""; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { Controller, FormProvider, useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;








const FormFieldContext = React.createContext({} );

const FormField = 


({
  ...props
}) => {
  return (
    React.createElement(FormFieldContext.Provider, { value: { name: props.name }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 27}}
      , React.createElement(Controller, { ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 28}} )
    )
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};





const FormItemContext = React.createContext({} );

const FormItem = React.forwardRef(
  ({ className, ...props }, ref) => {
    const id = React.useId();

    return (
      React.createElement(FormItemContext.Provider, { value: { id }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 67}}
        , React.createElement('div', { ref: ref, className: cn("space-y-2", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 68}} )
      )
    );
  },
);
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef


(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return React.createElement(Label, { ref: ref, className: cn(error && "text-destructive", className), htmlFor: formItemId, ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 81}} );
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef(
  ({ ...props }, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    return (
      React.createElement(Slot, {
        ref: ref,
        id: formItemId,
        'aria-describedby': !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`,
        'aria-invalid': !!error,
        ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 90}}
      )
    );
  },
);
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();

    return React.createElement('p', { ref: ref, id: formDescriptionId, className: cn("text-sm text-muted-foreground", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}} );
  },
);
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const body = error ? String(_optionalChain([error, 'optionalAccess', _ => _.message])) : children;

    if (!body) {
      return null;
    }

    return (
      React.createElement('p', { ref: ref, id: formMessageId, className: cn("text-sm font-medium text-destructive", className), ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 121}}
        , body
      )
    );
  },
);
FormMessage.displayName = "FormMessage";

export { useFormField, Form, FormItem, FormLabel, FormControl, FormDescription, FormMessage, FormField };
