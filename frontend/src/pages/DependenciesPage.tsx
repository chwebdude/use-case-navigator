import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui';
import { DependencyGraph } from '../components/visualizations';
import { useRealtime } from '../hooks/useRealtime';
import type { UseCase, Dependency } from '../types';

export default function DependenciesPage() {
  const navigate = useNavigate();

  const { records: useCases, loading: loadingUseCases } = useRealtime<UseCase>({
    collection: 'use_cases',
  });

  const { records: dependencies, loading: loadingDeps } = useRealtime<Dependency>({
    collection: 'dependencies',
  });

  const handleNodeClick = (useCaseId: string) => {
    navigate(`/use-cases/${useCaseId}`);
  };

  const loading = loadingUseCases || loadingDeps;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Dependencies</h1>
        <p className="text-gray-500 mt-1">
          Visualize the relationships between use cases and their dependencies
        </p>
      </div>

      {/* Legend */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-500 bg-green-50"></div>
            <span>Active Use Case</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 bg-gray-50"></div>
            <span>Draft Use Case</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-blue-500 bg-blue-50"></div>
            <span>Data Dependency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-purple-500 bg-purple-50"></div>
            <span>Knowledge Dependency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-orange-500 bg-orange-50"></div>
            <span>System Dependency</span>
          </div>
        </div>
      </Card>

      {/* Graph */}
      {loading ? (
        <Card className="h-[600px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading graph...</div>
        </Card>
      ) : useCases.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>No use cases yet</CardTitle>
          <p className="text-gray-500 mt-2">
            Create some use cases to see the dependency graph
          </p>
        </Card>
      ) : (
        <DependencyGraph
          useCases={useCases}
          dependencies={dependencies}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
