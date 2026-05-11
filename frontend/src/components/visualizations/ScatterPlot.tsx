import { useMemo, useRef, useState } from "react";

export interface ScatterPoint {
  id: string;
  name: string;
  x: number | null;
  y: number | null;
  size?: number | null;
  color: string;
}

export interface AxisTick {
  value: number;
  label: string;
}

interface ScatterPlotProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xTicks: AxisTick[];
  yTicks: AxisTick[];
  bubbleSizeLabel?: string;
  width?: number;
  height?: number;
  showLegend?: boolean;
  legendPosition?: "bottom" | "right";
  highlightedId?: string | null;
  onPointHover?: (point: ScatterPoint | null) => void;
  onPointClick?: (point: ScatterPoint) => void;
}

export default function ScatterPlot({
  points,
  xLabel,
  yLabel,
  xTicks,
  yTicks,
  bubbleSizeLabel,
  width = 720,
  height = 420,
  showLegend = true,
  legendPosition = "bottom",
  highlightedId = null,
  onPointHover,
  onPointClick,
}: ScatterPlotProps) {
  const margin = { top: 24, right: 24, bottom: 48, left: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<ScatterPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const xDomain = useMemo(() => {
    const values = xTicks.map((t) => t.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max };
  }, [xTicks]);

  const yDomain = useMemo(() => {
    const values = yTicks.map((t) => t.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { min, max };
  }, [yTicks]);

  const xScale = (v: number) => {
    if (v === null || Number.isNaN(v)) return 0;
    if (xDomain.max === xDomain.min) return innerWidth / 2;
    return ((v - xDomain.min) / (xDomain.max - xDomain.min)) * innerWidth;
  };
  const yScale = (v: number) => {
    if (v === null || Number.isNaN(v)) return 0;
    if (yDomain.max === yDomain.min) return innerHeight / 2;
    return (
      innerHeight -
      ((v - yDomain.min) / (yDomain.max - yDomain.min)) * innerHeight
    );
  };

  const sizeDomain = useMemo(() => {
    const values = points
      .map((point) => point.size)
      .filter((value): value is number => typeof value === "number");

    if (values.length === 0) {
      return null;
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [points]);

  const getRadius = (point: ScatterPoint) => {
    const baseRadius = 5;
    const minRadius = 4;
    const maxRadius = 11;

    if (
      !sizeDomain ||
      typeof point.size !== "number" ||
      Number.isNaN(point.size)
    ) {
      return baseRadius;
    }

    if (sizeDomain.max === sizeDomain.min) {
      return (minRadius + maxRadius) / 2;
    }

    const normalized =
      (point.size - sizeDomain.min) / (sizeDomain.max - sizeDomain.min);
    return minRadius + normalized * (maxRadius - minRadius);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltipPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHovered(null);
    setTooltipPos(null);
    onPointHover?.(null);
  };

  const legend =
    showLegend && points.length > 0 ? (
      <div
        className={
          legendPosition === "right"
            ? "flex flex-wrap gap-1.5"
            : "mt-3 flex flex-wrap gap-3 justify-center"
        }
      >
        {points.map((p) => (
          <button
            type="button"
            key={p.id}
            title={p.name}
            className={`text-left inline-flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors hover:bg-gray-100 max-w-full ${
              highlightedId && highlightedId !== p.id
                ? "opacity-40"
                : "opacity-100"
            }`}
            onMouseEnter={() => {
              setHovered(p);
              onPointHover?.(p);
            }}
            onMouseLeave={() => {
              setHovered(null);
              onPointHover?.(null);
            }}
            onClick={() => onPointClick?.(p)}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-gray-700 whitespace-nowrap truncate">
              {p.name}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div
      className={`relative ${
        legendPosition === "right" ? "flex items-start gap-4" : ""
      }`}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Gridlines */}
          {yTicks.map((t, i) => (
            <line
              key={`y-grid-${i}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(t.value)}
              y2={yScale(t.value)}
              stroke="#eef2f7"
              strokeWidth={1}
            />
          ))}
          {xTicks.map((t, i) => (
            <line
              key={`x-grid-${i}`}
              x1={xScale(t.value)}
              x2={xScale(t.value)}
              y1={0}
              y2={innerHeight}
              stroke="#eef2f7"
              strokeWidth={1}
            />
          ))}

          {/* Axis labels */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 36}
            textAnchor="middle"
            className="fill-gray-700"
          >
            {xLabel}
          </text>
          <text
            x={-innerHeight / 2}
            y={-48}
            transform="rotate(-90)"
            textAnchor="middle"
            className="fill-gray-700"
          >
            {yLabel}
          </text>

          {/* Tick labels */}
          {xTicks.map((t, i) => (
            <g
              key={`x-tick-${i}`}
              transform={`translate(${xScale(t.value)}, ${innerHeight})`}
            >
              <line x1={0} y1={0} x2={0} y2={6} stroke="#9ca3af" />
              <text
                x={0}
                y={20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {t.label}
              </text>
            </g>
          ))}
          {yTicks.map((t, i) => (
            <g
              key={`y-tick-${i}`}
              transform={`translate(0, ${yScale(t.value)})`}
            >
              <line x1={-6} y1={0} x2={0} y2={0} stroke="#9ca3af" />
              <text
                x={-12}
                y={4}
                textAnchor="end"
                className="text-xs fill-gray-600"
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Points */}
          {points.map((p) => {
            if (p.x == null || p.y == null) return null;
            const cx = xScale(p.x);
            const cy = yScale(p.y);
            const isHighlighted = highlightedId === p.id;
            const isHovered = hovered?.id === p.id;
            const r = getRadius(p) + (isHighlighted || isHovered ? 2 : 0);
            const opacity = highlightedId
              ? isHighlighted
                ? 1
                : 0.25
              : isHovered
                ? 0.9
                : 0.7;
            return (
              <g key={p.id} className="cursor-pointer">
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={p.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  opacity={opacity}
                  onMouseEnter={() => {
                    setHovered(p);
                    onPointHover?.(p);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    onPointHover?.(null);
                  }}
                  onClick={() => onPointClick?.(p)}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && tooltipPos && (
        <div
          className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
          style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 28 }}
        >
          <div className="font-medium">{hovered.name}</div>
          <div className="text-gray-300">
            {xLabel}: {hovered.x ?? "Unknown"}
          </div>
          <div className="text-gray-300">
            {yLabel}: {hovered.y ?? "Unknown"}
          </div>
          {bubbleSizeLabel && typeof hovered.size === "number" && (
            <div className="text-gray-300">
              {bubbleSizeLabel}: {hovered.size}
            </div>
          )}
        </div>
      )}

      {legendPosition === "right" ? (
        <aside className="flex-1 min-w-[320px]">
          <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Factsheets
          </div>
          {legend}
        </aside>
      ) : (
        legend
      )}
    </div>
  );
}
