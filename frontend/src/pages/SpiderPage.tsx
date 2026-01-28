import { useState, useMemo, useEffect, useRef } from "react";
import { Radar } from "lucide-react";
import { Card, CardTitle, Button, Badge } from "../components/ui";
import { FilterBar } from "../components/FilterBar";
import { SpiderDiagram } from "../components/visualizations";
import type { SpiderDataPoint } from "../components/visualizations/SpiderDiagram";
import { useRealtime } from "../hooks/useRealtime";
import { useQueryStates } from "../hooks/useQueryState";
import type {
  FactsheetExpanded,
  FactsheetType,
  MetricExpanded,
  FactsheetPropertyExpanded,
  PropertyDefinition,
  PropertyOption,
} from "../types";

// Color palette for factsheets
const colorPalette = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // purple
];

type AxisMode = "properties" | "metrics";

export default function SpiderPage() {
  const [state, setState] = useQueryStates({
    search: "",
    statusFilter: "",
    typeFilter: "",
    propertyFilters: {} as Record<string, string>,
    selectedMetrics: "", // Start empty to detect URL presence
    axisMode: "metrics" as AxisMode,
  });

  const {
    search,
    statusFilter,
    typeFilter,
    propertyFilters,
    selectedMetrics: selectedMetricsStr,
    axisMode,
  } = state;
  const setSearch = (v: string) => setState("search", v);
  const setStatusFilter = (v: string) => setState("statusFilter", v);
  const setTypeFilter = (v: string) => setState("typeFilter", v);
  const setPropertyFilters = (v: Record<string, string>) =>
    setState("propertyFilters", v);
  const setAxisMode = (v: AxisMode) => setState("axisMode", v);

  // Parse selectedMetrics from string OR array (useQueryStates might auto-parse JSON)
  const selectedMetrics = useMemo(() => {
    try {
      // Handle if already parsed to array by useQueryStates
      if (Array.isArray(selectedMetricsStr)) {
        return new Set<string>(selectedMetricsStr);
      }
      // Handle string (JSON or empty)
      const parsed =
        selectedMetricsStr && selectedMetricsStr.length > 0
          ? JSON.parse(selectedMetricsStr)
          : [];
      return new Set<string>(parsed);
    } catch {
      return new Set<string>();
    }
  }, [selectedMetricsStr]);

  const setSelectedMetrics = (v: Set<string>) => {
    setState("selectedMetrics", JSON.stringify(Array.from(v)));
  };

  const [highlightedFactsheet, setHighlightedFactsheet] = useState<
    string | null
  >(null);
  const [selectedFactsheet, setSelectedFactsheet] =
    useState<FactsheetExpanded | null>(null);
  const prevAxisModeRef = useRef<AxisMode | null>(null); // Start as null to detect initial load
  const hasInitializedRef = useRef(false);
  // Track whether the URL originally had a selectedMetrics parameter (even if empty)
  const urlHadParamRef = useRef(
    typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("selectedMetrics"),
  );

  const { records: factsheets, loading } = useRealtime<FactsheetExpanded>({
    collection: "factsheets",
    sort: "-created",
    expand: "type",
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: "factsheet_types",
    sort: "order",
  });

  const { records: metrics } = useRealtime<MetricExpanded>({
    collection: "metrics",
    sort: "order",
    expand: "properties",
  });

  const { records: factsheetProps } = useRealtime<FactsheetPropertyExpanded>({
    collection: "factsheet_properties",
    expand: "option",
  });

  const { records: propertyDefinitions } = useRealtime<PropertyDefinition>({
    collection: "property_definitions",
    sort: "order",
  });

  const { records: propertyOptions } = useRealtime<PropertyOption>({
    collection: "property_options",
    sort: "order",
  });

  // Clear selected dimensions when user actively changes mode (not on initial URL load)
  useEffect(() => {
    // Only clear selections if this is an actual mode change (not initial mount/URL restoration)
    if (
      prevAxisModeRef.current !== null &&
      prevAxisModeRef.current !== axisMode
    ) {
      setSelectedMetrics(new Set());
      hasInitializedRef.current = false; // Reset initialization flag on mode change
    }
    prevAxisModeRef.current = axisMode;
  }, [axisMode, setSelectedMetrics]);

  // Build property lookup: factsheetId -> { propertyId -> optionValue }
  const propertyLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, string>>();
    factsheetProps.forEach((fp) => {
      if (!lookup.has(fp.factsheet)) {
        lookup.set(fp.factsheet, new Map());
      }
      const optionValue = fp.expand?.option?.value || "";
      if (optionValue) {
        lookup.get(fp.factsheet)!.set(fp.property, optionValue);
      }
    });
    return lookup;
  }, [factsheetProps]);

  // Build factsheet property lookup for metric computation
  const factsheetPropertyLookup = useMemo(() => {
    const map = new Map<string, Map<string, FactsheetPropertyExpanded>>();
    factsheetProps.forEach((fp) => {
      if (!map.has(fp.factsheet)) {
        map.set(fp.factsheet, new Map());
      }
      map.get(fp.factsheet)!.set(fp.property, fp);
    });
    return map;
  }, [factsheetProps]);

  const computeMetricScore = (
    factsheetId: string,
    metric: MetricExpanded,
  ): number | null => {
    const properties = metric.properties?.length
      ? metric.properties
      : (metric.expand?.properties?.map((p) => p.id) ?? []);
    if (properties.length === 0) return null;
    const fsProps = factsheetPropertyLookup.get(factsheetId);
    if (!fsProps) return null;

    let sum = 0;
    let count = 0;
    properties.forEach((propId) => {
      const fp = fsProps.get(propId);
      if (!fp) return;
      const weight =
        typeof fp.expand?.option?.weight === "number"
          ? fp.expand.option.weight
          : 0;
      sum += weight;
      count += 1;
    });

    if (count === 0) return null;
    return sum / count;
  };

  const filteredFactsheets = useMemo(() => {
    return factsheets.filter((fs) => {
      const matchesSearch =
        search === "" ||
        fs.name.toLowerCase().includes(search.toLowerCase()) ||
        fs.description?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "" || fs.status === statusFilter;
      const matchesType = typeFilter === "" || fs.type === typeFilter;

      const matchesProperties = Object.entries(propertyFilters).every(
        ([propId, value]) => {
          if (value === "") return true;
          const fsProps = propertyLookup.get(fs.id);
          return fsProps?.get(propId) === value;
        },
      );

      return matchesSearch && matchesStatus && matchesType && matchesProperties;
    });
  }, [
    factsheets,
    search,
    statusFilter,
    typeFilter,
    propertyFilters,
    propertyLookup,
  ]);

  // Convert factsheets to spider diagram data
  const spiderData: SpiderDataPoint[] = useMemo(() => {
    if (axisMode === "metrics") {
      return filteredFactsheets.map((fs, index) => {
        const typeColor =
          fs.expand?.type?.color || colorPalette[index % colorPalette.length];

        const values = metrics.map((metric) => {
          const score = computeMetricScore(fs.id, metric);
          return {
            metric: metric.name,
            value: score ?? 0,
          };
        });

        return {
          id: fs.id,
          name: fs.name,
          color: typeColor,
          values,
        };
      });
    } else {
      // Properties mode
      return filteredFactsheets.map((fs, index) => {
        const typeColor =
          fs.expand?.type?.color || colorPalette[index % colorPalette.length];

        const values = propertyDefinitions.map((prop) => {
          const fsProps = factsheetPropertyLookup.get(fs.id);
          const fp = fsProps?.get(prop.id);
          const weight =
            typeof fp?.expand?.option?.weight === "number"
              ? fp.expand.option.weight
              : 0;
          return {
            metric: prop.name,
            value: weight,
          };
        });

        return {
          id: fs.id,
          name: fs.name,
          color: typeColor,
          values,
        };
      });
    }
  }, [
    filteredFactsheets,
    metrics,
    propertyDefinitions,
    factsheetPropertyLookup,
    axisMode,
  ]);

  // Initialize selected dimensions only if URL didn't have the parameter
  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) return;

    // If URL had a selectedMetrics parameter, never auto-initialize
    // (even if it was empty - respect the user's/URL's intent)
    if (urlHadParamRef.current) {
      hasInitializedRef.current = true;
      return;
    }

    // Auto-select all if data is available and URL didn't have the param
    if (axisMode === "metrics" && metrics.length > 0) {
      setSelectedMetrics(new Set(metrics.map((m) => m.id)));
      hasInitializedRef.current = true;
    } else if (axisMode === "properties" && propertyDefinitions.length > 0) {
      setSelectedMetrics(new Set(propertyDefinitions.map((p) => p.id)));
      hasInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axisMode, metrics.length, propertyDefinitions.length]);

  // Filter metrics/properties based on selection and axis mode
  const filteredDimensions = useMemo(() => {
    if (axisMode === "metrics") {
      if (selectedMetrics.size === 0) return metrics;
      return metrics.filter((m) => selectedMetrics.has(m.id));
    } else {
      // Properties mode - use selectedMetrics to track selected properties too
      if (selectedMetrics.size === 0) return propertyDefinitions;
      return propertyDefinitions.filter((p) => selectedMetrics.has(p.id));
    }
  }, [metrics, propertyDefinitions, selectedMetrics, axisMode]);

  const dimensionNames = useMemo(
    () => filteredDimensions.map((d) => d.name),
    [filteredDimensions],
  );

  // Filter spider data to only include selected dimensions
  const filteredSpiderData: SpiderDataPoint[] = useMemo(() => {
    return spiderData.map((point) => ({
      ...point,
      values: point.values.filter((v) =>
        filteredDimensions.some((d) => d.name === v.metric),
      ),
    }));
  }, [spiderData, filteredDimensions]);

  const toggleDimension = (id: string) => {
    const next = new Set(selectedMetrics);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMetrics(next);
  };

  const selectAllDimensions = () => {
    if (axisMode === "metrics") {
      setSelectedMetrics(new Set(metrics.map((m) => m.id)));
    } else {
      setSelectedMetrics(new Set(propertyDefinitions.map((p) => p.id)));
    }
  };

  const clearDimensionSelection = () => {
    setSelectedMetrics(new Set());
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("");
    setStatusFilter("");
    setPropertyFilters({});
  };

  const hasFilters =
    search !== "" ||
    typeFilter !== "" ||
    statusFilter !== "" ||
    Object.values(propertyFilters).some((v) => v !== "");

  const handlePointClick = (point: SpiderDataPoint) => {
    const fs = filteredFactsheets.find((f) => f.id === point.id);
    if (fs) {
      setSelectedFactsheet(fs);
      setHighlightedFactsheet(point.id);
    }
  };

  const handlePointHover = (point: SpiderDataPoint | null) => {
    if (point) {
      setHighlightedFactsheet(point.id);
    } else if (!selectedFactsheet) {
      setHighlightedFactsheet(null);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "default";
      case "archived":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radar className="w-8 h-8 text-accent-500" />
          <div>
            <h1 className="text-2xl font-bold text-primary-900">
              Spider Diagram
            </h1>
            <p className="text-gray-500 mt-1">
              Compare factsheet {axisMode} across multiple dimensions
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        propertyFilters={propertyFilters}
        onPropertyFilterChange={(propId, value) =>
          setPropertyFilters({ ...propertyFilters, [propId]: value })
        }
        propertyDefinitions={propertyDefinitions}
        propertyOptions={propertyOptions}
        factsheetTypes={factsheetTypes}
        hasFilters={hasFilters}
        onClearFilters={clearAllFilters}
        filteredCount={filteredFactsheets.length}
        totalCount={factsheets.length}
      />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spider Diagram */}
        <Card className="lg:col-span-2">
          <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex gap-4 items-start">
              <div className="flex gap-2">
                <button
                  onClick={() => setAxisMode("properties")}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    axisMode === "properties"
                      ? "bg-accent-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Properties
                </button>
                <button
                  onClick={() => setAxisMode("metrics")}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    axisMode === "metrics"
                      ? "bg-accent-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Metrics
                </button>
              </div>
              <p className="text-sm text-gray-600 pt-2">
                {axisMode === "metrics"
                  ? "Select metrics to compute weighted scores"
                  : "Select properties with their corresponding weights"}
              </p>
            </div>

            {/* Title and action buttons */}
            <div className="flex items-center justify-between">
              <CardTitle>
                {axisMode === "metrics" ? "Metrics" : "Properties"} Comparison
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllDimensions}
                  disabled={
                    selectedMetrics.size ===
                    (axisMode === "metrics"
                      ? metrics.length
                      : propertyDefinitions.length)
                  }
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearDimensionSelection}
                  disabled={selectedMetrics.size === 0}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Dimension toggles */}
            <div className="flex flex-wrap gap-2">
              {(axisMode === "metrics" ? metrics : propertyDefinitions).map(
                (dimension) => {
                  const isSelected = selectedMetrics.has(dimension.id);
                  return (
                    <button
                      key={dimension.id}
                      onClick={() => toggleDimension(dimension.id)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        isSelected
                          ? "bg-accent-500 text-white border-accent-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-accent-300"
                      }`}
                    >
                      {dimension.name}
                    </button>
                  );
                },
              )}
            </div>

            {/* Diagram visualization */}
            <div className="flex justify-center">
              {loading ? (
                <div className="animate-pulse h-[500px] w-full bg-gray-100 rounded" />
              ) : dimensionNames.length < 3 ? (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  <div className="text-center">
                    <Radar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Select at least 3 {axisMode} for the spider diagram</p>
                    <p className="text-sm mt-1">
                      {(axisMode === "metrics"
                        ? metrics.length
                        : propertyDefinitions.length) < 3
                        ? `Configure more ${axisMode} in the Settings page`
                        : `${selectedMetrics.size} of ${axisMode === "metrics" ? metrics.length : propertyDefinitions.length} ${axisMode} selected`}
                    </p>
                  </div>
                </div>
              ) : filteredFactsheets.length === 0 ? (
                <div className="flex items-center justify-center h-[400px] text-gray-500">
                  <div className="text-center">
                    <Radar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No factsheets match the current filters</p>
                  </div>
                </div>
              ) : (
                <SpiderDiagram
                  data={filteredSpiderData}
                  metrics={dimensionNames}
                  maxValue={10}
                  size={500}
                  showLabels={true}
                  showLegend={true}
                  interactive={true}
                  onPointHover={handlePointHover}
                  onPointClick={handlePointClick}
                  highlightedId={highlightedFactsheet}
                />
              )}
            </div>
          </div>
        </Card>

        {/* Factsheet details panel */}
        <Card>
          <CardTitle>
            {selectedFactsheet ? selectedFactsheet.name : "Factsheet Details"}
          </CardTitle>
          {selectedFactsheet ? (
            <div className="mt-4 space-y-4">
              {/* Type and status */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedFactsheet.expand?.type && (
                  <span
                    className="px-2 py-0.5 text-xs font-medium text-white rounded"
                    style={{
                      backgroundColor: selectedFactsheet.expand.type.color,
                    }}
                  >
                    {selectedFactsheet.expand.type.name}
                  </span>
                )}
                <Badge variant={getStatusVariant(selectedFactsheet.status)}>
                  {selectedFactsheet.status}
                </Badge>
              </div>

              {/* Description */}
              {selectedFactsheet.description && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    Description
                  </h4>
                  <p className="text-sm text-gray-700">
                    {selectedFactsheet.description}
                  </p>
                </div>
              )}

              {/* Values based on mode */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  {axisMode === "metrics" ? "Metrics" : "Properties"}
                </h4>
                <div className="space-y-2">
                  {axisMode === "metrics"
                    ? metrics.map((metric) => {
                        const score = computeMetricScore(
                          selectedFactsheet.id,
                          metric,
                        );
                        if (score === null) return null;

                        const percentage = (score / 10) * 100;
                        return (
                          <div key={metric.id}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">
                                {metric.name}
                              </span>
                              <span className="font-medium">
                                {score.toFixed(1)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    : propertyDefinitions.map((prop) => {
                        const fsProps = factsheetPropertyLookup.get(
                          selectedFactsheet.id,
                        );
                        const fp = fsProps?.get(prop.id);
                        const weight =
                          typeof fp?.expand?.option?.weight === "number"
                            ? fp.expand.option.weight
                            : 0;

                        const percentage = (weight / 10) * 100;
                        return (
                          <div key={prop.id}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{prop.name}</span>
                              <span className="font-medium">
                                {weight.toFixed(1)}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200">
                <a
                  href={`/factsheets/${selectedFactsheet.id}`}
                  className="text-accent-500 hover:text-accent-600 text-sm font-medium"
                >
                  View full details →
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-center py-8 text-gray-500">
              <Radar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                Click on a factsheet in the diagram to see details
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Summary stats */}
      <Card padding="sm">
        <div className="flex gap-8 text-sm text-gray-600">
          <div>
            <span className="font-medium">{filteredFactsheets.length}</span>{" "}
            factsheet
            {filteredFactsheets.length !== 1 ? "s" : ""} shown
          </div>
          <div>
            <span className="font-medium">
              {axisMode === "metrics"
                ? metrics.length
                : propertyDefinitions.length}
            </span>{" "}
            {axisMode === "metrics" ? "metric" : "propert"}
            {(axisMode === "metrics"
              ? metrics.length
              : propertyDefinitions.length) !== 1
              ? axisMode === "metrics"
                ? "s"
                : "ies"
              : axisMode === "metrics"
                ? ""
                : "y"}{" "}
            compared
          </div>
        </div>
      </Card>
    </div>
  );
}
