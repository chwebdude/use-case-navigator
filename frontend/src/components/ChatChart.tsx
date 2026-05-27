import { useRef, useEffect } from "react";
import * as d3 from "d3";

export interface ChartData {
  type: "bar" | "pie" | "horizontal-bar";
  title?: string;
  data: { label: string; value: number; color?: string }[];
}

const COLORS = [
  "#00aeef",
  "#a8005c",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#84cc16",
];

function BarChart({ chart }: { chart: ChartData }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || chart.data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 60, left: 50 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(chart.data.map((d) => d.label))
      .range([0, width])
      .padding(0.3);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(chart.data, (d) => d.value) ?? 0])
      .nice()
      .range([height, 0]);

    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end")
      .style("font-size", "11px");

    g.append("g").call(d3.axisLeft(y).ticks(5)).style("font-size", "11px");

    g.selectAll(".bar")
      .data(chart.data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.label)!)
      .attr("y", (d) => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.value))
      .attr("fill", (d, i) => d.color || COLORS[i % COLORS.length])
      .attr("rx", 2);

    // Value labels on top
    g.selectAll(".label")
      .data(chart.data)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.label)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.value) - 4)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#374151")
      .text((d) => d.value);
  }, [chart]);

  return <svg ref={svgRef} />;
}

function HorizontalBarChart({ chart }: { chart: ChartData }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || chart.data.length === 0) return;

    const margin = { top: 10, right: 40, bottom: 20, left: 120 };
    const barHeight = 28;
    const height = chart.data.length * barHeight + margin.top + margin.bottom;
    const width = 400 - margin.left - margin.right;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", width + margin.left + margin.right)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(chart.data, (d) => d.value) ?? 0])
      .nice()
      .range([0, width]);

    const y = d3
      .scaleBand()
      .domain(chart.data.map((d) => d.label))
      .range([0, chart.data.length * barHeight])
      .padding(0.25);

    g.append("g")
      .attr("transform", `translate(0,${chart.data.length * barHeight})`)
      .call(d3.axisBottom(x).ticks(5))
      .style("font-size", "11px");

    g.append("g").call(d3.axisLeft(y)).style("font-size", "11px");

    g.selectAll(".bar")
      .data(chart.data)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.label)!)
      .attr("width", (d) => x(d.value))
      .attr("height", y.bandwidth())
      .attr("fill", (d, i) => d.color || COLORS[i % COLORS.length])
      .attr("rx", 2);

    g.selectAll(".label")
      .data(chart.data)
      .enter()
      .append("text")
      .attr("x", (d) => x(d.value) + 4)
      .attr("y", (d) => y(d.label)! + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("fill", "#374151")
      .text((d) => d.value);
  }, [chart]);

  return <svg ref={svgRef} />;
}

function PieChart({ chart }: { chart: ChartData }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || chart.data.length === 0) return;

    const size = 280;
    const radius = size / 2 - 20;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", size)
      .attr("height", size)
      .append("g")
      .attr("transform", `translate(${size / 2},${size / 2})`);

    const pie = d3
      .pie<{ label: string; value: number }>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; value: number }>>()
      .innerRadius(0)
      .outerRadius(radius);

    const labelArc = d3
      .arc<d3.PieArcDatum<{ label: string; value: number }>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.6);

    const arcs = g.selectAll(".arc").data(pie(chart.data)).enter().append("g");

    arcs
      .append("path")
      .attr("d", arc)
      .attr("fill", (_, i) => chart.data[i]?.color || COLORS[i % COLORS.length])
      .attr("stroke", "white")
      .attr("stroke-width", 2);

    arcs
      .append("text")
      .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#1a1a2e")
      .style("font-weight", "600")
      .text((d) => (d.data.value > 0 ? d.data.value.toString() : ""));

    // Legend below
    const legend = svg
      .append("g")
      .attr("transform", `translate(10, ${size - 10})`);

    chart.data.forEach((d, i) => {
      if (d.value === 0) return;
      const item = legend
        .append("g")
        .attr("transform", `translate(${i * 90}, 0)`);
      item
        .append("rect")
        .attr("width", 10)
        .attr("height", 10)
        .attr("rx", 2)
        .attr("fill", d.color || COLORS[i % COLORS.length]);
      item
        .append("text")
        .attr("x", 14)
        .attr("y", 9)
        .style("font-size", "10px")
        .style("fill", "#374151")
        .text(d.label);
    });
  }, [chart]);

  return <svg ref={svgRef} />;
}

/** Parse chart JSON blocks from message content */
export function parseChartBlocks(
  content: string,
): ({ type: "text"; content: string } | { type: "chart"; chart: ChartData })[] {
  const parts: (
    | { type: "text"; content: string }
    | { type: "chart"; chart: ChartData }
  )[] = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    try {
      const chart = JSON.parse(match[1]) as ChartData;
      if (chart.data && Array.isArray(chart.data)) {
        parts.push({ type: "chart", chart });
      } else {
        parts.push({ type: "text", content: match[0] });
      }
    } catch {
      parts.push({ type: "text", content: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text", content }];
}

export default function ChatChart({ chart }: { chart: ChartData }) {
  return (
    <div className="my-3 bg-white rounded-lg p-3 border border-gray-200">
      {chart.title && (
        <p className="text-xs font-semibold text-gray-600 mb-2">
          {chart.title}
        </p>
      )}
      <div className="flex justify-center">
        {chart.type === "pie" ? (
          <PieChart chart={chart} />
        ) : chart.type === "horizontal-bar" ? (
          <HorizontalBarChart chart={chart} />
        ) : (
          <BarChart chart={chart} />
        )}
      </div>
    </div>
  );
}
