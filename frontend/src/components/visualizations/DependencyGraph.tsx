import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  type Connection,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  getBezierPath,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { exportElementToPng } from "../../lib/pngExport";
import type {
  FactsheetExpanded,
  Dependency,
  PropertyDefinition,
} from "../../types";
import { useAppSettings } from "../../hooks/useAppSettings";
import { getStatusMeta, getStatusTextColor } from "../../lib/statusConfig";
import { VerifiedCheck } from "../ui";

export interface ConnectionRequest {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
}

export interface DependencyGraphExportHandlers {
  png: () => Promise<void>;
  svg: () => Promise<void>;
}

export interface GraphViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface DependencyGraphViewportHandlers {
  getViewport: () => GraphViewportState | null;
  setViewport: (viewport: GraphViewportState) => Promise<void>;
  fitView: () => Promise<void>;
}

interface DependencyGraphProps {
  factsheets: FactsheetExpanded[];
  dependencies: Dependency[];
  onNodeClick?: (factsheetId: string) => void;
  onNodeRightClick?: (factsheetId: string) => void;
  onConnect?: (connection: ConnectionRequest) => void;
  onEdgeClick?: (dependencyId: string) => void;
  displayProperties?: string[];
  propertyDefinitions?: PropertyDefinition[];
  factsheetPropertyValues?: Map<string, Map<string, string>>;
  showComments?: boolean;
  focusedFactsheetId?: string | null;
  unrelatedDisplayMode?: "dim" | "hide";
  onExportHandlerChange?: (
    handlers: DependencyGraphExportHandlers | null,
  ) => void;
  onViewportHandlerChange?: (
    handlers: DependencyGraphViewportHandlers | null,
  ) => void;
}

interface PropertyDisplay {
  name: string;
  value: string;
}

interface FactsheetNodeProps {
  data: {
    label: string;
    statusLabel: string;
    statusColor: string;
    typeColor: string;
    typeName: string;
    factsheetId: string;
    properties?: PropertyDisplay[];
    dimmed?: boolean;
    reviewed?: boolean;
  };
}

const NODE_WIDTH = 200;
const NODE_BASE_HEIGHT = 80;
const PROPERTY_LINE_HEIGHT = 20;
const GRAPH_EXPORT_PADDING = 60;

function getNodeWidth(node: Node): number {
  return node.measured?.width ?? node.width ?? NODE_WIDTH;
}

function getNodeRenderHeight(node: Node): number {
  return node.measured?.height ?? node.height ?? getNodeHeight(node);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapSvgText(
  value: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return [];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, Math.max(1, maxCharsPerLine - 1)) + "…");
      currentLine = "";
    }

    if (lines.length === maxLines) {
      return lines;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (
    lines.length === maxLines &&
    words.join(" ").length > lines.join(" ").length
  ) {
    const lastLine = lines[maxLines - 1];
    lines[maxLines - 1] =
      `${lastLine.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
  }

  return lines;
}

function downloadSvg(svgContent: string, fileName: string): void {
  const blob = new Blob([svgContent], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildDependencyGraphSvg(nodes: Node[], edges: Edge[]): string {
  if (nodes.length === 0) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>',
    ].join("");
  }

  const bounds = getNodesBounds(nodes);
  const width = Math.max(1, Math.ceil(bounds.width + GRAPH_EXPORT_PADDING * 2));
  const height = Math.max(
    1,
    Math.ceil(bounds.height + GRAPH_EXPORT_PADDING * 2),
  );
  const offsetX = GRAPH_EXPORT_PADDING - bounds.x;
  const offsetY = GRAPH_EXPORT_PADDING - bounds.y;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edgeSvg = edges
    .map((edge) => {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) {
        return "";
      }

      const sourceWidth = getNodeWidth(sourceNode);
      const sourceHeight = getNodeRenderHeight(sourceNode);
      const sourceX = sourceNode.position.x + offsetX + sourceWidth / 2;
      const sourceY = sourceNode.position.y + offsetY + sourceHeight;
      const targetWidth = getNodeWidth(targetNode);
      const targetX = targetNode.position.x + offsetX + targetWidth / 2;
      const targetY = targetNode.position.y + offsetY;
      const [path, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition: Position.Bottom,
        targetX,
        targetY,
        targetPosition: Position.Top,
      });
      const isDimmed =
        (edge.data as { dimmed?: boolean } | undefined)?.dimmed === true;
      const stroke = isDimmed ? "#d1d5db" : "#00aeef";
      const opacity = isDimmed ? 0.3 : 1;
      const label = typeof edge.label === "string" ? edge.label.trim() : "";
      const labelLines = label ? wrapSvgText(label, 30, 2) : [];
      const labelWidth =
        labelLines.length > 0
          ? Math.max(...labelLines.map((line) => line.length)) * 6.2 + 16
          : 0;
      const labelHeight =
        labelLines.length > 0 ? labelLines.length * 12 + 8 : 0;

      return [
        `<path d="${escapeXml(path)}" fill="none" stroke="${stroke}" stroke-width="2" opacity="${opacity}" marker-end="url(#${isDimmed ? "arrow-dim" : "arrow-primary"})" />`,
        labelLines.length > 0
          ? `<g opacity="${opacity}"><rect x="${(labelX - labelWidth / 2).toFixed(1)}" y="${(labelY - labelHeight / 2).toFixed(1)}" width="${labelWidth.toFixed(1)}" height="${labelHeight.toFixed(1)}" rx="6" fill="#ffffff" fill-opacity="0.92" /><text x="${labelX.toFixed(1)}" y="${(labelY - (labelLines.length - 1) * 6).toFixed(1)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="${isDimmed ? "#9ca3af" : "#6b7280"}">${labelLines
              .map(
                (line, index) =>
                  `<tspan x="${labelX.toFixed(1)}" dy="${index === 0 ? 0 : 12}">${escapeXml(line)}</tspan>`,
              )
              .join("")}</text></g>`
          : "",
      ].join("");
    })
    .join("");

  const nodeSvg = nodes
    .map((node) => {
      const data = node.data as FactsheetNodeProps["data"];
      const x = node.position.x + offsetX;
      const y = node.position.y + offsetY;
      const nodeWidth = getNodeWidth(node);
      const nodeHeight = getNodeRenderHeight(node);
      const isDimmed = data.dimmed === true;
      const cardFill = isDimmed ? "#f3f4f6" : "#ffffff";
      const textColor = isDimmed ? "#9ca3af" : "#0f172a";
      const secondaryTextColor = isDimmed ? "#9ca3af" : "#6b7280";
      const typeColor = isDimmed ? "#9ca3af" : data.typeColor;
      const statusColor = isDimmed ? "#d1d5db" : data.statusColor;
      const statusTextColor = isDimmed
        ? "#6b7280"
        : getStatusTextColor(data.statusColor);
      const opacity = isDimmed ? 0.55 : 1;
      const titleMaxChars = Math.max(12, Math.floor((nodeWidth - 32) / 6.8));
      const titleLines = wrapSvgText(data.label, titleMaxChars, 1);
      const typeBadgeWidth = Math.max(44, data.typeName.length * 6.4 + 14);
      const statusBadgeWidth = Math.max(48, data.statusLabel.length * 6.2 + 18);
      const properties = data.properties ?? [];

      return [
        `<g opacity="${opacity}">`,
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${nodeWidth.toFixed(1)}" height="${nodeHeight.toFixed(1)}" rx="10" fill="${cardFill}" stroke="#e5e7eb" stroke-width="2" />`,
        `<rect x="${(x + 16).toFixed(1)}" y="${(y + 15).toFixed(1)}" width="12" height="12" fill="${typeColor}" />`,
        `<rect x="${(x + 36).toFixed(1)}" y="${(y + 12).toFixed(1)}" width="${typeBadgeWidth.toFixed(1)}" height="18" rx="4" fill="${typeColor}" />`,
        `<text x="${(x + 36 + typeBadgeWidth / 2).toFixed(1)}" y="${(y + 24.5).toFixed(1)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" fill="#ffffff">${escapeXml(data.typeName)}</text>`,
        `<text x="${(x + 16).toFixed(1)}" y="${(y + 50).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="500" fill="${textColor}">${titleLines
          .map(
            (line, index) =>
              `<tspan x="${(x + 16).toFixed(1)}" dy="${index === 0 ? 0 : 14}">${escapeXml(line)}</tspan>`,
          )
          .join("")}</text>`,
        `<rect x="${(x + 16).toFixed(1)}" y="${(y + 65).toFixed(1)}" width="${statusBadgeWidth.toFixed(1)}" height="20" rx="10" fill="${statusColor}" />`,
        `<text x="${(x + 16 + statusBadgeWidth / 2).toFixed(1)}" y="${(y + 79).toFixed(1)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="500" fill="${statusTextColor}">${escapeXml(data.statusLabel)}</text>`,
        properties.length > 0
          ? `<line x1="${(x + 16).toFixed(1)}" y1="${(y + 87).toFixed(1)}" x2="${(x + nodeWidth - 16).toFixed(1)}" y2="${(y + 87).toFixed(1)}" stroke="#e5e7eb" stroke-width="1" />`
          : "",
        properties
          .map((property, index) => {
            const rowY = y + 104 + index * PROPERTY_LINE_HEIGHT;

            return [
              `<text x="${(x + 16).toFixed(1)}" y="${rowY.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="${secondaryTextColor}">${escapeXml(property.name)}:</text>`,
              `<text x="${(x + nodeWidth - 16).toFixed(1)}" y="${rowY.toFixed(1)}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="600" fill="${textColor}">${escapeXml(property.value)}</text>`,
            ].join("");
          })
          .join(""),
        `</g>`,
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Dependency graph export">`,
    "<defs>",
    '<marker id="arrow-primary" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#00aeef" /></marker>',
    '<marker id="arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d1d5db" /></marker>',
    "</defs>",
    `<rect width="${width}" height="${height}" fill="#f9fafb" />`,
    edgeSvg,
    nodeSvg,
    "</svg>",
  ].join("");
}

// Calculate node height based on number of properties
function getNodeHeight(node: Node): number {
  const properties = (node.data as { properties?: PropertyDisplay[] })
    .properties;
  if (!properties || properties.length === 0) {
    return NODE_BASE_HEIGHT;
  }
  // Add extra height for property section: border + padding + each property line
  return NODE_BASE_HEIGHT + 16 + properties.length * PROPERTY_LINE_HEIGHT;
}

// Auto-layout using dagre
function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB", // Top to bottom
    nodesep: 80, // Horizontal spacing
    ranksep: 100, // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre with dynamic heights
  nodes.forEach((node) => {
    const height = getNodeHeight(node);
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const height = getNodeHeight(node);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Custom node for factsheets
function FactsheetNode({ data }: FactsheetNodeProps) {
  const hasProperties = data.properties && data.properties.length > 0;
  const isDimmed = data.dimmed === true;

  return (
    <div
      className={`px-4 py-3 border-2 shadow-sm min-w-[180px] transition-opacity ${
        isDimmed ? "bg-gray-100 opacity-30" : "bg-white"
      } border-gray-200`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-accent-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3"
          style={{ backgroundColor: isDimmed ? "#9ca3af" : data.typeColor }}
        />
        <span
          className="px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: isDimmed ? "#9ca3af" : data.typeColor }}
        >
          {data.typeName}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={`font-medium text-sm ${isDimmed ? "text-gray-400" : "text-primary-900"}`}
        >
          {data.label}
        </div>
        {data.reviewed && (
          <VerifiedCheck className={isDimmed ? "opacity-70" : ""} />
        )}
      </div>
      <div className="mt-1">
        <span
          className="inline-flex px-2 py-0.5 text-xs rounded-full"
          style={{
            backgroundColor: isDimmed ? "#d1d5db" : data.statusColor,
            color: isDimmed ? "#6b7280" : getStatusTextColor(data.statusColor),
          }}
        >
          {data.statusLabel}
        </span>
      </div>
      {hasProperties && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {data.properties!.map((prop, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-gray-500">{prop.name}:</span>
              <span
                className={`font-medium ${isDimmed ? "text-gray-400" : "text-primary-900"}`}
              >
                {prop.value}
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-accent-500 !w-3 !h-3"
      />
    </div>
  );
}

const nodeTypes = {
  factsheet: FactsheetNode,
};

export default function DependencyGraph({
  factsheets,
  dependencies,
  onNodeClick,
  onNodeRightClick,
  onConnect,
  onEdgeClick,
  displayProperties = [],
  propertyDefinitions = [],
  factsheetPropertyValues,
  showComments = true,
  focusedFactsheetId,
  unrelatedDisplayMode = "dim",
  onExportHandlerChange,
  onViewportHandlerChange,
}: DependencyGraphProps) {
  const graphWrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<{
    getViewport: () => GraphViewportState;
    setViewport: (
      viewport: GraphViewportState,
      options?: { duration?: number },
    ) => Promise<boolean>;
    fitView: (options?: {
      padding?: number;
      minZoom?: number;
      maxZoom?: number;
      duration?: number;
    }) => Promise<boolean>;
  } | null>(null);

  const {
    settings: { statuses: globalStatuses },
  } = useAppSettings();

  // Calculate related factsheet IDs when a factsheet is focused
  // Includes the full dependency chain (upstream and downstream)
  const relatedFactsheetIds = useMemo(() => {
    if (!focusedFactsheetId) return null;

    const related = new Set<string>();
    related.add(focusedFactsheetId);

    // Build adjacency lists for traversal
    const downstream = new Map<string, string[]>(); // factsheet -> what it depends on
    const upstream = new Map<string, string[]>(); // factsheet -> what depends on it

    dependencies.forEach((dep) => {
      if (!downstream.has(dep.factsheet)) {
        downstream.set(dep.factsheet, []);
      }
      downstream.get(dep.factsheet)!.push(dep.depends_on);

      if (!upstream.has(dep.depends_on)) {
        upstream.set(dep.depends_on, []);
      }
      upstream.get(dep.depends_on)!.push(dep.factsheet);
    });

    // Traverse downstream (what the focused factsheet depends on, recursively)
    const traverseDownstream = (id: string) => {
      const deps = downstream.get(id) || [];
      for (const depId of deps) {
        if (!related.has(depId)) {
          related.add(depId);
          traverseDownstream(depId);
        }
      }
    };

    // Traverse upstream (what depends on the focused factsheet, recursively)
    const traverseUpstream = (id: string) => {
      const deps = upstream.get(id) || [];
      for (const depId of deps) {
        if (!related.has(depId)) {
          related.add(depId);
          traverseUpstream(depId);
        }
      }
    };

    traverseDownstream(focusedFactsheetId);
    traverseUpstream(focusedFactsheetId);

    return related;
  }, [focusedFactsheetId, dependencies]);

  // Build property name lookup
  const propertyNameMap = useMemo(() => {
    const map = new Map<string, string>();
    propertyDefinitions.forEach((pd) => map.set(pd.id, pd.name));
    return map;
  }, [propertyDefinitions]);

  // Compute nodes and edges from props
  const { nodes: computedNodes, edges: computedEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create factsheet nodes
    factsheets.forEach((fs) => {
      // Skip unrelated nodes if hide mode is active
      if (
        relatedFactsheetIds &&
        unrelatedDisplayMode === "hide" &&
        !relatedFactsheetIds.has(fs.id)
      ) {
        return;
      }

      const typeColor = fs.expand?.type?.color || "#6b7280";
      const typeName = fs.expand?.type?.name || "Unknown";
      const statusMeta = getStatusMeta(
        fs.status_id || fs.status,
        globalStatuses,
        fs.expand?.type,
      );

      // Get properties to display for this factsheet
      const properties: PropertyDisplay[] = [];
      if (displayProperties.length > 0 && factsheetPropertyValues) {
        const fsProps = factsheetPropertyValues.get(fs.id);
        if (fsProps) {
          displayProperties.forEach((propId) => {
            const value = fsProps.get(propId);
            const name = propertyNameMap.get(propId);
            if (value && name) {
              properties.push({ name, value });
            }
          });
        }
      }

      // Determine if node should be dimmed
      const isDimmed =
        relatedFactsheetIds !== null && !relatedFactsheetIds.has(fs.id);

      nodes.push({
        id: `fs-${fs.id}`,
        type: "factsheet",
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: fs.name,
          statusLabel: statusMeta.label,
          statusColor: statusMeta.color,
          typeColor,
          typeName,
          factsheetId: fs.id,
          properties,
          dimmed: isDimmed,
          reviewed: Boolean(fs.reviewed),
        },
      });
    });

    // Create edges for dependencies
    const nodeIds = new Set(nodes.map((node) => node.id));
    dependencies.forEach((dep) => {
      // Only add edge if both nodes exist
      const sourceExists = nodeIds.has(`fs-${dep.factsheet}`);
      const targetExists = nodeIds.has(`fs-${dep.depends_on}`);

      if (sourceExists && targetExists) {
        // Check if this edge connects related nodes (both source and target must be related)
        const isRelatedEdge =
          relatedFactsheetIds === null ||
          (relatedFactsheetIds.has(dep.factsheet) &&
            relatedFactsheetIds.has(dep.depends_on));
        const isDimmedEdge = !isRelatedEdge && unrelatedDisplayMode === "dim";

        edges.push({
          id: `e-${dep.id}`,
          source: `fs-${dep.factsheet}`,
          target: `fs-${dep.depends_on}`,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDimmedEdge ? "#d1d5db" : undefined,
          },
          style: {
            stroke: isDimmedEdge ? "#d1d5db" : "#00aeef",
            strokeWidth: 2,
            cursor: "pointer",
            opacity: isDimmedEdge ? 0.3 : 1,
          },
          label: showComments ? dep.description || "" : "",
          labelStyle: {
            fontSize: 10,
            fill: isDimmedEdge ? "#d1d5db" : "#6b7280",
            cursor: "pointer",
            opacity: isDimmedEdge ? 0.3 : 1,
          },
          labelBgStyle: { fill: "white", fillOpacity: 0.8, cursor: "pointer" },
          data: { dependencyId: dep.id, dimmed: isDimmedEdge },
        });
      }
    });

    // Apply dagre layout
    return getLayoutedElements(nodes, edges);
  }, [
    factsheets,
    dependencies,
    displayProperties,
    factsheetPropertyValues,
    propertyNameMap,
    showComments,
    relatedFactsheetIds,
    unrelatedDisplayMode,
    globalStatuses,
  ]);

  // Use state hooks for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Track previous state to detect meaningful changes
  const prevNodeStateRef = useRef<string>("");
  const prevEdgeStateRef = useRef<string>("");

  // Sync state with computed values when props change
  useEffect(() => {
    // Create stable state string including dimmed status, properties, labels, and status for comparison
    const nodeState = computedNodes
      .map((n) => {
        const data = n.data as {
          dimmed?: boolean;
          properties?: PropertyDisplay[];
          statusLabel?: string;
          statusColor?: string;
          reviewed?: boolean;
        };
        const propsStr =
          data.properties?.map((p) => `${p.name}:${p.value}`).join("|") || "";
        return `${n.id}:${data.dimmed}:${propsStr}:${data.statusLabel}:${data.statusColor}:${data.reviewed}`;
      })
      .sort()
      .join(",");
    const edgeState = computedEdges
      .map(
        (e) =>
          `${e.id}:${(e.data as { dimmed?: boolean })?.dimmed}:${e.label || ""}`,
      )
      .sort()
      .join(",");

    // Update if node state changed (IDs, dimmed status, or properties)
    if (prevNodeStateRef.current !== nodeState) {
      prevNodeStateRef.current = nodeState;
      setNodes(computedNodes);
    }
    // Update if edge state changed (IDs, dimmed status, or labels)
    if (prevEdgeStateRef.current !== edgeState) {
      prevEdgeStateRef.current = edgeState;
      setEdges(computedEdges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedNodes, computedEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "factsheet" && onNodeClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeClick(factsheetId);
      }
    },
    [onNodeClick],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!onConnect || !connection.source || !connection.target) return;

      // Extract factsheet IDs from node IDs (remove 'fs-' prefix)
      const sourceId = connection.source.replace("fs-", "");
      const targetId = connection.target.replace("fs-", "");

      // Don't allow self-connections
      if (sourceId === targetId) return;

      // Check if dependency already exists
      const exists = dependencies.some(
        (dep) => dep.factsheet === sourceId && dep.depends_on === targetId,
      );
      if (exists) return;

      // Find factsheet names
      const sourceFs = factsheets.find((fs) => fs.id === sourceId);
      const targetFs = factsheets.find((fs) => fs.id === targetId);

      if (sourceFs && targetFs) {
        onConnect({
          sourceId,
          targetId,
          sourceName: sourceFs.name,
          targetName: targetFs.name,
        });
      }
    },
    [onConnect, dependencies, factsheets],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        // Extract dependency ID from edge id (remove 'e-' prefix)
        const dependencyId = edge.id.replace("e-", "");
        onEdgeClick(dependencyId);
      }
    },
    [onEdgeClick],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type === "factsheet" && onNodeRightClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeRightClick(factsheetId);
      }
    },
    [onNodeRightClick],
  );

  const exportToPng = useCallback(async () => {
    const currentNodes = nodesRef.current;

    if (!graphWrapperRef.current || currentNodes.length === 0) {
      return;
    }

    const viewportElement = graphWrapperRef.current.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;

    if (!viewportElement) {
      return;
    }

    const bounds = getNodesBounds(currentNodes);
    const imageWidth = Math.max(Math.round(bounds.width + 120), 800);
    const imageHeight = Math.max(Math.round(bounds.height + 120), 600);
    const { x, y, zoom } = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.1,
      2,
      0.1,
    );

    await exportElementToPng(viewportElement, {
      fileName: "dependency-graph.png",
      width: imageWidth,
      height: imageHeight,
      targetScale: 4,
      style: {
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      },
    });
  }, []);

  const exportToSvg = useCallback(async () => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (currentNodes.length === 0) {
      return;
    }

    const svgContent = buildDependencyGraphSvg(currentNodes, currentEdges);
    downloadSvg(svgContent, "dependency-graph.svg");
  }, []);

  useEffect(() => {
    if (!onExportHandlerChange) {
      return;
    }

    onExportHandlerChange({
      png: exportToPng,
      svg: exportToSvg,
    });

    return () => {
      onExportHandlerChange(null);
    };
  }, [exportToPng, exportToSvg, onExportHandlerChange]);

  const getViewport = useCallback((): GraphViewportState | null => {
    return reactFlowInstanceRef.current?.getViewport() ?? null;
  }, []);

  const setViewport = useCallback(async (viewport: GraphViewportState) => {
    if (!reactFlowInstanceRef.current) {
      return;
    }

    await reactFlowInstanceRef.current.setViewport(viewport, { duration: 0 });
  }, []);

  const fitView = useCallback(async () => {
    if (!reactFlowInstanceRef.current) {
      return;
    }

    await reactFlowInstanceRef.current.fitView({
      padding: 0.1,
      minZoom: 0.02,
      duration: 200,
    });
  }, []);

  useEffect(() => {
    if (!onViewportHandlerChange) {
      return;
    }

    onViewportHandlerChange({
      getViewport,
      setViewport,
      fitView,
    });

    return () => {
      onViewportHandlerChange(null);
    };
  }, [fitView, getViewport, onViewportHandlerChange, setViewport]);

  return (
    <div
      ref={graphWrapperRef}
      className="w-full h-full min-h-[200px] bg-gray-50"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeClick={handleEdgeClick}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        fitView
        fitViewOptions={{
          padding: 0.25,
          minZoom: 0.02,
        }}
        minZoom={0.02}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: "#00aeef", strokeWidth: 2 }}
      >
        <Controls fitViewOptions={{ padding: 0.25, minZoom: 0.02 }} />
        <Background color="#e5e7eb" gap={20} />
      </ReactFlow>
    </div>
  );
}
