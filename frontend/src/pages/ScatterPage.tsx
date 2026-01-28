import { useMemo, useState, useEffect, useRef } from "react";
import { Grid3X3 } from "lucide-react";
import { Card, CardTitle, Badge, Select } from "../components/ui";
import { FilterBar } from "../components/FilterBar";
import {
  type FactsheetExpanded,
  type FactsheetType,
  type FactsheetPropertyExpanded,
  type PropertyDefinition,
  type PropertyOption,
  type MetricExpanded,
} from "../types";
import { useRealtime } from "../hooks/useRealtime";
import { useQueryStates } from "../hooks/useQueryState";
import ScatterPlot, {
  type ScatterPoint,
  type AxisTick,
} from "../components/visualizations/ScatterPlot";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useAppSettings } from "../hooks/useAppSettings";

const colorPalette = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
];

type AxisMode = "properties" | "metrics";

export default function ScatterPage() {
  const [state, setState] = useQueryStates({
    search: "",
    statusFilter: "",
    typeFilter: "",
    propertyFilters: {} as Record<string, string>,
    xAxis: "",
    yAxis: "",
    axisMode: "properties" as AxisMode,
  });

  const {
    search,
    statusFilter,
    typeFilter,
    propertyFilters,
    xAxis,
    yAxis,
    axisMode,
  } = state;
  const setSearch = (v: string) => setState("search", v);
  const setStatusFilter = (v: string) => setState("statusFilter", v);
  const setTypeFilter = (v: string) => setState("typeFilter", v);
  const setPropertyFilters = (v: Record<string, string>) =>
    setState("propertyFilters", v);
  const setXAxis = (v: string) => setState("xAxis", v);
  const setYAxis = (v: string) => setState("yAxis", v);
  const setAxisMode = (v: AxisMode) => setState("axisMode", v);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );
  const prevAxisModeRef = useRef<AxisMode>(axisMode);
  const { settings } = useAppSettings();

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

  // Clear axes only when user actively changes mode (not on initial URL restoration)
  useEffect(() => {
    if (prevAxisModeRef.current !== axisMode) {
      setXAxis("");
      setYAxis("");
      prevAxisModeRef.current = axisMode;
    }
  }, [axisMode, setXAxis, setYAxis]);

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

  const propertyLookup = useMemo(() => {
    const map = new Map<string, Map<string, FactsheetPropertyExpanded>>();
    factsheetProps.forEach((fp) => {
      if (!map.has(fp.factsheet)) map.set(fp.factsheet, new Map());
      map.get(fp.factsheet)!.set(fp.property, fp);
    });
    return map;
  }, [factsheetProps]);

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
          const fp = propertyLookup.get(fs.id)?.get(propId);
          const v = fp?.expand?.option?.value;
          return v === value;
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

  const propertyAxisOptions = propertyDefinitions.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const metricAxisOptions = metrics.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const axisOptions =
    axisMode === "metrics" ? metricAxisOptions : propertyAxisOptions;

  const xTicks: AxisTick[] = useMemo(() => {
    if (!xAxis) return [];
    const max = settings.maxMetricWeight ?? 10;
    return Array.from({ length: max + 1 }, (_, i) => ({
      value: i,
      label: String(i),
    }));
  }, [xAxis, settings.maxMetricWeight]);

  const yTicks: AxisTick[] = useMemo(() => {
    if (!yAxis) return [];
    const max = settings.maxMetricWeight ?? 10;
    return Array.from({ length: max + 1 }, (_, i) => ({
      value: i,
      label: String(i),
    }));
  }, [yAxis, settings.maxMetricWeight]);

  const points: ScatterPoint[] = useMemo(() => {
    const getNumericValue = (
      axisId: string,
      fp?: FactsheetPropertyExpanded,
    ) => {
      if (!axisId || !fp) return null;
      const w = fp.expand?.option?.weight;
      if (typeof w === "number") return w;
      const opts = optionsByProperty.get(axisId) || [];
      const val = fp.expand?.option?.value;
      const idx = opts.findIndex((o) => o.value === val);
      return idx >= 0 ? idx + 1 : null;
    };

    const getValue = (
      axisId: string,
      factsheetId: string,
      mode: AxisMode,
    ): number | null => {
      if (mode === "metrics") {
        return computeMetricScore(axisId, factsheetId);
      } else {
        const fp = propertyLookup.get(factsheetId)?.get(axisId);
        return getNumericValue(axisId, fp);
      }
    };

    const max = settings.maxMetricWeight ?? 10;

    return filteredFactsheets
      .map((fs, index) => {
        const typeColor =
          fs.expand?.type?.color || colorPalette[index % colorPalette.length];
        const xValRaw = getValue(xAxis, fs.id, axisMode);
        const yValRaw = getValue(yAxis, fs.id, axisMode);
        const xVal =
          xValRaw == null ? null : Math.max(0, Math.min(max, xValRaw));
        const yVal =
          yValRaw == null ? null : Math.max(0, Math.min(max, yValRaw));
        return { id: fs.id, name: fs.name, color: typeColor, x: xVal, y: yVal };
      })
      .filter((p) => p.x !== null && p.y !== null);
  }, [
    filteredFactsheets,
    xAxis,
    yAxis,
    axisMode,
    propertyLookup,
    optionsByProperty,
    settings.maxMetricWeight,
    computeMetricScore,
  ]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-8 h-8 text-accent-500" />
          <div>
            <h1 className="text-2xl font-bold text-primary-900">
              Scatter Plot
            </h1>
            <p className="text-gray-500 mt-1">
              Visualize factsheets by two selected properties
            </p>
          </div>
        </div>
      </div>

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
        excludePropertyIds={[xAxis, yAxis]}
      />

      <Card padding="sm">
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
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
            <p className="text-sm text-gray-600">
              {axisMode === "metrics"
                ? "Select metrics to compute weighted scores"
                : "Select properties with their corresponding weights"}
            </p>
          </div>
          <div className="flex gap-6 items-end">
            <div className="w-56">
              <Select
                label="X Axis (Horizontal)"
                options={axisOptions}
                value={xAxis}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setXAxis(e.target.value)
                }
                placeholder={`Select ${axisMode}...`}
              />
            </div>
            <div className="w-56">
              <Select
                label="Y Axis (Vertical)"
                options={axisOptions}
                value={yAxis}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setYAxis(e.target.value)
                }
                placeholder={`Select ${axisMode}...`}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>
            Scatter Plot
            {axisMode === "metrics" && " (Metric Scores)"}
            {axisMode === "properties" && " (Property Weights)"}
          </CardTitle>
          <Badge variant="default">{points.length} points</Badge>
        </div>
        {xAxis && yAxis ? (
          <ScatterPlot
            points={points}
            xLabel={
              axisMode === "metrics"
                ? metrics.find((m) => m.id === xAxis)?.name || "X"
                : propertyDefinitions.find((p) => p.id === xAxis)?.name || "X"
            }
            yLabel={
              axisMode === "metrics"
                ? metrics.find((m) => m.id === yAxis)?.name || "Y"
                : propertyDefinitions.find((p) => p.id === yAxis)?.name || "Y"
            }
            xTicks={xTicks}
            yTicks={yTicks}
            highlightedId={highlightedId}
            onPointHover={(p) => setHighlightedId(p?.id ?? null)}
            onPointClick={(p) => {
              setHighlightedId(p.id);
              setSelectedFactsheetId(p.id);
            }}
          />
        ) : (
          <div className="w-full h-[420px] bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">
              Select both X and Y axis properties to view the scatter plot
            </p>
          </div>
        )}
      </Card>

      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
