import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui';
import { DependencyGraph } from '../components/visualizations';
import { useRealtime } from '../hooks/useRealtime';
import type { FactsheetExpanded, Dependency, FactsheetType } from '../types';

export default function DependenciesPage() {
  const navigate = useNavigate();

  const { records: factsheets, loading: loadingFactsheets } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    expand: 'type',
  });

  const { records: dependencies, loading: loadingDeps } = useRealtime<Dependency>({
    collection: 'dependencies',
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const handleNodeClick = (factsheetId: string) => {
    navigate(`/factsheets/${factsheetId}`);
  };

  const loading = loadingFactsheets || loadingDeps;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Dependencies</h1>
        <p className="text-gray-500 mt-1">
          Visualize the relationships between factsheets
        </p>
      </div>

      {/* Legend */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2 mr-4">
            <span className="font-medium text-primary-900">Status:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-green-500 bg-white"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-gray-300 bg-white"></div>
            <span>Draft</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-500 bg-white"></div>
            <span>Archived</span>
          </div>
          {factsheetTypes.length > 0 && (
            <>
              <div className="border-l border-gray-300 pl-4 ml-2 flex items-center gap-2">
                <span className="font-medium text-primary-900">Types:</span>
              </div>
              {factsheetTypes.map((type) => (
                <div key={type.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4"
                    style={{ backgroundColor: type.color }}
                  />
                  <span>{type.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* Graph */}
      {loading ? (
        <Card className="h-[600px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading graph...</div>
        </Card>
      ) : factsheets.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>No factsheets yet</CardTitle>
          <p className="text-gray-500 mt-2">
            Create some factsheets to see the dependency graph
          </p>
        </Card>
      ) : (
        <DependencyGraph
          factsheets={factsheets}
          dependencies={dependencies}
          onNodeClick={handleNodeClick}
        />
      )}
    </div>
  );
}
