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
import type { UseCase, Dependency } from '../../types';

interface DependencyGraphProps {
  useCases: UseCase[];
  dependencies: Dependency[];
  onNodeClick?: (useCaseId: string) => void;
}

interface UseCaseNodeProps {
  data: {
    label: string;
    status: string;
    useCaseId: string;
  };
}

interface DependencyNodeProps {
  data: {
    label: string;
    type: string;
  };
}

// Custom node for use cases
function UseCaseNode({ data }: UseCaseNodeProps) {
  const statusColors: Record<string, string> = {
    active: 'border-green-500 bg-green-50',
    draft: 'border-gray-300 bg-gray-50',
    archived: 'border-amber-500 bg-amber-50',
  };

  return (
    <div
      className={`px-4 py-3 border-2 shadow-sm min-w-[180px] ${
        statusColors[data.status] || statusColors.draft
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-accent-500" />
      <div className="font-medium text-primary-900 text-sm">{data.label}</div>
      <div className="text-xs text-gray-500 mt-1 capitalize">{data.status}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent-500" />
    </div>
  );
}

// Custom node for dependencies
function DependencyNode({ data }: DependencyNodeProps) {
  const typeColors: Record<string, string> = {
    data: 'border-blue-500 bg-blue-50',
    knowledge: 'border-purple-500 bg-purple-50',
    system: 'border-orange-500 bg-orange-50',
  };

  return (
    <div
      className={`px-3 py-2 border shadow-sm min-w-[140px] ${
        typeColors[data.type] || typeColors.data
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="text-xs font-medium text-gray-700">{data.label}</div>
      <div className="text-xs text-gray-500 capitalize">{data.type}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

const nodeTypes = {
  useCase: UseCaseNode,
  dependency: DependencyNode,
};

export default function DependencyGraph({
  useCases,
  dependencies,
  onNodeClick,
}: DependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create use case nodes
    useCases.forEach((uc, index) => {
      nodes.push({
        id: `uc-${uc.id}`,
        type: 'useCase',
        position: { x: 250 * (index % 4), y: Math.floor(index / 4) * 200 },
        data: {
          label: uc.name,
          status: uc.status,
          useCaseId: uc.id,
        },
      });
    });

    // Create dependency nodes and edges
    dependencies.forEach((dep, index) => {
      const depNodeId = `dep-${dep.id}`;

      // Position dependencies below their parent use case
      const parentIndex = useCases.findIndex((uc) => uc.id === dep.use_case);
      nodes.push({
        id: depNodeId,
        type: 'dependency',
        position: {
          x: 250 * (parentIndex % 4) + 50,
          y: Math.floor(parentIndex / 4) * 200 + 120 + (index * 60),
        },
        data: {
          label: dep.name,
          type: dep.type,
        },
      });

      // Edge from use case to dependency
      edges.push({
        id: `e-${dep.use_case}-${dep.id}`,
        source: `uc-${dep.use_case}`,
        target: depNodeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#00aeef' },
      });

      // Edge to dependent use case if exists
      if (dep.depends_on) {
        edges.push({
          id: `e-${dep.id}-${dep.depends_on}`,
          source: depNodeId,
          target: `uc-${dep.depends_on}`,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#6366f1', strokeDasharray: '5,5' },
        });
      }
    });

    return { nodes, edges };
  }, [useCases, dependencies]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'useCase' && onNodeClick) {
        const useCaseId = (node.data as { useCaseId: string }).useCaseId;
        onNodeClick(useCaseId);
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
