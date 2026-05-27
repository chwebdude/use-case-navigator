import { useRef, useState } from "react";

export interface SpiderDataPoint {
  id: string;
  name: string;
  color: string;
  values: { metric: string; value: number }[];
}

interface SpiderDiagramProps {
  data: SpiderDataPoint[];
  metrics: string[];
  maxValue?: number;
  size?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  interactive?: boolean;
  onPointHover?: (point: SpiderDataPoint | null, metric: string | null) => void;
  onPointClick?: (point: SpiderDataPoint, metric: string) => void;
  highlightedId?: string | null;
}

export default function SpiderDiagram({
  data,
  metrics,
  maxValue = 10,
  size = 400,
  showLabels = true,
  showLegend = true,
  interactive = true,
  onPointHover,
  onPointClick,
  highlightedId = null,
}: SpiderDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: SpiderDataPoint;
    metric: string;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  const numAxes = metrics.length;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size - 100) / 2; // Leave space for labels
  const levels = 5; // Number of concentric circles/polygons

  // Calculate angle for each axis
  const angleStep = (2 * Math.PI) / numAxes;
  const startAngle = -Math.PI / 2; // Start from top

  // Get point coordinates for a given value and axis index
  const getPoint = (
    value: number,
    axisIndex: number,
  ): { x: number; y: number } => {
    const angle = startAngle + axisIndex * angleStep;
    const normalizedValue = Math.min(value / maxValue, 1);
    const r = radius * normalizedValue;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  // Get label position (slightly outside the chart)
  const getLabelPosition = (
    axisIndex: number,
  ): { x: number; y: number; anchor: "start" | "middle" | "end" } => {
    const angle = startAngle + axisIndex * angleStep;
    const labelRadius = radius + 25;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);

    // Determine text anchor based on position
    let anchor: "start" | "middle" | "end" = "middle";
    if (angle > -Math.PI / 4 && angle < Math.PI / 4) anchor = "start";
    else if (angle > (3 * Math.PI) / 4 || angle < -(3 * Math.PI) / 4)
      anchor = "end";

    return { x, y, anchor };
  };

  // Generate grid polygon points
  const getGridPolygon = (level: number): string => {
    const points: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const value = (maxValue * (level + 1)) / levels;
      const point = getPoint(value, i);
      points.push(`${point.x},${point.y}`);
    }
    return points.join(" ");
  };

  // Generate data polygon points
  const getDataPolygon = (dataPoint: SpiderDataPoint): string => {
    const points: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const metricName = metrics[i];
      const valueObj = dataPoint.values.find((v) => v.metric === metricName);
      const value = valueObj?.value ?? 0;
      const point = getPoint(value, i);
      points.push(`${point.x},${point.y}`);
    }
    return points.join(" ");
  };

  // Handle mouse move for interactive tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if near any data point
    let foundPoint: {
      point: SpiderDataPoint;
      metric: string;
      distance: number;
    } | null = null;

    for (const dataPoint of data) {
      for (let i = 0; i < numAxes; i++) {
        const metricName = metrics[i];
        const valueObj = dataPoint.values.find((v) => v.metric === metricName);
        const value = valueObj?.value ?? 0;
        const pointPos = getPoint(value, i);

        const distance = Math.sqrt(
          (x - pointPos.x) ** 2 + (y - pointPos.y) ** 2,
        );
        if (distance < 15 && (!foundPoint || distance < foundPoint.distance)) {
          foundPoint = { point: dataPoint, metric: metricName, distance };
        }
      }
    }

    if (foundPoint) {
      setHoveredPoint({ point: foundPoint.point, metric: foundPoint.metric });
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      onPointHover?.(foundPoint.point, foundPoint.metric);
    } else {
      setHoveredPoint(null);
      setTooltipPos(null);
      onPointHover?.(null, null);
    }
  };

  const handleClick = () => {
    if (!interactive || !hoveredPoint) return;
    onPointClick?.(hoveredPoint.point, hoveredPoint.metric);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setTooltipPos(null);
    onPointHover?.(null, null);
  };

  if (numAxes < 3) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        At least 3 metrics are required for a spider diagram
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className={interactive ? "cursor-crosshair" : ""}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid levels */}
        {Array.from({ length: levels }).map((_, level) => (
          <polygon
            key={`grid-${level}`}
            points={getGridPolygon(level)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={level === levels - 1 ? 2 : 1}
          />
        ))}

        {/* Axis lines */}
        {metrics.map((_, index) => {
          const endPoint = getPoint(maxValue, index);
          return (
            <line
              key={`axis-${index}`}
              x1={centerX}
              y1={centerY}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#d1d5db"
              strokeWidth={1}
            />
          );
        })}

        {/* Axis labels */}
        {showLabels &&
          metrics.map((metric, index) => {
            const labelPos = getLabelPosition(index);
            return (
              <text
                key={`label-${index}`}
                x={labelPos.x}
                y={labelPos.y}
                textAnchor={labelPos.anchor}
                dominantBaseline="middle"
                className="text-xs fill-gray-600 font-medium"
                style={{ fontSize: "11px" }}
              >
                {metric}
              </text>
            );
          })}

        {/* Level labels */}
        {Array.from({ length: levels }).map((_, level) => {
          const value = ((maxValue * (level + 1)) / levels).toFixed(0);
          const point = getPoint((maxValue * (level + 1)) / levels, 0);
          return (
            <text
              key={`level-label-${level}`}
              x={point.x + 5}
              y={point.y - 5}
              className="text-xs fill-gray-400"
              style={{ fontSize: "9px" }}
            >
              {value}
            </text>
          );
        })}

        {/* Data polygons */}
        {data.map((dataPoint) => {
          const isHighlighted = highlightedId === dataPoint.id;
          const isHovered = hoveredPoint?.point.id === dataPoint.id;
          const opacity = highlightedId
            ? isHighlighted
              ? 0.4
              : 0.1
            : isHovered
              ? 0.5
              : 0.25;
          const strokeWidth = isHighlighted || isHovered ? 3 : 2;

          return (
            <g key={dataPoint.id}>
              <polygon
                points={getDataPolygon(dataPoint)}
                fill={dataPoint.color}
                fillOpacity={opacity}
                stroke={dataPoint.color}
                strokeWidth={strokeWidth}
                className="transition-all duration-200"
              />
              {/* Data points */}
              {metrics.map((metric, index) => {
                const valueObj = dataPoint.values.find(
                  (v) => v.metric === metric,
                );
                const value = valueObj?.value ?? 0;
                const point = getPoint(value, index);
                const isPointHovered =
                  hoveredPoint?.point.id === dataPoint.id &&
                  hoveredPoint?.metric === metric;

                return (
                  <circle
                    key={`${dataPoint.id}-${metric}`}
                    cx={point.x}
                    cy={point.y}
                    r={isPointHovered ? 6 : 4}
                    fill={dataPoint.color}
                    stroke="white"
                    strokeWidth={2}
                    className="transition-all duration-150"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {interactive && tooltipPos && hoveredPoint && (
        <div
          className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y - 30,
          }}
        >
          <div className="font-medium">{hoveredPoint.point.name}</div>
          <div className="text-gray-300">
            {hoveredPoint.metric}:{" "}
            {hoveredPoint.point.values
              .find((v) => v.metric === hoveredPoint.metric)
              ?.value.toFixed(1) ?? 0}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && data.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {data.map((dataPoint) => (
            <div
              key={dataPoint.id}
              className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer transition-opacity ${
                highlightedId && highlightedId !== dataPoint.id
                  ? "opacity-40"
                  : "opacity-100"
              }`}
              onClick={() => {
                if (metrics.length > 0) {
                  onPointClick?.(dataPoint, metrics[0]);
                }
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dataPoint.color }}
              />
              <span className="text-gray-700">{dataPoint.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
