const _jsxFileName = "";import React from 'react';
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    idNumber: "",
    age: "",
    dob: undefined ,
    email: "",
    password: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Store user data (in real app, this would be sent to backend)
    localStorage.setItem("userData", JSON.stringify(formData));
    navigate("/service-select");
  };

  return (
    React.createElement('div', { className: "min-h-screen p-4 md:p-8 flex items-center justify-center"     , __self: this, __source: {fileName: _jsxFileName, lineNumber: 32}}
      , React.createElement('div', { className: "w-full max-w-md space-y-6"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 33}}
        , React.createElement(Button, {
          variant: "ghost",
          className: "mb-4",
          onClick: () => navigate("/taj"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 34}}

          , React.createElement(ArrowLeft, { className: "mr-2 h-4 w-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 39}} ), "Back"

        )

        , React.createElement('div', { className: "text-center space-y-2" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}
          , React.createElement('h1', { className: "text-3xl font-bold" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}, "Create Account" )
          , React.createElement('p', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 45}}, "Sign up to join the queue"     )
        )

        , React.createElement(GlassCard, { className: "p-6", __self: this, __source: {fileName: _jsxFileName, lineNumber: 48}}
          , React.createElement('form', { onSubmit: handleSubmit, className: "space-y-4", __self: this, __source: {fileName: _jsxFileName, lineNumber: 49}}
            , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 50}}
              , React.createElement(Label, { htmlFor: "fullName", __self: this, __source: {fileName: _jsxFileName, lineNumber: 51}}, "Full Name" )
              , React.createElement(Input, {
                id: "fullName",
                required: true,
                value: formData.fullName,
                onChange: (e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                ,
                className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 52}}
              )
            )

            , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 63}}
              , React.createElement(Label, { htmlFor: "idNumber", __self: this, __source: {fileName: _jsxFileName, lineNumber: 64}}, "ID Number" )
              , React.createElement(Input, {
                id: "idNumber",
                required: true,
                value: formData.idNumber,
                onChange: (e) =>
                  setFormData({ ...formData, idNumber: e.target.value })
                ,
                className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 65}}
              )
            )

            , React.createElement('div', { className: "grid grid-cols-2 gap-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 76}}
              , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 77}}
                , React.createElement(Label, { htmlFor: "age", __self: this, __source: {fileName: _jsxFileName, lineNumber: 78}}, "Age")
                , React.createElement(Input, {
                  id: "age",
                  type: "number",
                  required: true,
                  value: formData.age,
                  onChange: (e) =>
                    setFormData({ ...formData, age: e.target.value })
                  ,
                  className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 79}}
                )
              )

              , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 91}}
                , React.createElement(Label, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 92}}, "Date of Birth"  )
                , React.createElement(Popover, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 93}}
                  , React.createElement(PopoverTrigger, { asChild: true, __self: this, __source: {fileName: _jsxFileName, lineNumber: 94}}
                    , React.createElement(Button, {
                      variant: "outline",
                      className: cn(
                        "w-full justify-start text-left font-normal glass",
                        !formData.dob && "text-muted-foreground"
                      ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 95}}

                      , React.createElement(CalendarIcon, { className: "mr-2 h-4 w-4"  , __self: this, __source: {fileName: _jsxFileName, lineNumber: 102}} )
                      , formData.dob ? format(formData.dob, "PPP") : "Pick date"
                    )
                  )
                  , React.createElement(PopoverContent, { className: "w-auto p-0" , align: "start", __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}}
                    , React.createElement(Calendar, {
                      mode: "single",
                      selected: formData.dob,
                      onSelect: (date) =>
                        setFormData({ ...formData, dob: date })
                      ,
                      initialFocus: true,
                      className: "pointer-events-auto", __self: this, __source: {fileName: _jsxFileName, lineNumber: 107}}
                    )
                  )
                )
              )
            )

            , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 121}}
              , React.createElement(Label, { htmlFor: "email", __self: this, __source: {fileName: _jsxFileName, lineNumber: 122}}, "Email")
              , React.createElement(Input, {
                id: "email",
                type: "email",
                required: true,
                value: formData.email,
                onChange: (e) =>
                  setFormData({ ...formData, email: e.target.value })
                ,
                className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 123}}
              )
            )

            , React.createElement('div', { className: "space-y-2", __self: this, __source: {fileName: _jsxFileName, lineNumber: 135}}
              , React.createElement(Label, { htmlFor: "password", __self: this, __source: {fileName: _jsxFileName, lineNumber: 136}}, "Password")
              , React.createElement(Input, {
                id: "password",
                type: "password",
                required: true,
                value: formData.password,
                onChange: (e) =>
                  setFormData({ ...formData, password: e.target.value })
                ,
                className: "glass", __self: this, __source: {fileName: _jsxFileName, lineNumber: 137}}
              )
            )

            , React.createElement('p', { className: "text-xs text-muted-foreground" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 149}}, "By continuing, you agree to our Terms of Service and Privacy Policy"

            )

            , React.createElement(Button, {
              type: "submit",
              className: "w-full bg-primary hover:bg-primary-dark"  ,
              size: "lg", __self: this, __source: {fileName: _jsxFileName, lineNumber: 153}}
, "Continue"

            )
          )
        )

        , React.createElement('div', { className: "text-center", __self: this, __source: {fileName: _jsxFileName, lineNumber: 163}}
          , React.createElement(Button, {
            variant: "link",
            onClick: () => navigate("/login"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 164}}
, "Already have an account? Sign in"

          )
        )
      )
    )
  );
};

export default SignUp;
