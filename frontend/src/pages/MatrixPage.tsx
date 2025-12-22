import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle, Select } from '../components/ui';
import { PropertyMatrix } from '../components/visualizations';
import { useRealtime } from '../hooks/useRealtime';
import type { UseCase, PropertyDefinition, UseCasePropertyExpanded } from '../types';

export default function MatrixPage() {
  const navigate = useNavigate();
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');

  const { records: useCases, loading: loadingUseCases } = useRealtime<UseCase>({
    collection: 'use_cases',
  });

  const { records: propertyDefinitions, loading: loadingDefs } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const { records: properties, loading: loadingProps } = useRealtime<UseCasePropertyExpanded>({
    collection: 'use_case_properties',
    expand: 'property',
  });

  const handleUseCaseClick = (useCaseId: string) => {
    navigate(`/use-cases/${useCaseId}`);
  };

  const loading = loadingUseCases || loadingDefs || loadingProps;

  const propertyOptions = propertyDefinitions
    .filter((p) => p.type === 'enum')
    .map((p) => ({
      value: p.id,
      label: p.name,
    }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Matrix View</h1>
        <p className="text-gray-500 mt-1">
          Plot use cases on a matrix based on their properties
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
              Showing {useCases.length} use cases
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
          useCases={useCases}
          properties={properties}
          propertyDefinitions={propertyDefinitions}
          xAxisProperty={xAxis}
          yAxisProperty={yAxis}
          onUseCaseClick={handleUseCaseClick}
        />
      )}
    </div>
  );
}
