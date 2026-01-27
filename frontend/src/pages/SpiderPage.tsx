import { useState, useMemo } from "react";
import { Search, Filter, Radar } from "lucide-react";
import { Card, CardTitle, Button, Select, Badge } from "../components/ui";
import { SpiderDiagram } from "../components/visualizations";
import type { SpiderDataPoint } from "../components/visualizations/SpiderDiagram";
import { useRealtime } from "../hooks/useRealtime";
import type {
  FactsheetType,
  FactsheetExpanded,
  MetricExpanded,
  FactsheetPropertyExpanded,
  PropertyDefinition,
  PropertyOption,
} from "../types";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

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

export default function SpiderPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [propertyFilters, setPropertyFilters] = useState<
    Record<string, string>
  >({});
  const [highlightedFactsheet, setHighlightedFactsheet] = useState<
    string | null
  >(null);
  const [selectedFactsheet, setSelectedFactsheet] =
    useState<FactsheetExpanded | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(),
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

  const typeOptions = [
    { value: "", label: "All Types" },
    ...factsheetTypes.map((t) => ({ value: t.id, label: t.name })),
  ];

  // Group options by property for filter dropdowns
  const optionsByProperty = useMemo(() => {
    const map = new Map<string, PropertyOption[]>();
    propertyOptions.forEach((opt) => {
      if (!map.has(opt.property)) {
        map.set(opt.property, []);
      }
      map.get(opt.property)!.push(opt);
    });
    map.forEach((opts) => {
      opts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return map;
  }, [propertyOptions]);

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
  }, [filteredFactsheets, metrics, factsheetPropertyLookup]);

  // Initialize selected metrics when metrics load
  useMemo(() => {
    if (metrics.length > 0 && selectedMetrics.size === 0) {
      setSelectedMetrics(new Set(metrics.map((m) => m.id)));
    }
  }, [metrics]);

  // Filter metrics based on selection
  const filteredMetrics = useMemo(() => {
    if (selectedMetrics.size === 0) return metrics;
    return metrics.filter((m) => selectedMetrics.has(m.id));
  }, [metrics, selectedMetrics]);

  const metricNames = useMemo(
    () => filteredMetrics.map((m) => m.name),
    [filteredMetrics],
  );

  // Filter spider data to only include selected metrics
  const filteredSpiderData: SpiderDataPoint[] = useMemo(() => {
    return spiderData.map((point) => ({
      ...point,
      values: point.values.filter((v) =>
        filteredMetrics.some((m) => m.name === v.metric),
      ),
    }));
  }, [spiderData, filteredMetrics]);

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) {
        next.delete(metricId);
      } else {
        next.add(metricId);
      }
      return next;
    });
  };

  const selectAllMetrics = () => {
    setSelectedMetrics(new Set(metrics.map((m) => m.id)));
  };

  const clearMetricSelection = () => {
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
              Compare factsheet metrics across multiple dimensions
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search factsheets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-40">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={typeOptions}
            />
          </div>
          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>
          {/* Property filters */}
          {propertyDefinitions.map((propDef) => {
            const options = optionsByProperty.get(propDef.id) || [];
            if (options.length === 0) return null;

            return (
              <div key={propDef.id} className="w-40">
                <Select
                  value={propertyFilters[propDef.id] || ""}
                  onChange={(e) =>
                    setPropertyFilters((prev) => ({
                      ...prev,
                      [propDef.id]: e.target.value,
                    }))
                  }
                  options={[
                    { value: "", label: `All ${propDef.name}` },
                    ...options.map((opt) => ({
                      value: opt.value,
                      label: opt.value,
                    })),
                  ]}
                />
              </div>
            );
          })}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <Filter className="w-4 h-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spider Diagram */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Metrics Comparison</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllMetrics}
                disabled={selectedMetrics.size === metrics.length}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMetricSelection}
                disabled={selectedMetrics.size === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          {/* Metric toggles */}
          <div className="flex flex-wrap gap-2 mb-4">
            {metrics.map((metric) => {
              const isSelected = selectedMetrics.has(metric.id);
              return (
                <button
                  key={metric.id}
                  onClick={() => toggleMetric(metric.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    isSelected
                      ? "bg-accent-500 text-white border-accent-500"
                      : "bg-white text-gray-600 border-gray-300 hover:border-accent-300"
                  }`}
                >
                  {metric.name}
                </button>
              );
            })}
          </div>
          <div className="flex justify-center">
            {loading ? (
              <div className="animate-pulse h-[500px] w-full bg-gray-100 rounded" />
            ) : metricNames.length < 3 ? (
              <div className="flex items-center justify-center h-[400px] text-gray-500">
                <div className="text-center">
                  <Radar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Select at least 3 metrics for the spider diagram</p>
                  <p className="text-sm mt-1">
                    {metrics.length < 3
                      ? "Configure more metrics in the Settings page"
                      : `${selectedMetrics.size} of ${metrics.length} metrics selected`}
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
                metrics={metricNames}
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

              {/* Metrics */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Metrics
                </h4>
                <div className="space-y-2">
                  {metrics.map((metric) => {
                    const score = computeMetricScore(
                      selectedFactsheet.id,
                      metric,
                    );
                    if (score === null) return null;

                    const percentage = (score / 10) * 100;
                    return (
                      <div key={metric.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{metric.name}</span>
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
            <span className="font-medium">{metrics.length}</span> metric
            {metrics.length !== 1 ? "s" : ""} compared
          </div>
        </div>
      </Card>
    </div>
  );
}
