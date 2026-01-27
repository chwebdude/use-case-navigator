import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Filter } from "lucide-react";
import { Card, Button, Select, Badge, MetricBadge } from "../components/ui";
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

export default function FactsheetList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [propertyFilters, setPropertyFilters] = useState<
    Record<string, string>
  >({});

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
    // Sort options within each property by order
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
      // Use the expanded option value
      const optionValue = fp.expand?.option?.value || "";
      if (optionValue) {
        lookup.get(fp.factsheet)!.set(fp.property, optionValue);
      }
    });
    return lookup;
  }, [factsheetProps]);

  const filteredFactsheets = factsheets.filter((fs) => {
    const matchesSearch =
      search === "" ||
      fs.name.toLowerCase().includes(search.toLowerCase()) ||
      fs.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "" || fs.status === statusFilter;
    const matchesType = typeFilter === "" || fs.type === typeFilter;

    // Check property filters
    const matchesProperties = Object.entries(propertyFilters).every(
      ([propId, value]) => {
        if (value === "") return true;
        const fsProps = propertyLookup.get(fs.id);
        return fsProps?.get(propId) === value;
      },
    );

    return matchesSearch && matchesStatus && matchesType && matchesProperties;
  });

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

  const computeMetricScore = (factsheetId: string, metric: MetricExpanded) => {
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Factsheets</h1>
          <p className="text-gray-500 mt-1">Manage and track your factsheets</p>
        </div>
        <Link to="/factsheets/new">
          <Button icon={<Plus className="w-4 h-4" />}>New Factsheet</Button>
        </Link>
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
                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-40">
            <Select
              label="Type"
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          {propertyDefinitions.map((prop) => {
            const opts = optionsByProperty.get(prop.id) || [];
            return (
              <div key={prop.id} className="w-40">
                <Select
                  label={prop.name}
                  options={[
                    { value: "", label: `All ${prop.name}` },
                    ...opts.map((opt) => ({
                      value: opt.value,
                      label: opt.value,
                    })),
                  ]}
                  value={propertyFilters[prop.id] || ""}
                  onChange={(e) =>
                    setPropertyFilters((prev) => ({
                      ...prev,
                      [prop.id]: e.target.value,
                    }))
                  }
                />
              </div>
            );
          })}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear Filters
            </Button>
          )}
          <div className="ml-auto flex items-center">
            <span className="text-sm text-gray-500">
              {filteredFactsheets.length} of {factsheets.length} factsheets
            </span>
          </div>
        </div>
      </Card>

      {/* Factsheet list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 w-1/3"></div>
                <div className="h-4 bg-gray-200 w-2/3"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredFactsheets.length === 0 ? (
        <Card className="text-center py-16">
          {search || statusFilter || typeFilter ? (
            <>
              <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">
                No matching factsheets
              </h3>
              <p className="text-gray-500 mt-2">
                Try adjusting your search or filter criteria
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setTypeFilter("");
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <Plus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">
                No factsheets yet
              </h3>
              <p className="text-gray-500 mt-2">
                Get started by creating your first factsheet
              </p>
              <Link to="/factsheets/new">
                <Button className="mt-4" showArrow>
                  Create Factsheet
                </Button>
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFactsheets.map((factsheet) => {
            const typeColor = factsheet.expand?.type?.color || "#6b7280";
            const typeName = factsheet.expand?.type?.name || "Unknown";

            return (
              <Link key={factsheet.id} to={`/factsheets/${factsheet.id}`}>
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3"
                          style={{ backgroundColor: typeColor }}
                        />
                        <h3 className="text-lg font-medium text-primary-900">
                          {factsheet.name}
                        </h3>
                        <span
                          className="px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: typeColor }}
                        >
                          {typeName}
                        </span>
                        <Badge
                          variant={getStatusVariant(factsheet.status)}
                          size="sm"
                        >
                          {factsheet.status}
                        </Badge>
                      </div>
                      <p className="text-gray-500 mt-2 line-clamp-2">
                        {factsheet.description || "No description provided"}
                      </p>
                    </div>
                  </div>
                  {metrics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {metrics.map((metric) => {
                        const score = computeMetricScore(factsheet.id, metric);
                        return score !== null ? (
                          <MetricBadge
                            key={metric.id}
                            name={metric.name}
                            score={score}
                            variant="compact"
                          />
                        ) : null;
                      })}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Created {new Date(factsheet.created).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span>
                      Updated {new Date(factsheet.updated).toLocaleDateString()}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
