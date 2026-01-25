import { useCallback, useMemo, useEffect, useRef } from 'react';
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
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import type { FactsheetExpanded, Dependency, PropertyDefinition } from '../../types';

export interface ConnectionRequest {
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
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
  unrelatedDisplayMode?: 'dim' | 'hide';
}

interface PropertyDisplay {
  name: string;
  value: string;
}

interface FactsheetNodeProps {
  data: {
    label: string;
    status: string;
    typeColor: string;
    typeName: string;
    factsheetId: string;
    properties?: PropertyDisplay[];
    dimmed?: boolean;
  };
}

const NODE_WIDTH = 200;
const NODE_BASE_HEIGHT = 80;
const PROPERTY_LINE_HEIGHT = 20;

// Calculate node height based on number of properties
function getNodeHeight(node: Node): number {
  const properties = (node.data as { properties?: PropertyDisplay[] }).properties;
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
    rankdir: 'TB', // Top to bottom
    nodesep: 80,   // Horizontal spacing
    ranksep: 100,  // Vertical spacing between ranks
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
  const statusColors: Record<string, string> = {
    active: 'border-green-500',
    draft: 'border-gray-300',
    archived: 'border-amber-500',
  };

  const hasProperties = data.properties && data.properties.length > 0;
  const isDimmed = data.dimmed === true;

  return (
    <div
      className={`px-4 py-3 border-2 shadow-sm min-w-[180px] transition-opacity ${
        isDimmed ? 'bg-gray-100 opacity-30' : 'bg-white'
      } ${statusColors[data.status] || statusColors.draft}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3"
          style={{ backgroundColor: isDimmed ? '#9ca3af' : data.typeColor }}
        />
        <span
          className="px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: isDimmed ? '#9ca3af' : data.typeColor }}
        >
          {data.typeName}
        </span>
      </div>
      <div className={`font-medium text-sm ${isDimmed ? 'text-gray-400' : 'text-primary-900'}`}>{data.label}</div>
      <div className="text-xs text-gray-500 mt-1 capitalize">{data.status}</div>
      {hasProperties && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {data.properties!.map((prop, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-gray-500">{prop.name}:</span>
              <span className={`font-medium ${isDimmed ? 'text-gray-400' : 'text-primary-900'}`}>{prop.value}</span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-accent-500 !w-3 !h-3" />
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
  unrelatedDisplayMode = 'dim',
}: DependencyGraphProps) {
  // Calculate related factsheet IDs when a factsheet is focused
  // Includes the full dependency chain (upstream and downstream)
  const relatedFactsheetIds = useMemo(() => {
    if (!focusedFactsheetId) return null;

    const related = new Set<string>();
    related.add(focusedFactsheetId);

    // Build adjacency lists for traversal
    const downstream = new Map<string, string[]>(); // factsheet -> what it depends on
    const upstream = new Map<string, string[]>();   // factsheet -> what depends on it

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
      if (relatedFactsheetIds && unrelatedDisplayMode === 'hide' && !relatedFactsheetIds.has(fs.id)) {
        return;
      }

      const typeColor = fs.expand?.type?.color || '#6b7280';
      const typeName = fs.expand?.type?.name || 'Unknown';

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
      const isDimmed = relatedFactsheetIds !== null && !relatedFactsheetIds.has(fs.id);

      nodes.push({
        id: `fs-${fs.id}`,
        type: 'factsheet',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: fs.name,
          status: fs.status,
          typeColor,
          typeName,
          factsheetId: fs.id,
          properties,
          dimmed: isDimmed,
        },
      });
    });

    // Create edges for dependencies
    dependencies.forEach((dep) => {
      // Only add edge if both nodes exist
      const sourceExists = nodes.some((n) => n.id === `fs-${dep.factsheet}`);
      const targetExists = nodes.some((n) => n.id === `fs-${dep.depends_on}`);

      if (sourceExists && targetExists) {
        // Check if this edge connects related nodes (both source and target must be related)
        const isRelatedEdge = relatedFactsheetIds === null ||
          (relatedFactsheetIds.has(dep.factsheet) && relatedFactsheetIds.has(dep.depends_on));
        const isDimmedEdge = !isRelatedEdge && unrelatedDisplayMode === 'dim';

        edges.push({
          id: `e-${dep.id}`,
          source: `fs-${dep.factsheet}`,
          target: `fs-${dep.depends_on}`,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isDimmedEdge ? '#d1d5db' : undefined,
          },
          style: {
            stroke: isDimmedEdge ? '#d1d5db' : '#00aeef',
            strokeWidth: 2,
            cursor: 'pointer',
            opacity: isDimmedEdge ? 0.3 : 1,
          },
          label: showComments ? (dep.description || '') : '',
          labelStyle: {
            fontSize: 10,
            fill: isDimmedEdge ? '#d1d5db' : '#6b7280',
            cursor: 'pointer',
            opacity: isDimmedEdge ? 0.3 : 1,
          },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8, cursor: 'pointer' },
          data: { dependencyId: dep.id, dimmed: isDimmedEdge },
        });
      }
    });

    // Apply dagre layout
    return getLayoutedElements(nodes, edges);
  }, [factsheets, dependencies, displayProperties, factsheetPropertyValues, propertyNameMap, showComments, relatedFactsheetIds, unrelatedDisplayMode]);

  // Use state hooks for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  // Track previous state to detect meaningful changes
  const prevNodeStateRef = useRef<string>('');
  const prevEdgeStateRef = useRef<string>('');

  // Sync state with computed values when props change
  useEffect(() => {
    // Create stable state string including dimmed status, properties, and labels for comparison
    const nodeState = computedNodes.map(n => {
      const data = n.data as { dimmed?: boolean; properties?: PropertyDisplay[] };
      const propsStr = data.properties?.map(p => `${p.name}:${p.value}`).join('|') || '';
      return `${n.id}:${data.dimmed}:${propsStr}`;
    }).sort().join(',');
    const edgeState = computedEdges.map(e => `${e.id}:${(e.data as { dimmed?: boolean })?.dimmed}:${e.label || ''}`).sort().join(',');

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
      if (node.type === 'factsheet' && onNodeClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeClick(factsheetId);
      }
    },
    [onNodeClick]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!onConnect || !connection.source || !connection.target) return;

      // Extract factsheet IDs from node IDs (remove 'fs-' prefix)
      const sourceId = connection.source.replace('fs-', '');
      const targetId = connection.target.replace('fs-', '');

      // Don't allow self-connections
      if (sourceId === targetId) return;

      // Check if dependency already exists
      const exists = dependencies.some(
        (dep) => dep.factsheet === sourceId && dep.depends_on === targetId
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
    [onConnect, dependencies, factsheets]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        // Extract dependency ID from edge id (remove 'e-' prefix)
        const dependencyId = edge.id.replace('e-', '');
        onEdgeClick(dependencyId);
      }
    },
    [onEdgeClick]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (node.type === 'factsheet' && onNodeRightClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeRightClick(factsheetId);
      }
    },
    [onNodeRightClick]
  );

  return (
    <div className="w-full h-full min-h-[200px] bg-gray-50">
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
        fitView
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: '#00aeef', strokeWidth: 2 }}
      >
        <Controls />
        <Background color="#e5e7eb" gap={20} />
      </ReactFlow>
    </div>
  );
}
