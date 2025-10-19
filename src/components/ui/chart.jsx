const _jsxFileName = ""; function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } ;

 










const ChartContext = React.createContext(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef





(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    React.createElement(ChartContext.Provider, { value: { config }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 43}}
      , React.createElement('div', {
        'data-chart': chartId,
        ref: ref,
        className: cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        ),
        ...props, __self: this, __source: {fileName: _jsxFileName, lineNumber: 44}}

        , React.createElement(ChartStyle, { id: chartId, config: config, __self: this, __source: {fileName: _jsxFileName, lineNumber: 53}} )
        , React.createElement(RechartsPrimitive.ResponsiveContainer, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 54}}, children)
      )
    )
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }) => {
  const colorConfig = Object.entries(config).filter(([_, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    React.createElement('style', {
      dangerouslySetInnerHTML: {
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = _optionalChain([itemConfig, 'access', _2 => _2.theme, 'optionalAccess', _3 => _3[theme ]]) || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 69}}
    )
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef









(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !_optionalChain([payload, 'optionalAccess', _4 => _4.length])) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item.dataKey || item.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string"
          ? _optionalChain([config, 'access', _5 => _5[label ], 'optionalAccess', _6 => _6.label]) || label
          : _optionalChain([itemConfig, 'optionalAccess', _7 => _7.label]);

      if (labelFormatter) {
        return React.createElement('div', { className: cn("font-medium", labelClassName), __self: this, __source: {fileName: _jsxFileName, lineNumber: 137}}, labelFormatter(value, payload));
      }

      if (!value) {
        return null;
      }

      return React.createElement('div', { className: cn("font-medium", labelClassName), __self: this, __source: {fileName: _jsxFileName, lineNumber: 144}}, value);
    }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

    if (!active || !_optionalChain([payload, 'optionalAccess', _8 => _8.length])) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      React.createElement('div', {
        ref: ref,
        className: cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className,
        ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 154}}

        , !nestLabel ? tooltipLabel : null
        , React.createElement('div', { className: "grid gap-1.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 162}}
          , payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload.fill || item.color;

            return (
              React.createElement('div', {
                key: item.dataKey,
                className: cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center",
                ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 169}}

                , formatter && _optionalChain([item, 'optionalAccess', _9 => _9.value]) !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  React.createElement(React.Fragment, null
                    , _optionalChain([itemConfig, 'optionalAccess', _10 => _10.icon]) ? (
                      React.createElement(itemConfig.icon, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 181}} )
                    ) : (
                      !hideIndicator && (
                        React.createElement('div', {
                          className: cn("shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]", {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          }),
                          style: 
                            {
                              "--color-bg": indicatorColor,
                              "--color-border": indicatorColor,
                            } 
                          , __self: this, __source: {fileName: _jsxFileName, lineNumber: 184}}
                        )
                      )
                    )
                    , React.createElement('div', {
                      className: cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-end" : "items-center",
                      ), __self: this, __source: {fileName: _jsxFileName, lineNumber: 200}}

                      , React.createElement('div', { className: "grid gap-1.5" , __self: this, __source: {fileName: _jsxFileName, lineNumber: 206}}
                        , nestLabel ? tooltipLabel : null
                        , React.createElement('span', { className: "text-muted-foreground", __self: this, __source: {fileName: _jsxFileName, lineNumber: 208}}, _optionalChain([itemConfig, 'optionalAccess', _11 => _11.label]) || item.name)
                      )
                      , item.value && (
                        React.createElement('span', { className: "font-mono font-medium tabular-nums text-foreground"   , __self: this, __source: {fileName: _jsxFileName, lineNumber: 211}}
                          , item.value.toLocaleString()
                        )
                      )
                    )
                  )
                )
              )
            );
          })
        )
      )
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltip";

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef






(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();

  if (!_optionalChain([payload, 'optionalAccess', _12 => _12.length])) {
    return null;
  }

  return (
    React.createElement('div', {
      ref: ref,
      className: cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className), __self: this, __source: {fileName: _jsxFileName, lineNumber: 245}}

      , payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);

        return (
          React.createElement('div', {
            key: item.value,
            className: cn("flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"), __self: this, __source: {fileName: _jsxFileName, lineNumber: 254}}

            , _optionalChain([itemConfig, 'optionalAccess', _13 => _13.icon]) && !hideIcon ? (
              React.createElement(itemConfig.icon, {__self: this, __source: {fileName: _jsxFileName, lineNumber: 259}} )
            ) : (
              React.createElement('div', {
                className: "h-2 w-2 shrink-0 rounded-[2px]"   ,
                style: {
                  backgroundColor: item.color,
                }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 261}}
              )
            )
            , _optionalChain([itemConfig, 'optionalAccess', _14 => _14.label])
          )
        );
      })
    )
  );
});
ChartLegendContent.displayName = "ChartLegend";

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(config, payload, key) {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const payloadPayload =
    "payload" in payload && typeof payload.payload === "object" && payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey = key;

  if (key in payload && typeof payload[key ] === "string") {
    configLabelKey = payload[key ] ;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key ] === "string"
  ) {
    configLabelKey = payloadPayload[key ] ;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key ];
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
