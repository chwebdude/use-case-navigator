import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { FactsheetExpanded, Dependency } from '../../types';

interface DependencyGraphProps {
  factsheets: FactsheetExpanded[];
  dependencies: Dependency[];
  onNodeClick?: (factsheetId: string) => void;
}

interface FactsheetNodeProps {
  data: {
    label: string;
    status: string;
    typeColor: string;
    typeName: string;
    factsheetId: string;
  };
}

// Custom node for factsheets
function FactsheetNode({ data }: FactsheetNodeProps) {
  const statusColors: Record<string, string> = {
    active: 'border-green-500',
    draft: 'border-gray-300',
    archived: 'border-amber-500',
  };

  return (
    <div
      className={`px-4 py-3 border-2 shadow-sm min-w-[180px] bg-white ${
        statusColors[data.status] || statusColors.draft
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-500" />
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
      <Handle type="source" position={Position.Bottom} className="!bg-accent-500" />
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
}: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create factsheet nodes
    factsheets.forEach((fs, index) => {
      const typeColor = fs.expand?.type?.color || '#6b7280';
      const typeName = fs.expand?.type?.name || 'Unknown';

      nodes.push({
        id: `fs-${fs.id}`,
        type: 'factsheet',
        position: { x: 250 * (index % 4), y: Math.floor(index / 4) * 180 },
        data: {
          label: fs.name,
          status: fs.status,
          typeColor,
          typeName,
          factsheetId: fs.id,
        },
      });
    });

    // Create edges for dependencies
    dependencies.forEach((dep) => {
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
    });

    return { nodes, edges };
  }, [factsheets, dependencies]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'factsheet' && onNodeClick) {
        const factsheetId = (node.data as { factsheetId: string }).factsheetId;
        onNodeClick(factsheetId);
      }
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-[600px] bg-gray-50 border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background color="#e5e7eb" gap={20} />
      </ReactFlow>
    </div>
  );
}
