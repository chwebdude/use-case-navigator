import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Pencil, Focus, Network } from "lucide-react";
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
  DependencyGraphViewState,
} from "../../types";
import { useAppSettings } from "../../hooks/useAppSettings";
import { getStatusMeta, getStatusTextColor } from "../../lib/statusConfig";
import { VerifiedCheck } from "../ui";
import {
  getRelatedFactsheetIds,
  type DependencyRelationMode,
} from "../../lib/dependencyRelations";

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
  onFocusedFactsheetChange?: (factsheetId: string | null) => void;
  unrelatedDisplayMode?: "dim" | "hide";
  enableViewControls?: boolean;
  enableExportControls?: boolean;
  layoutKey?: number;
  initialView?: DependencyGraphViewState;
  onViewStateHandlerChange?: (
    handler: (() => DependencyGraphViewState) | null,
  ) => void;
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
const EMPTY_DISPLAY_PROPERTIES: string[] = [];
const EMPTY_PROPERTY_DEFINITIONS: PropertyDefinition[] = [];

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
  displayProperties = EMPTY_DISPLAY_PROPERTIES,
  propertyDefinitions = EMPTY_PROPERTY_DEFINITIONS,
  factsheetPropertyValues,
  showComments = true,
  focusedFactsheetId,
  onFocusedFactsheetChange,
  unrelatedDisplayMode = "dim",
  enableViewControls = false,
  enableExportControls = false,
  layoutKey = 0,
  initialView,
  onViewStateHandlerChange,
  onExportHandlerChange,
  onViewportHandlerChange,
}: DependencyGraphProps) {
  const [contextMenu, setContextMenu] = useState<{
    kind: "edge" | "node";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const [hiddenDependencyIds, setHiddenDependencyIds] = useState<string[]>(initialView?.hiddenDependencyIds ?? []);
  const [hiddenFactsheetIds, setHiddenFactsheetIds] = useState<string[]>(initialView?.hiddenFactsheetIds ?? []);
  const [addedFactsheetIds, setAddedFactsheetIds] = useState<string[]>(initialView?.addedFactsheetIds ?? []);
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(null);
  const [relationMode, setRelationMode] = useState<DependencyRelationMode>(initialView?.relationMode ?? "chain");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const activeFactsheetId = onFocusedFactsheetChange
    ? focusedFactsheetId
    : selectedFactsheetId ?? focusedFactsheetId;
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
    loading: settingsLoading,
  } = useAppSettings();

  const relatedFactsheetIds = useMemo(() => {
    if (!activeFactsheetId) return null;
    return getRelatedFactsheetIds(activeFactsheetId, dependencies, relationMode);
  }, [activeFactsheetId, dependencies, relationMode]);
  const effectiveDisplayMode = relationMode === "chain" ? unrelatedDisplayMode : "hide";

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
      const isAddedToView = addedFactsheetIds.includes(fs.id);
      // Skip unrelated nodes if hide mode is active
      if (
        relatedFactsheetIds &&
        effectiveDisplayMode === "hide" &&
        !relatedFactsheetIds.has(fs.id) &&
        !isAddedToView
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
        relatedFactsheetIds !== null &&
        !relatedFactsheetIds.has(fs.id) &&
        !isAddedToView;

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
            relatedFactsheetIds.has(dep.depends_on)) ||
          (addedFactsheetIds.includes(dep.factsheet) &&
            addedFactsheetIds.includes(dep.depends_on));
        const isDimmedEdge = !isRelatedEdge && effectiveDisplayMode === "dim";

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
    effectiveDisplayMode,
    addedFactsheetIds,
    globalStatuses,
  ]);

  // Use state hooks for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);
  const addedFactsheetIdSet = useMemo(() => new Set(addedFactsheetIds), [addedFactsheetIds]);
  const hiddenNodeIds = useMemo(() => new Set(hiddenFactsheetIds
    .filter((id) => !addedFactsheetIdSet.has(id))
    .map((id) => `fs-${id}`)), [hiddenFactsheetIds, addedFactsheetIdSet]);
  const visibleNodes = useMemo(() => hiddenNodeIds.size === 0 ? nodes
    : nodes.filter((node) => !hiddenNodeIds.has(node.id)), [nodes, hiddenNodeIds]);
  const visibleEdges = useMemo(() => {
    if (hiddenDependencyIds.length === 0 && hiddenNodeIds.size === 0) return edges;
    const hidden = new Set(hiddenDependencyIds.map((id) => `e-${id}`));
    return edges.filter((edge) => !hidden.has(edge.id) && !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target));
  }, [edges, hiddenDependencyIds, hiddenNodeIds]);
  const previousLayoutKeyRef = useRef(layoutKey);
  useEffect(() => {
    if (previousLayoutKeyRef.current === layoutKey) return;
    previousLayoutKeyRef.current = layoutKey;
    const hidden = new Set(hiddenDependencyIds.map((id) => `e-${id}`));
    const layout = getLayoutedElements(
      computedNodes.filter((node) => !hiddenNodeIds.has(node.id)),
      computedEdges.filter((edge) => !hidden.has(edge.id) && !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target)),
    );
    const positionedNodes = new Map(layout.nodes.map((node) => [node.id, node]));
    setNodes(computedNodes.map((node) => positionedNodes.get(node.id) ?? node));
    setEdges(computedEdges);
    const frame = window.requestAnimationFrame(() => {
      void reactFlowInstanceRef.current?.fitView({ padding: 0.25, minZoom: 0.02 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layoutKey, computedNodes, computedEdges, hiddenDependencyIds, hiddenNodeIds, setNodes, setEdges]);
  const nodesRef = useRef<Node[]>(visibleNodes);
  const edgesRef = useRef<Edge[]>(visibleEdges);

  useEffect(() => {
    nodesRef.current = visibleNodes;
  }, [visibleNodes]);

  useEffect(() => {
    edgesRef.current = visibleEdges;
  }, [visibleEdges]);

  // Track previous state to detect meaningful changes
  const prevNodeStateRef = useRef<string>("");
  const prevEdgeStateRef = useRef<string>("");
  const initialPositionsAppliedRef = useRef(false);

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
      setNodes(!initialPositionsAppliedRef.current && initialView
        ? computedNodes.map((node) => ({
          ...node,
          position: initialView.positions[node.id] ?? node.position,
        }))
        : computedNodes);
    }
    // Update if edge state changed (IDs, dimmed status, or labels)
    if (prevEdgeStateRef.current !== edgeState) {
      prevEdgeStateRef.current = edgeState;
      setEdges(computedEdges);
    }
    if (!settingsLoading) initialPositionsAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedNodes, computedEdges, settingsLoading]);

  useEffect(() => {
    onViewStateHandlerChange?.(() => ({
      positions: Object.fromEntries(nodes.map((node) => [node.id, { ...node.position }])),
      viewport: reactFlowInstanceRef.current?.getViewport() ?? null,
      relationMode,
      hiddenDependencyIds: [...hiddenDependencyIds],
      hiddenFactsheetIds: [...hiddenFactsheetIds],
      addedFactsheetIds: [...addedFactsheetIds],
    }));
    return () => onViewStateHandlerChange?.(null);
  }, [nodes, relationMode, hiddenDependencyIds, hiddenFactsheetIds, addedFactsheetIds, onViewStateHandlerChange]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      closeContextMenu();
      if (node.type === "factsheet" && onNodeClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeClick(factsheetId);
      }
    },
    [onNodeClick, closeContextMenu],
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
      closeContextMenu();
      onEdgeClick?.(edge.id.replace("e-", ""));
    },
    [onEdgeClick, closeContextMenu],
  );

  const openContextMenu = useCallback((event: React.MouseEvent, kind: "edge" | "node", id: string): void => {
    if (!enableViewControls) return;
    event.preventDefault();
    const bounds = graphWrapperRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setContextMenu({
      kind,
      id,
      x: Math.max(4, Math.min(event.clientX - bounds.left, bounds.width - 216)),
      y: Math.max(4, Math.min(event.clientY - bounds.top, bounds.height - 176)),
    });
  }, [enableViewControls]);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge): void => {
    openContextMenu(event, "edge", edge.id.replace("e-", ""));
  }, [openContextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const handlePointerDown = (event: PointerEvent): void => {
      if (!contextMenuRef.current?.contains(event.target as HTMLElement)) closeContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeContextMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, closeContextMenu]);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (enableViewControls && node.type === "factsheet") {
        openContextMenu(event, "node", (node.data as { factsheetId: string }).factsheetId);
        return;
      }
      event.preventDefault();
      setSelectedFactsheetId(null);
      if (node.type === "factsheet" && onNodeRightClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeRightClick(factsheetId);
      } else if (enableViewControls && node.type === "factsheet") {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        setSelectedFactsheetId(activeFactsheetId === factsheetId ? "" : factsheetId);
      }
    },
    [onNodeRightClick, enableViewControls, activeFactsheetId, openContextMenu],
  );

  const focusFactsheet = (factsheetId: string, mode: DependencyRelationMode): void => {
    setRelationMode(mode);
    if (onFocusedFactsheetChange) {
      onFocusedFactsheetChange(factsheetId);
    } else {
      setSelectedFactsheetId(factsheetId);
    }
    closeContextMenu();
  };

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
      aria-busy={settingsLoading}
      className="relative flex flex-col w-full h-full min-h-[200px] bg-gray-50"
    >
      {enableViewControls && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white p-2 pt-12 sm:pt-2 sm:pr-36 text-sm">
          <select
            aria-label="Graph factsheet"
            className="min-w-0 max-w-full rounded border border-gray-300 p-1"
            value={activeFactsheetId ?? ""}
            onChange={(event) => {
              if (onFocusedFactsheetChange) {
                onFocusedFactsheetChange(event.target.value || null);
              } else {
                setSelectedFactsheetId(event.target.value);
              }
            }}
          >
            <option value="">All factsheets</option>
            {factsheets.map((factsheet) => (
              <option key={factsheet.id} value={factsheet.id}>{factsheet.name}</option>
            ))}
          </select>
          <select
            aria-label="Graph relations"
            className="min-w-0 max-w-full rounded border border-gray-300 p-1"
            value={relationMode}
            onChange={(event) => setRelationMode(event.target.value as DependencyRelationMode)}
          >
            <option value="chain">Focus: upstream and downstream</option>
            <option value="connected">Connected component</option>
            <option value="upstream">Upstream only</option>
            <option value="downstream">Downstream only</option>
            <option value="direct">Direct connections</option>
          </select>
          {(hiddenDependencyIds.length > 0 || hiddenFactsheetIds.length > 0) && (
            <button type="button" title={hiddenFactsheetIds.length > 0 ? "Restore all hidden items" : "Restore all hidden dependencies"} aria-label={hiddenFactsheetIds.length > 0 ? "Restore all hidden items" : "Restore all hidden dependencies"} onClick={() => {
              setHiddenDependencyIds([]);
              setHiddenFactsheetIds([]);
            }} className="rounded border border-gray-300 p-1">
              <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{hiddenDependencyIds.length + hiddenFactsheetIds.length}</span>
            </button>
          )}
          {enableExportControls && (["png", "svg"] as const).map((format) => (
            <button key={format} type="button" disabled={exporting} title={`Export ${format.toUpperCase()}`} aria-label={`Export ${format.toUpperCase()}`} className="flex items-center gap-1 rounded border border-gray-300 p-1 disabled:opacity-50" onClick={async () => {
              setExporting(true);
              setExportError("");
              try {
                await (format === "png" ? exportToPng() : exportToSvg());
              } catch {
                setExportError("Graph export failed. Please try again.");
              } finally {
                setExporting(false);
              }
            }}><Download className="h-4 w-4" />{format.toUpperCase()}</button>
          ))}
          {exportError && <p role="alert" className="text-red-600">{exportError}</p>}
        </div>
      )}
      {enableViewControls && contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label={contextMenu.kind === "edge" ? "Dependency actions" : "Factsheet actions"}
          className="absolute z-30 w-52 max-w-full rounded border border-gray-200 bg-white p-1 text-sm shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(contextMenuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          {contextMenu.kind === "edge" && <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => {
            setHiddenDependencyIds((hidden) => [...new Set([...hidden, contextMenu.id])]);
            closeContextMenu();
          }}><EyeOff className="h-4 w-4" />Hide dependency</button>}
          {contextMenu.kind === "edge" && onEdgeClick && (
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => {
              onEdgeClick(contextMenu.id);
              closeContextMenu();
            }}><Pencil className="h-4 w-4" />Edit dependency</button>
          )}
          {contextMenu.kind === "node" && <>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => {
              setHiddenFactsheetIds((hidden) => [...new Set([...hidden, contextMenu.id])]);
              closeContextMenu();
            }}><EyeOff className="h-4 w-4" />Hide factsheet</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => {
              const connectedIds = getRelatedFactsheetIds(contextMenu.id, dependencies, "direct");
              setAddedFactsheetIds((added) => [...new Set([...added, ...connectedIds])]);
              setHiddenFactsheetIds((hidden) => hidden.filter((id) => !connectedIds.has(id)));
              closeContextMenu();
            }}><Network className="h-4 w-4" />Add connected factsheets</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => focusFactsheet(contextMenu.id, "chain")}><Focus className="h-4 w-4" />Focus factsheet</button>
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => focusFactsheet(contextMenu.id, "connected")}><Network className="h-4 w-4" />Connected factsheets</button>
          </>}
          {(hiddenDependencyIds.length > 0 || hiddenFactsheetIds.length > 0) && (
            <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100" onClick={() => {
              setHiddenDependencyIds([]);
              setHiddenFactsheetIds([]);
              closeContextMenu();
            }}><Eye className="h-4 w-4" />{hiddenFactsheetIds.length > 0 ? "Restore hidden items" : "Restore hidden dependencies"}</button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={closeContextMenu}
        onMoveStart={closeContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        deleteKeyCode={null}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        defaultViewport={initialView?.viewport ?? undefined}
        fitView={!initialView?.viewport}
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
    </div>
  );
}
