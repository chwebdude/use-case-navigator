import { useMemo } from 'react';
import type { FactsheetExpanded, PropertyDefinition, FactsheetPropertyExpanded, PropertyOption } from '../../types';

interface PropertyMatrixProps {
  factsheets: FactsheetExpanded[];
  properties: FactsheetPropertyExpanded[];
  propertyDefinitions: PropertyDefinition[];
  propertyOptions: PropertyOption[];
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
  propertyOptions,
  xAxisProperty,
  yAxisProperty,
  onFactsheetClick,
  displayProperties = [],
  factsheetPropertyValues,
}: PropertyMatrixProps) {
  const yDef = propertyDefinitions.find((p) => p.id === yAxisProperty);

  // Get all options for each axis property (sorted by order)
  const xAxisOptions = useMemo(() => {
    return propertyOptions
      .filter((opt) => opt.property === xAxisProperty)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((opt) => opt.value);
  }, [propertyOptions, xAxisProperty]);

  const yAxisOptions = useMemo(() => {
    return propertyOptions
      .filter((opt) => opt.property === yAxisProperty)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((opt) => opt.value);
  }, [propertyOptions, yAxisProperty]);

  // Build matrix with all axis options
  const matrix = useMemo(() => {
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

    // Initialize all cells
    yAxisOptions.forEach((yVal) => {
      matrixData.set(yVal, new Map());
      xAxisOptions.forEach((xVal) => {
        matrixData.get(yVal)!.set(xVal, []);
      });
    });

    // Also add "Unknown" row/column for factsheets without values
    const hasUnknownX = factsheets.some((fs) => !propLookup.get(fs.id)?.get(xAxisProperty));
    const hasUnknownY = factsheets.some((fs) => !propLookup.get(fs.id)?.get(yAxisProperty));

    if (hasUnknownY) {
      matrixData.set('Unknown', new Map());
      xAxisOptions.forEach((xVal) => {
        matrixData.get('Unknown')!.set(xVal, []);
      });
      if (hasUnknownX) {
        matrixData.get('Unknown')!.set('Unknown', []);
      }
    }
    if (hasUnknownX) {
      yAxisOptions.forEach((yVal) => {
        matrixData.get(yVal)!.set('Unknown', []);
      });
    }

    // Place factsheets in matrix
    factsheets.forEach((fs) => {
      const fsProps = propLookup.get(fs.id);
      const xVal = fsProps?.get(xAxisProperty) || 'Unknown';
      const yVal = fsProps?.get(yAxisProperty) || 'Unknown';

      if (matrixData.has(yVal) && matrixData.get(yVal)!.has(xVal)) {
        matrixData.get(yVal)!.get(xVal)!.push(fs);
      }
    });

    return matrixData;
  }, [factsheets, properties, xAxisProperty, yAxisProperty, xAxisOptions, yAxisOptions]);

  // Get all X values (options + Unknown if needed)
  const xValues = useMemo(() => {
    const hasUnknown = factsheets.some((fs) => {
      const propLookup = new Map<string, string>();
      properties.forEach((prop) => {
        if (prop.factsheet === fs.id) {
          const optionValue = prop.expand?.option?.value || '';
          if (optionValue) propLookup.set(prop.property, optionValue);
        }
      });
      return !propLookup.get(xAxisProperty);
    });
    return hasUnknown ? [...xAxisOptions, 'Unknown'] : xAxisOptions;
  }, [xAxisOptions, factsheets, properties, xAxisProperty]);

  // Get all Y values (options + Unknown if needed)
  const yValues = useMemo(() => {
    const hasUnknown = factsheets.some((fs) => {
      const propLookup = new Map<string, string>();
      properties.forEach((prop) => {
        if (prop.factsheet === fs.id) {
          const optionValue = prop.expand?.option?.value || '';
          if (optionValue) propLookup.set(prop.property, optionValue);
        }
      });
      return !propLookup.get(yAxisProperty);
    });
    return hasUnknown ? [...yAxisOptions, 'Unknown'] : yAxisOptions;
  }, [yAxisOptions, factsheets, properties, yAxisProperty]);

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
      {/* X-Axis header row */}
      <div className="flex mb-3">
        {/* Y-Axis label in corner */}
        <div className="w-36 shrink-0 pr-3 h-12 flex items-center justify-end">
          <span className="text-sm font-semibold text-gray-600">
            {yDef?.name}
          </span>
        </div>

        {/* X-Axis column headers */}
        <div className="flex-1 flex gap-3 min-w-0">
          {xValues.map((xVal) => (
            <div
              key={xVal}
              className={`flex-1 min-w-[200px] h-12 px-4 rounded-lg border flex items-center justify-center ${
                xVal === 'Unknown'
                  ? 'bg-gray-100 text-gray-500 border-gray-200'
                  : 'bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              <span className="font-semibold text-sm">{xVal}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix rows */}
      <div className="flex flex-col gap-3">
        {yValues.map((yVal) => (
          <div key={yVal} className="flex gap-3">
            {/* Y-Axis row label */}
            <div
              className={`w-36 shrink-0 mr-0 min-h-[100px] px-3 py-3 rounded-lg border flex items-center justify-center ${
                yVal === 'Unknown'
                  ? 'bg-gray-100 text-gray-500 border-gray-200'
                  : 'bg-gray-200 text-gray-700 border-gray-300'
              }`}
            >
              <span className="font-semibold text-sm text-center">{yVal}</span>
            </div>

            {/* Row cells */}
            <div className="flex-1 flex gap-3 min-w-0">
              {xValues.map((xVal) => {
                const cellFactsheets = matrix.get(yVal)?.get(xVal) || [];

                return (
                  <div
                    key={`${yVal}-${xVal}`}
                    className="flex-1 min-w-[200px] min-h-[100px] bg-gray-50 rounded-lg p-2 border border-gray-200"
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
