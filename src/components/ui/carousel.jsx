const _jsxFileName = ""; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import * as React from "react";
import useEmblaCarousel, { } from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";






















const CarouselContext = React.createContext(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef(
  ({ orientation = "horizontal", opts, setApi, plugins, className, children, ...props }, ref) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((api) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      _optionalChain([api, 'optionalAccess', _ => _.scrollPrev, 'call', _2 => _2()]);
    }, [api]);

    const scrollNext = React.useCallback(() => {
      _optionalChain([api, 'optionalAccess', _3 => _3.scrollNext, 'call', _4 => _4()]);
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      return () => {
        _optionalChain([api, 'optionalAccess', _5 => _5.off, 'call', _6 => _6("select", onSelect)]);
      };
    }, [api, onSelect]);

    return (
      React.createElement(CarouselContext.Provider, {
        value: {
          carouselRef,
          api: api,
          opts,
          orientation: orientation || (_optionalChain([opts, 'optionalAccess', _7 => _7.axis]) === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 106}}

        , React.createElement('div', {
          ref: ref,
          onKeyDownCapture: handleKeyDown,
          className: cn("relative", className),
          role: "region",
          'aria-roledescription': "carousel",
          ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 118}}

          , children
        )
      )
    );
  },
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef(
  ({ className, ...props }, ref) => {
    const { carouselRef, orientation } = useCarousel();

    return (
      React.createElement('div', { ref: carouselRef, className: "overflow-hidden", __self: this, __source: {fileName: _jsxFileName, lineNumber: 139}}
        , React.createElement('div', {
          ref: ref,
          className: cn("flex", orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col", className),
          ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 140}}
        )
      )
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef(
  ({ className, ...props }, ref) => {
    const { orientation } = useCarousel();

    return (
      React.createElement('div', {
        ref: ref,
        role: "group",
        'aria-roledescription': "slide",
        className: cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "pl-4" : "pt-4", className),
        ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 156}}
      )
    );
  },
);
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollPrev, canScrollPrev } = useCarousel();

    return (
      React.createElement(Button, {
        ref: ref,
        variant: variant,
        size: size,
        className: cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-left-12 top-1/2 -translate-y-1/2"
            : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        ),
        disabled: !canScrollPrev,
        onClick: scrollPrev,
        ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 173}}

        , React.createElement(ArrowLeft, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 188}} )
        , React.createElement('span', { className: "sr-only", __self: this, __source: {fileName: _jsxFileName, lineNumber: 189}}, "Previous slide" )
      )
    );
  },
);
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef(
  ({ className, variant = "outline", size = "icon", ...props }, ref) => {
    const { orientation, scrollNext, canScrollNext } = useCarousel();

    return (
      React.createElement(Button, {
        ref: ref,
        variant: variant,
        size: size,
        className: cn(
          "absolute h-8 w-8 rounded-full",
          orientation === "horizontal"
            ? "-right-12 top-1/2 -translate-y-1/2"
            : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
          className,
        ),
        disabled: !canScrollNext,
        onClick: scrollNext,
        ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 201}}

        , React.createElement(ArrowRight, { className: "h-4 w-4" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 216}} )
        , React.createElement('span', { className: "sr-only", __self: this, __source: {fileName: _jsxFileName, lineNumber: 217}}, "Next slide" )
      )
    );
  },
);
CarouselNext.displayName = "CarouselNext";

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext };
