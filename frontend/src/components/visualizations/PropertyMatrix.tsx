import { useMemo } from 'react';
import type { FactsheetExpanded, PropertyDefinition, FactsheetPropertyExpanded } from '../../types';

interface PropertyMatrixProps {
  factsheets: FactsheetExpanded[];
  properties: FactsheetPropertyExpanded[];
  propertyDefinitions: PropertyDefinition[];
  xAxisProperty: string;
  yAxisProperty: string;
  onFactsheetClick?: (factsheetId: string) => void;
  displayProperties?: string[];
  factsheetPropertyValues?: Map<string, Map<string, string>>;
}

export default function PropertyMatrix({
  factsheets,
  properties,
  propertyDefinitions,
  xAxisProperty,
  yAxisProperty,
  onFactsheetClick,
  displayProperties = [],
  factsheetPropertyValues,
}: PropertyMatrixProps) {
  const yDef = propertyDefinitions.find((p) => p.id === yAxisProperty);

  // Get unique values for each axis and build matrix
  const { xValues, yValues, matrix } = useMemo(() => {
    const xVals = new Set<string>();
    const yVals = new Set<string>();
    const matrixData: Map<string, Map<string, FactsheetExpanded[]>> = new Map();

    // Build property lookup from properties prop
    const propLookup = new Map<string, Map<string, string>>();
    properties.forEach((prop) => {
      if (!propLookup.has(prop.factsheet)) {
        propLookup.set(prop.factsheet, new Map());
      }
      const optionValue = prop.expand?.option?.value || '';
      if (optionValue) {
        propLookup.get(prop.factsheet)!.set(prop.property, optionValue);
      }
    });

    // Build matrix
    factsheets.forEach((fs) => {
      const fsProps = propLookup.get(fs.id);
      const xVal = fsProps?.get(xAxisProperty) || 'Unknown';
      const yVal = fsProps?.get(yAxisProperty) || 'Unknown';

      xVals.add(xVal);
      yVals.add(yVal);

      if (!matrixData.has(yVal)) {
        matrixData.set(yVal, new Map());
      }
      if (!matrixData.get(yVal)!.has(xVal)) {
        matrixData.get(yVal)!.set(xVal, []);
      }
      matrixData.get(yVal)!.get(xVal)!.push(fs);
    });

    return {
      xValues: Array.from(xVals).sort(),
      yValues: Array.from(yVals).sort(),
      matrix: matrixData,
    };
  }, [factsheets, properties, xAxisProperty, yAxisProperty]);

  // Get property name by id
  const getPropertyName = (propId: string) => {
    return propertyDefinitions.find((p) => p.id === propId)?.name || propId;
  };

  if (!xAxisProperty || !yAxisProperty) {
    return (
      <div className="w-full h-[400px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">Select both X and Y axis properties to view the matrix</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* X-Axis Header */}
      <div className="flex">
        {/* Y-Axis label spacer */}
        <div className="w-36 shrink-0 flex items-center justify-end pr-4">
          <span className="text-sm font-semibold text-gray-600">
            {yDef?.name}
          </span>
        </div>

        {/* X-Axis column headers */}
        <div className="flex-1 flex gap-3">
          {xValues.map((xVal) => (
            <div
              key={xVal}
              className="flex-1 min-w-[220px]"
            >
              <div className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-center border border-gray-300">
                <span className="font-semibold text-sm">{xVal}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix rows */}
      <div className="space-y-3 mt-3">
        {yValues.map((yVal) => (
          <div key={yVal} className="flex">
            {/* Y-Axis row label */}
            <div className="w-36 shrink-0 flex items-start pr-4">
              <div className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-center border border-gray-300 w-full">
                <span className="font-semibold text-sm">{yVal}</span>
              </div>
            </div>

            {/* Row cells */}
            <div className="flex-1 flex gap-3">
              {xValues.map((xVal) => {
                const cellFactsheets = matrix.get(yVal)?.get(xVal) || [];

                return (
                  <div
                    key={`${yVal}-${xVal}`}
                    className="flex-1 min-w-[220px] min-h-[80px] bg-gray-50 rounded-lg p-2 border border-gray-200"
                  >
                    <div className="space-y-2">
                      {cellFactsheets.map((fs) => {
                        const typeColor = fs.expand?.type?.color || '#6b7280';
                        const fsPropertyValues = factsheetPropertyValues?.get(fs.id);

                        return (
                          <div
                            key={fs.id}
                            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                            onClick={() => onFactsheetClick?.(fs.id)}
                          >
                            {/* Color bar */}
                            <div
                              className="h-1.5"
                              style={{ backgroundColor: typeColor }}
                            />

                            {/* Card content */}
                            <div className="p-3">
                              <div className="font-medium text-primary-900 text-sm leading-tight">
                                {fs.name}
                              </div>

                              {/* Status badge */}
                              <div className="mt-2 flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                  fs.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : fs.status === 'archived'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {fs.status}
                                </span>
                              </div>

                              {/* Property values */}
                              {displayProperties.length > 0 && fsPropertyValues && (
                                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                  {displayProperties.map((propId) => {
                                    const value = fsPropertyValues.get(propId);
                                    if (!value) return null;
                                    return (
                                      <div key={propId} className="flex justify-between gap-2 text-xs">
                                        <span className="text-gray-500">{getPropertyName(propId)}</span>
                                        <span className="text-primary-900 font-medium">{value}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
