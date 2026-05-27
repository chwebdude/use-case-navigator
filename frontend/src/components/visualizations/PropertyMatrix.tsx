import { useMemo, useState } from "react";
import type {
  FactsheetExpanded,
  PropertyDefinition,
  FactsheetPropertyExpanded,
  PropertyOption,
} from "../../types";
import { useAppSettings } from "../../hooks/useAppSettings";
import { getStatusMeta, getStatusTextColor } from "../../lib/statusConfig";

export interface FactsheetMoveData {
  factsheet: FactsheetExpanded;
  fromX: string;
  fromY: string;
  toX: string;
  toY: string;
}

interface PropertyMatrixProps {
  factsheets: FactsheetExpanded[];
  properties: FactsheetPropertyExpanded[];
  propertyDefinitions: PropertyDefinition[];
  propertyOptions: PropertyOption[];
  xAxisProperty: string;
  yAxisProperty: string;
  onFactsheetClick?: (factsheetId: string) => void;
  onFactsheetMove?: (moveData: FactsheetMoveData) => void;
  displayProperties?: string[];
  factsheetPropertyValues?: Map<string, Map<string, string>>;
  printable?: boolean;
}

export default function PropertyMatrix({
  factsheets,
  properties,
  propertyDefinitions,
  propertyOptions,
  xAxisProperty,
  yAxisProperty,
  onFactsheetClick,
  onFactsheetMove,
  displayProperties = [],
  factsheetPropertyValues,
  printable = false,
}: PropertyMatrixProps) {
  const {
    settings: { statuses: globalStatuses },
  } = useAppSettings();

  const [draggedFactsheet, setDraggedFactsheet] = useState<{
    fs: FactsheetExpanded;
    fromX: string;
    fromY: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ x: string; y: string } | null>(
    null,
  );

  const yDef = propertyDefinitions.find((p) => p.id === yAxisProperty);
  const isInteractive = !printable && Boolean(onFactsheetMove);

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
      const optionValue = prop.expand?.option?.value || "";
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
    const hasUnknownX = factsheets.some(
      (fs) => !propLookup.get(fs.id)?.get(xAxisProperty),
    );
    const hasUnknownY = factsheets.some(
      (fs) => !propLookup.get(fs.id)?.get(yAxisProperty),
    );

    if (hasUnknownY) {
      matrixData.set("Unknown", new Map());
      xAxisOptions.forEach((xVal) => {
        matrixData.get("Unknown")!.set(xVal, []);
      });
      if (hasUnknownX) {
        matrixData.get("Unknown")!.set("Unknown", []);
      }
    }
    if (hasUnknownX) {
      yAxisOptions.forEach((yVal) => {
        matrixData.get(yVal)!.set("Unknown", []);
      });
    }

    // Place factsheets in matrix
    factsheets.forEach((fs) => {
      const fsProps = propLookup.get(fs.id);
      const xVal = fsProps?.get(xAxisProperty) || "Unknown";
      const yVal = fsProps?.get(yAxisProperty) || "Unknown";

      if (matrixData.has(yVal) && matrixData.get(yVal)!.has(xVal)) {
        matrixData.get(yVal)!.get(xVal)!.push(fs);
      }
    });

    return matrixData;
  }, [
    factsheets,
    properties,
    xAxisProperty,
    yAxisProperty,
    xAxisOptions,
    yAxisOptions,
  ]);

  // Get all X values (options + Unknown if needed)
  const xValues = useMemo(() => {
    const hasUnknown = factsheets.some((fs) => {
      const propLookup = new Map<string, string>();
      properties.forEach((prop) => {
        if (prop.factsheet === fs.id) {
          const optionValue = prop.expand?.option?.value || "";
          if (optionValue) propLookup.set(prop.property, optionValue);
        }
      });
      return !propLookup.get(xAxisProperty);
    });
    return hasUnknown ? [...xAxisOptions, "Unknown"] : xAxisOptions;
  }, [xAxisOptions, factsheets, properties, xAxisProperty]);

  // Get all Y values (options + Unknown if needed)
  const yValues = useMemo(() => {
    const hasUnknown = factsheets.some((fs) => {
      const propLookup = new Map<string, string>();
      properties.forEach((prop) => {
        if (prop.factsheet === fs.id) {
          const optionValue = prop.expand?.option?.value || "";
          if (optionValue) propLookup.set(prop.property, optionValue);
        }
      });
      return !propLookup.get(yAxisProperty);
    });
    return hasUnknown ? [...yAxisOptions, "Unknown"] : yAxisOptions;
  }, [yAxisOptions, factsheets, properties, yAxisProperty]);

  const labelColumnWidth = printable ? "6rem" : "9rem";
  const dataColumnMinWidth = printable ? "86px" : "200px";
  const matrixGridTemplateColumns = `${labelColumnWidth} repeat(${xValues.length}, minmax(${dataColumnMinWidth}, 1fr))`;

  // Get property name by id
  const getPropertyName = (propId: string) => {
    return propertyDefinitions.find((p) => p.id === propId)?.name || propId;
  };

  if (!xAxisProperty || !yAxisProperty) {
    return (
      <div className="w-full h-[400px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">
          Select both X and Y axis properties to view the matrix
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full ${printable ? "matrix-print-grid" : ""}`}>
      {/* X-Axis header row */}
      <div
        className={`grid ${printable ? "gap-1.5 mb-1.5" : "gap-3 mb-3"}`}
        style={{ gridTemplateColumns: matrixGridTemplateColumns }}
      >
        {/* Y-Axis label in corner */}
        <div
          className={`${printable ? "pr-1.5 h-8" : "pr-3 h-12"} flex items-center justify-end`}
        >
          <span
            className={`${printable ? "text-[10px] leading-tight" : "text-sm"} font-semibold text-gray-600`}
          >
            {yDef?.name}
          </span>
        </div>

        {/* X-Axis column headers */}
        {xValues.map((xVal) => (
          <div
            key={xVal}
            className={`${printable ? "h-8 px-1.5 rounded" : "h-12 px-4 rounded-lg"} border flex items-center justify-center ${
              xVal === "Unknown"
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : "bg-gray-200 text-gray-700 border-gray-300"
            }`}
          >
            <span
              className={`font-semibold ${printable ? "text-[9px] text-center leading-tight" : "text-sm"}`}
            >
              {xVal}
            </span>
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      <div className={`flex flex-col ${printable ? "gap-1.5" : "gap-3"}`}>
        {yValues.map((yVal) => (
          <div
            key={yVal}
            className={`grid ${printable ? "gap-1.5" : "gap-3"}`}
            style={{ gridTemplateColumns: matrixGridTemplateColumns }}
          >
            {/* Y-Axis row label */}
            <div
              className={`${printable ? "min-h-[56px] px-1.5 py-1.5 rounded" : "min-h-[100px] px-3 py-3 rounded-lg"} border flex items-center justify-center ${
                yVal === "Unknown"
                  ? "bg-gray-100 text-gray-500 border-gray-200"
                  : "bg-gray-200 text-gray-700 border-gray-300"
              }`}
            >
              <span
                className={`${printable ? "text-[9px] leading-tight" : "text-sm"} font-semibold text-center`}
              >
                {yVal}
              </span>
            </div>

            {/* Row cells */}
            {xValues.map((xVal) => {
              const cellFactsheets = matrix.get(yVal)?.get(xVal) || [];
              const isDropTarget =
                dropTarget?.x === xVal && dropTarget?.y === yVal;
              const isDifferentCell =
                draggedFactsheet &&
                (draggedFactsheet.fromX !== xVal ||
                  draggedFactsheet.fromY !== yVal);

              return (
                <div
                  key={`${yVal}-${xVal}`}
                  className={`${printable ? "min-h-[56px] rounded p-1" : "min-h-[100px] rounded-lg p-2"} border-2 transition-colors ${
                    isInteractive && isDropTarget && isDifferentCell
                      ? "bg-accent-50 border-accent-400"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  onDragOver={(e) => {
                    if (!isInteractive) return;
                    e.preventDefault();
                    if (
                      draggedFactsheet &&
                      (draggedFactsheet.fromX !== xVal ||
                        draggedFactsheet.fromY !== yVal)
                    ) {
                      setDropTarget({ x: xVal, y: yVal });
                    }
                  }}
                  onDragLeave={() => {
                    if (!isInteractive) return;
                    setDropTarget(null);
                  }}
                  onDrop={(e) => {
                    if (!isInteractive) return;
                    e.preventDefault();
                    setDropTarget(null);
                    if (
                      draggedFactsheet &&
                      onFactsheetMove &&
                      (draggedFactsheet.fromX !== xVal ||
                        draggedFactsheet.fromY !== yVal)
                    ) {
                      onFactsheetMove({
                        factsheet: draggedFactsheet.fs,
                        fromX: draggedFactsheet.fromX,
                        fromY: draggedFactsheet.fromY,
                        toX: xVal,
                        toY: yVal,
                      });
                    }
                    setDraggedFactsheet(null);
                  }}
                >
                  <div className={printable ? "space-y-1" : "space-y-2"}>
                    {cellFactsheets.map((fs) => {
                      const typeColor = fs.expand?.type?.color || "#6b7280";
                      const statusMeta = getStatusMeta(
                        fs.status_id || fs.status,
                        globalStatuses,
                        fs.expand?.type,
                      );
                      const fsPropertyValues = factsheetPropertyValues?.get(
                        fs.id,
                      );
                      const isDragging = draggedFactsheet?.fs.id === fs.id;

                      return (
                        <div
                          key={fs.id}
                          draggable={isInteractive}
                          onDragStart={() => {
                            if (!isInteractive) return;
                            setDraggedFactsheet({
                              fs,
                              fromX: xVal,
                              fromY: yVal,
                            });
                          }}
                          onDragEnd={() => {
                            if (!isInteractive) return;
                            setDraggedFactsheet(null);
                            setDropTarget(null);
                          }}
                          className={`bg-white overflow-hidden ${
                            printable
                              ? "rounded border border-gray-200"
                              : "rounded-lg shadow-sm hover:shadow-md transition-all"
                          } ${
                            isInteractive
                              ? "cursor-grab"
                              : onFactsheetClick
                                ? "cursor-pointer"
                                : "cursor-default"
                          } ${isDragging ? "opacity-50 scale-95" : ""}`}
                          onClick={() => onFactsheetClick?.(fs.id)}
                        >
                          {/* Color bar */}
                          <div
                            className={printable ? "h-1" : "h-1.5"}
                            style={{ backgroundColor: typeColor }}
                          />

                          {/* Card content */}
                          <div className={printable ? "p-1" : "p-3"}>
                            <div
                              className={`text-primary-900 leading-tight ${
                                printable
                                  ? "text-[9px] font-normal matrix-print-card-title"
                                  : "text-sm font-normal"
                              }`}
                            >
                              {fs.name}
                            </div>

                            {/* Status badge */}
                            <div
                              className={`${printable ? "mt-1" : "mt-2"} flex items-center gap-1`}
                            >
                              <span
                                className={`inline-flex rounded-full ${
                                  printable
                                    ? "px-1 py-0 text-[8px] leading-tight"
                                    : "px-2 py-0.5 text-xs"
                                }`}
                                style={{
                                  backgroundColor: statusMeta.color,
                                  color: getStatusTextColor(statusMeta.color),
                                }}
                              >
                                {statusMeta.label}
                              </span>
                            </div>

                            {/* Property values */}
                            {displayProperties.length > 0 &&
                              fsPropertyValues && (
                                <div
                                  className={`${printable ? "mt-1 pt-1" : "mt-2 pt-2"} border-t border-gray-100 space-y-0.5`}
                                >
                                  {displayProperties.map((propId) => {
                                    const value = fsPropertyValues.get(propId);
                                    if (!value) return null;
                                    return (
                                      <div
                                        key={propId}
                                        className={`flex justify-between gap-2 ${
                                          printable
                                            ? "text-[8px] leading-tight"
                                            : "text-xs"
                                        }`}
                                      >
                                        <span className="text-gray-500">
                                          {getPropertyName(propId)}
                                        </span>
                                        <span className="text-primary-900 font-medium">
                                          {value}
                                        </span>
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
        ))}
      </div>
    </div>
  );
}
