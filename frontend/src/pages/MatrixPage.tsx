import { useState } from 'react';
import { Card, CardTitle, Select } from '../components/ui';
import { PropertyMatrix } from '../components/visualizations';
import FactsheetDetailModal from '../components/FactsheetDetailModal';
import { useRealtime } from '../hooks/useRealtime';
import type { FactsheetExpanded, PropertyDefinition, FactsheetPropertyExpanded } from '../types';

export default function MatrixPage() {
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(null);

  const { records: factsheets, loading: loadingFactsheets } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    expand: 'type',
  });

  const { records: propertyDefinitions, loading: loadingDefs } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const { records: properties, loading: loadingProps } = useRealtime<FactsheetPropertyExpanded>({
    collection: 'factsheet_properties',
    expand: 'property,option',
  });

  const handleFactsheetClick = (factsheetId: string) => {
    setSelectedFactsheetId(factsheetId);
  };

  const loading = loadingFactsheets || loadingDefs || loadingProps;

  // All properties are now enum type
  const propertyOptions = propertyDefinitions.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Matrix View</h1>
        <p className="text-gray-500 mt-1">
          Plot factsheets on a matrix based on their properties
        </p>
      </div>

      {/* Axis selectors */}
      <Card padding="sm">
        <div className="flex gap-6 items-end">
          <div className="w-64">
            <Select
              label="X Axis (Horizontal)"
              options={propertyOptions}
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
              placeholder="Select property..."
            />
          </div>
          <div className="w-64">
            <Select
              label="Y Axis (Vertical)"
              options={propertyOptions}
              value={yAxis}
              onChange={(e) => setYAxis(e.target.value)}
              placeholder="Select property..."
            />
          </div>
          {xAxis && yAxis && (
            <div className="text-sm text-gray-500">
              Showing {factsheets.length} factsheets
            </div>
          )}
        </div>
      </Card>

      {/* Matrix */}
      {loading ? (
        <Card className="h-[500px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading matrix...</div>
        </Card>
      ) : propertyDefinitions.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>No properties configured</CardTitle>
          <p className="text-gray-500 mt-2">
            Configure property definitions in settings to use the matrix view
          </p>
        </Card>
      ) : !xAxis || !yAxis ? (
        <Card className="text-center py-16">
          <CardTitle>Select axes</CardTitle>
          <p className="text-gray-500 mt-2">
            Choose properties for the X and Y axes to view the matrix
          </p>
        </Card>
      ) : (
        <PropertyMatrix
          factsheets={factsheets}
          properties={properties}
          propertyDefinitions={propertyDefinitions}
          xAxisProperty={xAxis}
          yAxisProperty={yAxis}
          onFactsheetClick={handleFactsheetClick}
        />
      )}

      {/* Factsheet Detail Modal */}
      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
