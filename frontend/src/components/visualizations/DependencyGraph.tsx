import { useCallback, useMemo, useEffect } from 'react';
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
  onConnect?: (connection: ConnectionRequest) => void;
  displayProperties?: string[];
  propertyDefinitions?: PropertyDefinition[];
  factsheetPropertyValues?: Map<string, Map<string, string>>;
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

  return (
    <div
      className={`px-4 py-3 border-2 shadow-sm min-w-[180px] bg-white ${
        statusColors[data.status] || statusColors.draft
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3"
          style={{ backgroundColor: data.typeColor }}
        />
        <span
          className="px-1.5 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: data.typeColor }}
        >
          {data.typeName}
        </span>
      </div>
      <div className="font-medium text-primary-900 text-sm">{data.label}</div>
      <div className="text-xs text-gray-500 mt-1 capitalize">{data.status}</div>
      {hasProperties && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          {data.properties!.map((prop, idx) => (
            <div key={idx} className="flex justify-between text-xs">
              <span className="text-gray-500">{prop.name}:</span>
              <span className="font-medium text-primary-900">{prop.value}</span>
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
  onConnect,
  displayProperties = [],
  propertyDefinitions = [],
  factsheetPropertyValues,
}: DependencyGraphProps) {
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
        },
      });
    });

    // Create edges for dependencies
    dependencies.forEach((dep) => {
      // Only add edge if both nodes exist
      const sourceExists = nodes.some((n) => n.id === `fs-${dep.factsheet}`);
      const targetExists = nodes.some((n) => n.id === `fs-${dep.depends_on}`);

      if (sourceExists && targetExists) {
        edges.push({
          id: `e-${dep.id}`,
          source: `fs-${dep.factsheet}`,
          target: `fs-${dep.depends_on}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#00aeef', strokeWidth: 2 },
          label: dep.description || '',
          labelStyle: { fontSize: 10, fill: '#6b7280' },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
      }
    });

    // Apply dagre layout
    return getLayoutedElements(nodes, edges);
  }, [factsheets, dependencies, displayProperties, factsheetPropertyValues, propertyNameMap]);

  // Use state hooks for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  // Sync state with computed values when props change
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

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

  return (
    <div className="w-full h-[600px] bg-gray-50 border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
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
