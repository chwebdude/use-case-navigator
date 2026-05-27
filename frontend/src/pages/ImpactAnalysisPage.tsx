import { useMemo, useState } from "react";
import { TrendingUp, ArrowUpDown } from "lucide-react";
import { Card, CardTitle, Badge, Select } from "../components/ui";
import { FilterBar } from "../components/FilterBar";
import {
  type FactsheetExpanded,
  type FactsheetType,
  type FactsheetPropertyExpanded,
  type PropertyDefinition,
  type PropertyOption,
  type MetricExpanded,
  type Dependency,
} from "../types";
import { useRealtime } from "../hooks/useRealtime";
import { useQueryStates } from "../hooks/useQueryState";
import { useApplyPageDefaults } from "../hooks/useApplyPageDefaults";
import { SaveDefaultsButton } from "../components/SaveDefaultsButton";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useAppSettings } from "../hooks/useAppSettings";
import { getStatusMeta, getStatusTextColor } from "../lib/statusConfig";

interface ImpactData {
  factsheet: FactsheetExpanded;
  dependentCount: number;
  averageMetricScore: number | null;
  totalMetricScore: number | null;
  dependents: Array<{
    id: string;
    name: string;
    metricScore: number | null;
  }>;
}

type SortField = "name" | "dependentCount" | "averageImpact" | "totalImpact";
type SortOrder = "asc" | "desc";
type CalculationMode = "direct" | "all-levels" | "custom";

export default function ImpactAnalysisPage() {
  const {
    settings,
    loading: settingsLoading,
    setSettings: setAppSettings,
  } = useAppSettings();

  const [state, setState] = useQueryStates({
    search: "",
    statusFilter: "",
    typeFilter: [] as string[],
    propertyFilters: {} as Record<string, string>,
    metricFilter: "",
    sortField: "averageImpact" as SortField,
    sortOrder: "desc" as SortOrder,
    calculationMode: "direct" as CalculationMode,
    customDepth: 2,
  });

  const {
    search,
    statusFilter,
    typeFilter,
    propertyFilters,
    metricFilter,
    sortField,
    sortOrder,
    calculationMode,
    customDepth,
  } = state;
  const setSearch = (v: string) => setState("search", v);
  const setStatusFilter = (v: string) => setState("statusFilter", v);
  const setTypeFilter = (v: string[]) => setState("typeFilter", v);
  const setPropertyFilters = (v: Record<string, string>) =>
    setState("propertyFilters", v);
  const setMetricFilter = (v: string) => setState("metricFilter", v);
  const setSortField = (v: SortField) => setState("sortField", v);
  const setSortOrder = (v: SortOrder) => setState("sortOrder", v);
  const setCalculationMode = (v: CalculationMode) =>
    setState("calculationMode", v);
  const setCustomDepth = (v: number) => setState("customDepth", v);

  useApplyPageDefaults(
    settings.defaultImpactFilters,
    setState,
    settingsLoading,
  );

  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );

  const { records: factsheets } = useRealtime<FactsheetExpanded>({
    collection: "factsheets",
    sort: "-created",
    expand: "type",
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: "factsheet_types",
    sort: "order",
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

  const { records: metrics } = useRealtime<MetricExpanded>({
    collection: "metrics",
    sort: "order",
    expand: "properties",
  });

  const { records: dependencies } = useRealtime<Dependency>({
    collection: "dependencies",
  });

  const propertyLookup = useMemo(() => {
    const map = new Map<string, Map<string, FactsheetPropertyExpanded>>();
    factsheetProps.forEach((fp) => {
      if (!map.has(fp.factsheet)) map.set(fp.factsheet, new Map());
      map.get(fp.factsheet)!.set(fp.property, fp);
    });
    return map;
  }, [factsheetProps]);

  // Compute metric score for a specific metric and factsheet
  const computeMetricScore = (
    metricId: string,
    factsheetId: string,
  ): number | null => {
    const metric = metrics.find((m) => m.id === metricId);
    if (!metric) return null;

    const propIds = metric.properties?.length
      ? metric.properties
      : (metric.expand?.properties?.map((p) => p.id) ?? []);

    if (propIds.length === 0) return null;

    const factsheetPropMap = propertyLookup.get(factsheetId);
    if (!factsheetPropMap) return null;

    let sum = 0;
    let count = 0;
    propIds.forEach((pid) => {
      const fp = factsheetPropMap.get(pid);
      if (!fp) return;
      const w =
        typeof fp.expand?.option?.weight === "number"
          ? fp.expand.option.weight
          : 0;
      sum += w;
      count += 1;
    });

    if (count === 0) return null;
    return sum / count;
  };

  // Compute overall metric score for a factsheet (average across all metrics)
  const computeOverallMetricScore = (factsheetId: string): number | null => {
    if (metrics.length === 0) return null;

    const scores: number[] = [];
    metrics.forEach((metric) => {
      const score = computeMetricScore(metric.id, factsheetId);
      if (score !== null) {
        scores.push(score);
      }
    });

    if (scores.length === 0) return null;
    return scores.reduce((sum, s) => sum + s, 0) / scores.length;
  };

  // Compute specific metric score when a metric filter is applied
  const computeFactsheetScore = (factsheetId: string): number | null => {
    if (metricFilter) {
      return computeMetricScore(metricFilter, factsheetId);
    }
    return computeOverallMetricScore(factsheetId);
  };

  // Calculate all transitive dependents (all levels) for a factsheet
  const getAllDependents = (factsheetId: string): Set<string> => {
    const result = new Set<string>();
    const queue: string[] = [factsheetId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find all factsheets that directly depend on currentId
      const directDependents = dependencies
        .filter((dep) => dep.depends_on === currentId)
        .map((dep) => dep.factsheet);

      directDependents.forEach((depId) => {
        if (depId !== factsheetId) {
          // Don't include the original factsheet
          result.add(depId);
          queue.push(depId);
        }
      });
    }

    return result;
  };

  // Calculate dependents up to a specific depth
  const getDependentsWithDepth = (
    factsheetId: string,
    maxDepth: number,
  ): Set<string> => {
    const result = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [
      { id: factsheetId, depth: 0 },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      // Stop if we've reached max depth
      if (current.depth >= maxDepth) continue;

      // Find all factsheets that directly depend on current
      const directDependents = dependencies
        .filter((dep) => dep.depends_on === current.id)
        .map((dep) => dep.factsheet);

      directDependents.forEach((depId) => {
        if (depId !== factsheetId) {
          result.add(depId);
          queue.push({ id: depId, depth: current.depth + 1 });
        }
      });
    }

    return result;
  };

  // Build reverse dependency map: factsheet -> list of factsheets that depend on it
  const impactData = useMemo(() => {
    const data: ImpactData[] = factsheets.map((fs) => {
      // Find factsheets that depend on this one based on calculation mode
      let dependentFactsheetIds: string[];
      if (calculationMode === "all-levels") {
        dependentFactsheetIds = Array.from(getAllDependents(fs.id));
      } else if (calculationMode === "custom") {
        dependentFactsheetIds = Array.from(
          getDependentsWithDepth(fs.id, customDepth),
        );
      } else {
        // Direct only
        dependentFactsheetIds = dependencies
          .filter((dep) => dep.depends_on === fs.id)
          .map((dep) => dep.factsheet);
      }

      const dependents = dependentFactsheetIds
        .map((depId) => {
          const depFactsheet = factsheets.find((f) => f.id === depId);
          if (!depFactsheet) return null;

          const metricScore = computeFactsheetScore(depId);
          return {
            id: depId,
            name: depFactsheet.name,
            metricScore,
          };
        })
        .filter((d) => d !== null) as ImpactData["dependents"];

      const metricScores = dependents
        .map((d) => d.metricScore)
        .filter((s): s is number => s !== null);

      const averageMetricScore =
        metricScores.length > 0
          ? metricScores.reduce((sum, s) => sum + s, 0) / metricScores.length
          : null;

      const totalMetricScore =
        metricScores.length > 0
          ? metricScores.reduce((sum, s) => sum + s, 0)
          : null;

      return {
        factsheet: fs,
        dependentCount: dependents.length,
        averageMetricScore,
        totalMetricScore,
        dependents,
      };
    });

    return data;
  }, [
    factsheets,
    dependencies,
    metricFilter,
    metrics,
    propertyLookup,
    calculationMode,
    customDepth,
  ]);

  // Filter impact data
  const filteredImpactData = useMemo(() => {
    return impactData.filter((data) => {
      const fs = data.factsheet;

      const matchesSearch =
        search === "" ||
        fs.name.toLowerCase().includes(search.toLowerCase()) ||
        fs.description?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "" || (fs.status_id || fs.status) === statusFilter;
      const matchesType =
        typeFilter.length === 0 || typeFilter.includes(fs.type);

      const matchesProperties = Object.entries(propertyFilters).every(
        ([propId, value]) => {
          if (value === "") return true;
          const fp = propertyLookup.get(fs.id)?.get(propId);
          const v = fp?.expand?.option?.value;
          return v === value;
        },
      );

      return matchesSearch && matchesStatus && matchesType && matchesProperties;
    });
  }, [
    impactData,
    search,
    statusFilter,
    typeFilter,
    propertyFilters,
    propertyLookup,
  ]);

  // Sort impact data
  const sortedImpactData = useMemo(() => {
    const sorted = [...filteredImpactData];

    sorted.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "name":
          aVal = a.factsheet.name.toLowerCase();
          bVal = b.factsheet.name.toLowerCase();
          break;
        case "dependentCount":
          aVal = a.dependentCount;
          bVal = b.dependentCount;
          break;
        case "averageImpact":
          aVal = a.averageMetricScore ?? -1;
          bVal = b.averageMetricScore ?? -1;
          break;
        case "totalImpact":
          aVal = a.totalMetricScore ?? -1;
          bVal = b.totalMetricScore ?? -1;
          break;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredImpactData, sortField, sortOrder]);

  const hasFilters =
    search !== "" ||
    typeFilter.length > 0 ||
    statusFilter !== "" ||
    Object.keys(propertyFilters).some((k) => propertyFilters[k] !== "") ||
    metricFilter !== "";

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter([]);
    setStatusFilter("");
    setPropertyFilters({});
    setMetricFilter("");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 opacity-30" />;
    }
    return (
      <ArrowUpDown
        className={`w-4 h-4 ${sortOrder === "desc" ? "rotate-180" : ""}`}
      />
    );
  };

  const metricOptions = [
    { value: "", label: "All Metrics (Average)" },
    ...metrics.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              Impact Analysis
            </h1>
          </div>
          <SaveDefaultsButton
            type="impact"
            filters={state}
            onSave={(filters) =>
              setAppSettings({ defaultImpactFilters: filters })
            }
          />
        </div>

        <div className="space-y-3">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            propertyFilters={propertyFilters}
            onPropertyFilterChange={(propId, value) =>
              setPropertyFilters({ ...propertyFilters, [propId]: value })
            }
            factsheetTypes={factsheetTypes}
            propertyDefinitions={propertyDefinitions}
            propertyOptions={propertyOptions}
            hasFilters={hasFilters}
            onClearFilters={clearAllFilters}
            filteredCount={filteredImpactData.length}
            totalCount={impactData.length}
          />

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Metric:
              </label>
              <Select
                value={metricFilter}
                onChange={(e) => setMetricFilter(e.target.value)}
                options={metricOptions}
                className="w-64"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Calculation:
              </label>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setCalculationMode("direct")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    calculationMode === "direct"
                      ? "bg-accent-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Direct Only
                </button>
                <button
                  onClick={() => setCalculationMode("all-levels")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    calculationMode === "all-levels"
                      ? "bg-accent-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  All Levels
                </button>
                <button
                  onClick={() => setCalculationMode("custom")}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    calculationMode === "custom"
                      ? "bg-accent-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Custom Depth
                </button>
                {calculationMode === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={customDepth}
                      onChange={(e) =>
                        setCustomDepth(
                          Math.max(
                            1,
                            Math.min(10, parseInt(e.target.value) || 1),
                          ),
                        )
                      }
                      className="w-16 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    <span className="text-sm text-gray-600">levels</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardTitle>
            Impact Analysis Results
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({sortedImpactData.length} factsheets)
            </span>
          </CardTitle>

          {sortedImpactData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No factsheets found matching the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th
                      className="text-left p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Factsheet
                        {getSortIcon("name")}
                      </div>
                    </th>
                    <th className="text-left p-3 font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="text-left p-3 font-semibold text-gray-700">
                      Status
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSort("dependentCount")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Dependents
                        {getSortIcon("dependentCount")}
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSort("averageImpact")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Avg Impact
                        {getSortIcon("averageImpact")}
                      </div>
                    </th>
                    <th
                      className="text-right p-3 font-semibold text-gray-700 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleSort("totalImpact")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Total Impact
                        {getSortIcon("totalImpact")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedImpactData.map((data) => {
                    const fs = data.factsheet;
                    const statusMeta = getStatusMeta(
                      fs.status_id || fs.status,
                      settings.statuses,
                      fs.expand?.type,
                    );
                    return (
                      <tr
                        key={fs.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedFactsheetId(fs.id)}
                      >
                        <td className="p-3">
                          <div className="font-medium text-gray-900">
                            {fs.name}
                          </div>
                          {fs.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">
                              {fs.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {fs.expand?.type && (
                            <Badge
                              variant="default"
                              style={{
                                backgroundColor: fs.expand.type.color,
                                color: "white",
                              }}
                            >
                              {fs.expand.type.icon && (
                                <span className="mr-1">
                                  {fs.expand.type.icon}
                                </span>
                              )}
                              {fs.expand.type.name}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            className="rounded-full"
                            style={{
                              backgroundColor: statusMeta.color,
                              color: getStatusTextColor(statusMeta.color),
                            }}
                          >
                            {statusMeta.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-medium">
                            {data.dependentCount}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {data.averageMetricScore !== null ? (
                            <span
                              className={`font-medium ${
                                data.averageMetricScore >= 7
                                  ? "text-green-600"
                                  : data.averageMetricScore >= 4
                                    ? "text-yellow-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {data.averageMetricScore.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {data.totalMetricScore !== null ? (
                            <span
                              className={`font-medium ${
                                data.totalMetricScore >= 20
                                  ? "text-green-600"
                                  : data.totalMetricScore >= 10
                                    ? "text-yellow-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {data.totalMetricScore.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {sortedImpactData.length > 0 && (
          <div className="mt-6">
            <Card>
              <CardTitle>Understanding Impact Analysis</CardTitle>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <strong>Impact</strong> measures how important a factsheet is
                  based on the quality (metrics) of factsheets that depend on
                  it.
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>Dependents:</strong> Number of factsheets that
                    depend on this one{" "}
                    {calculationMode === "all-levels"
                      ? "(all dependency levels)"
                      : calculationMode === "custom"
                        ? `(up to ${customDepth} level${customDepth > 1 ? "s" : ""})`
                        : "(direct only)"}
                  </li>
                  <li>
                    <strong>Average Impact:</strong> Average metric score of
                    dependent factsheets
                  </li>
                  <li>
                    <strong>Total Impact:</strong> Sum of metric scores of
                    dependent factsheets
                  </li>
                </ul>
                <p>
                  Higher scores indicate that this factsheet supports
                  higher-value use cases or initiatives. Use{" "}
                  <strong>"Direct Only"</strong> to see immediate dependents,{" "}
                  <strong>"All Levels"</strong> to include the entire dependency
                  chain, or <strong>"Custom Depth"</strong> to specify a maximum
                  number of dependency levels.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>

      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
