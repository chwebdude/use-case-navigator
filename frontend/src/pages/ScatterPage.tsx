import { useMemo, useState } from "react";
import { Search, Filter, Grid3X3 } from "lucide-react";
import { Card, CardTitle, Button, Select, Badge } from "../components/ui";
import {
  type FactsheetExpanded,
  type FactsheetType,
  type FactsheetPropertyExpanded,
  type PropertyDefinition,
  type PropertyOption,
} from "../types";
import { useRealtime } from "../hooks/useRealtime";
import ScatterPlot, {
  type ScatterPoint,
  type AxisTick,
} from "../components/visualizations/ScatterPlot";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useAppSettings } from "../hooks/useAppSettings";

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

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

export default function ScatterPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [propertyFilters, setPropertyFilters] = useState<
    Record<string, string>
  >({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
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

  const typeOptions = [
    { value: "", label: "All Types" },
    ...factsheetTypes.map((t) => ({ value: t.id, label: t.name })),
  ];

  const optionsByProperty = useMemo(() => {
    const map = new Map<string, PropertyOption[]>();
    propertyOptions.forEach((opt) => {
      if (!map.has(opt.property)) map.set(opt.property, []);
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

  const axisOptions = propertyDefinitions.map((p) => ({
    value: p.id,
    label: p.name,
  }));

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
      propId: string,
      fp?: FactsheetPropertyExpanded,
    ) => {
      if (!propId || !fp) return null;
      const w = fp.expand?.option?.weight;
      if (typeof w === "number") return w;
      const opts = optionsByProperty.get(propId) || [];
      const val = fp.expand?.option?.value;
      const idx = opts.findIndex((o) => o.value === val);
      return idx >= 0 ? idx + 1 : null;
    };

    return filteredFactsheets
      .map((fs, index) => {
        const typeColor =
          fs.expand?.type?.color || colorPalette[index % colorPalette.length];
        const xFp = xAxis ? propertyLookup.get(fs.id)?.get(xAxis) : undefined;
        const yFp = yAxis ? propertyLookup.get(fs.id)?.get(yAxis) : undefined;
        const max = settings.maxMetricWeight ?? 10;
        const xValRaw = getNumericValue(xAxis, xFp);
        const yValRaw = getNumericValue(yAxis, yFp);
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
    propertyLookup,
    optionsByProperty,
    settings.maxMetricWeight,
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

      <Card padding="sm">
        <div className="flex gap-6 items-end">
          <div className="w-56">
            <Select
              label="X Axis (Horizontal)"
              options={axisOptions}
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
              placeholder="Select property..."
            />
          </div>
          <div className="w-56">
            <Select
              label="Y Axis (Vertical)"
              options={axisOptions}
              value={yAxis}
              onChange={(e) => setYAxis(e.target.value)}
              placeholder="Select property..."
            />
          </div>
        </div>
      </Card>

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
          {propertyDefinitions
            .filter((prop) => prop.id !== xAxis && prop.id !== yAxis)
            .map((propDef) => {
              const opts = optionsByProperty.get(propDef.id) || [];
              if (opts.length === 0) return null;
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
                      ...opts.map((o) => ({ value: o.value, label: o.value })),
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

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Scatter by Property Weights</CardTitle>
          <Badge variant="default">{points.length} points</Badge>
        </div>
        {xAxis && yAxis ? (
          <ScatterPlot
            points={points}
            xLabel={
              propertyDefinitions.find((p) => p.id === xAxis)?.name || "X"
            }
            yLabel={
              propertyDefinitions.find((p) => p.id === yAxis)?.name || "Y"
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
