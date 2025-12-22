import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Card, CardTitle, Select, Button, Modal } from '../components/ui';
import { Textarea } from '../components/ui/Input';
import { DependencyGraph, type ConnectionRequest } from '../components/visualizations';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { FactsheetExpanded, Dependency, FactsheetType, PropertyDefinition, FactsheetPropertyExpanded } from '../types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function DependenciesPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilters, setPropertyFilters] = useState<Record<string, string>>({});
  const [layoutKey, setLayoutKey] = useState(0);

  // Connection modal state
  const [connectionModal, setConnectionModal] = useState<ConnectionRequest | null>(null);
  const [connectionDescription, setConnectionDescription] = useState('');
  const [saving, setSaving] = useState(false);

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

  const { records: propertyDefinitions } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const { records: factsheetProperties } = useRealtime<FactsheetPropertyExpanded>({
    collection: 'factsheet_properties',
    expand: 'property',
  });

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...factsheetTypes.map((t) => ({ value: t.id, label: t.name })),
  ];

  // Build property lookup: factsheetId -> { propertyId -> value }
  const propertyLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, string>>();
    factsheetProperties.forEach((fp) => {
      if (!lookup.has(fp.factsheet)) {
        lookup.set(fp.factsheet, new Map());
      }
      lookup.get(fp.factsheet)!.set(fp.property, fp.value);
    });
    return lookup;
  }, [factsheetProperties]);

  // Filter factsheets
  const filteredFactsheets = useMemo(() => {
    return factsheets.filter((fs) => {
      const matchesType = typeFilter === '' || fs.type === typeFilter;
      const matchesStatus = statusFilter === '' || fs.status === statusFilter;

      // Check property filters
      const matchesProperties = Object.entries(propertyFilters).every(([propId, value]) => {
        if (value === '') return true;
        const fsProps = propertyLookup.get(fs.id);
        return fsProps?.get(propId) === value;
      });

      return matchesType && matchesStatus && matchesProperties;
    });
  }, [factsheets, typeFilter, statusFilter, propertyFilters, propertyLookup]);

  // Filter dependencies to only include those where both factsheets are visible
  const filteredDependencies = useMemo(() => {
    const visibleIds = new Set(filteredFactsheets.map((fs) => fs.id));
    return dependencies.filter(
      (dep) => visibleIds.has(dep.factsheet) && visibleIds.has(dep.depends_on)
    );
  }, [dependencies, filteredFactsheets]);

  const handleNodeClick = (factsheetId: string) => {
    navigate(`/factsheets/${factsheetId}`);
  };

  const handleConnect = (connection: ConnectionRequest) => {
    setConnectionModal(connection);
    setConnectionDescription('');
  };

  const handleCreateDependency = async () => {
    if (!connectionModal) return;

    setSaving(true);
    try {
      await pb.collection('dependencies').create({
        factsheet: connectionModal.sourceId,
        depends_on: connectionModal.targetId,
        description: connectionDescription.trim() || null,
      });
      setConnectionModal(null);
      setConnectionDescription('');
    } catch (err) {
      console.error('Failed to create dependency:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAlign = () => {
    setLayoutKey((k) => k + 1);
  };

  const clearAllFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setPropertyFilters({});
  };

  const loading = loadingFactsheets || loadingDeps;
  const hasFilters = typeFilter !== '' || statusFilter !== '' || Object.values(propertyFilters).some((v) => v !== '');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Dependencies</h1>
          <p className="text-gray-500 mt-1">
            Visualize the relationships between factsheets. Drag from one node to another to create a dependency.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <Select
              label="Type"
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          {propertyDefinitions.map((prop) => (
            <div key={prop.id} className="w-40">
              <Select
                label={prop.name}
                options={[
                  { value: '', label: `All ${prop.name}` },
                  ...prop.options.map((opt) => ({ value: opt, label: opt })),
                ]}
                value={propertyFilters[prop.id] || ''}
                onChange={(e) =>
                  setPropertyFilters((prev) => ({
                    ...prev,
                    [prop.id]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {filteredFactsheets.length} of {factsheets.length} factsheets
            </span>
            <Button
              variant="secondary"
              size="sm"
              icon={<LayoutGrid className="w-4 h-4" />}
              onClick={handleAutoAlign}
            >
              Auto Align
            </Button>
          </div>
        </div>
      </Card>

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
      ) : filteredFactsheets.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>
            {hasFilters ? 'No matching factsheets' : 'No factsheets yet'}
          </CardTitle>
          <p className="text-gray-500 mt-2">
            {hasFilters
              ? 'Try adjusting your filters to see more factsheets'
              : 'Create some factsheets to see the dependency graph'}
          </p>
          {hasFilters && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <DependencyGraph
          key={layoutKey}
          factsheets={filteredFactsheets}
          dependencies={filteredDependencies}
          onNodeClick={handleNodeClick}
          onConnect={handleConnect}
        />
      )}

      {/* Connection Modal */}
      <Modal
        isOpen={connectionModal !== null}
        onClose={() => setConnectionModal(null)}
        title="Create Dependency"
      >
        {connectionModal && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">Creating dependency:</p>
              <div className="bg-gray-50 p-3 space-y-2">
                <div>
                  <span className="font-medium text-primary-900">
                    {connectionModal.sourceName}
                  </span>
                </div>
                <div className="text-center text-gray-400">depends on</div>
                <div>
                  <span className="font-medium text-primary-900">
                    {connectionModal.targetName}
                  </span>
                </div>
              </div>
            </div>

            <Textarea
              label="Description (optional)"
              value={connectionDescription}
              onChange={(e) => setConnectionDescription(e.target.value)}
              placeholder="Describe the dependency relationship..."
              rows={3}
            />

            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreateDependency} disabled={saving}>
                {saving ? 'Creating...' : 'Create Dependency'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConnectionModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
