import { Search } from "lucide-react";
import { Card, Select, Button } from "./ui";
import type {
  PropertyDefinition,
  PropertyOption,
  FactsheetType,
} from "../types";
import { useEffect, useMemo, useState } from "react";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;

  statusFilter: string;
  onStatusChange: (value: string) => void;

  typeFilter: string;
  onTypeChange: (value: string) => void;

  propertyFilters: Record<string, string>;
  onPropertyFilterChange: (propId: string, value: string) => void;

  propertyDefinitions: PropertyDefinition[];
  propertyOptions: PropertyOption[];
  factsheetTypes: FactsheetType[];

  hasFilters: boolean;
  onClearFilters: () => void;

  filteredCount: number;
  totalCount: number;

  excludePropertyIds?: string[];
  additionalSettings?: React.ReactNode;
  showPropertyCount?: boolean;
}

export function FilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  propertyFilters,
  onPropertyFilterChange,
  propertyDefinitions,
  propertyOptions,
  factsheetTypes,
  hasFilters,
  onClearFilters,
  filteredCount,
  totalCount,
  excludePropertyIds = [],
  additionalSettings,
  showPropertyCount = true,
}: FilterBarProps) {
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

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];

  const [propertyGridColumns, setPropertyGridColumns] = useState(2);
  const [showAllPropertyFilters, setShowAllPropertyFilters] = useState(false);

  useEffect(() => {
    const getColumns = () => {
      if (window.matchMedia("(min-width: 1536px)").matches) return 7;
      if (window.matchMedia("(min-width: 1280px)").matches) return 6;
      if (window.matchMedia("(min-width: 1024px)").matches) return 5;
      if (window.matchMedia("(min-width: 768px)").matches) return 4;
      if (window.matchMedia("(min-width: 640px)").matches) return 3;
      return 2;
    };

    const updateColumns = () => setPropertyGridColumns(getColumns());
    const mediaQueries = [
      window.matchMedia("(min-width: 640px)"),
      window.matchMedia("(min-width: 768px)"),
      window.matchMedia("(min-width: 1024px)"),
      window.matchMedia("(min-width: 1280px)"),
      window.matchMedia("(min-width: 1536px)"),
    ];

    updateColumns();
    mediaQueries.forEach((mq) => mq.addEventListener("change", updateColumns));
    return () => {
      mediaQueries.forEach((mq) =>
        mq.removeEventListener("change", updateColumns),
      );
    };
  }, []);

  // Filter out excluded properties
  const filterableProperties = propertyDefinitions.filter(
    (p) => !excludePropertyIds.includes(p.id),
  );

  const shouldCollapsePropertyFilters =
    filterableProperties.length > propertyGridColumns;
  const visiblePropertyFilters = showAllPropertyFilters
    ? filterableProperties
    : filterableProperties.slice(0, propertyGridColumns);

  useEffect(() => {
    if (!shouldCollapsePropertyFilters) {
      setShowAllPropertyFilters(false);
    }
  }, [shouldCollapsePropertyFilters]);

  return (
    <Card padding="sm">
      <div className="space-y-2">
        {/* Main filter row */}
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search bar */}
          <div className="flex-1 min-w-[180px] max-w-md">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search factsheets..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-8 pl-9 pr-3 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Type filter */}
          <div className="w-32 sm:w-36 lg:w-40">
            <Select
              label="Type"
              className="h-8 text-sm"
              options={[
                { value: "", label: "All Types" },
                ...factsheetTypes
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((type) => ({
                    value: type.id,
                    label: type.name,
                  })),
              ]}
              value={typeFilter}
              onChange={(e) => onTypeChange(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div className="w-32 sm:w-36 lg:w-40">
            <Select
              label="Status"
              className="h-8 text-sm"
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
            />
          </div>

          {/* Property filters - shown if 3 or fewer */}
          {filterableProperties.length <= 3 &&
            filterableProperties.map((prop) => {
              const opts = optionsByProperty.get(prop.id) || [];
              return (
                <div key={prop.id} className="w-32 sm:w-36 lg:w-40">
                  <Select
                    label={prop.name}
                    className="h-8 text-sm"
                    options={[
                      { value: "", label: `All ${prop.name}` },
                      ...opts.map((opt) => ({
                        value: opt.value,
                        label: opt.value,
                      })),
                    ]}
                    value={propertyFilters[prop.id] || ""}
                    onChange={(e) =>
                      onPropertyFilterChange(prop.id, e.target.value)
                    }
                  />
                </div>
              );
            })}

          {/* Clear filters button */}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear Filters
            </Button>
          )}

          {/* Count display */}
          {showPropertyCount && (
            <div className="ml-auto flex items-center">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {filteredCount} of {totalCount}
              </span>
            </div>
          )}
        </div>

        {/* Property filters in grid if more than 3 */}
        {filterableProperties.length > 3 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
              {visiblePropertyFilters.map((prop) => {
                const opts = optionsByProperty.get(prop.id) || [];
                return (
                  <div key={prop.id}>
                    <Select
                      label={prop.name}
                      className="h-8 text-sm"
                      options={[
                        { value: "", label: `All ${prop.name}` },
                        ...opts.map((opt) => ({
                          value: opt.value,
                          label: opt.value,
                        })),
                      ]}
                      value={propertyFilters[prop.id] || ""}
                      onChange={(e) =>
                        onPropertyFilterChange(prop.id, e.target.value)
                      }
                    />
                  </div>
                );
              })}
            </div>
            {shouldCollapsePropertyFilters && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPropertyFilters((prev) => !prev)}
                >
                  {showAllPropertyFilters
                    ? "Show fewer filters"
                    : "Show all filters"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Additional settings row (for display properties, etc.) */}
        {additionalSettings && (
          <div className="border-t border-gray-200 pt-2">
            {additionalSettings}
          </div>
        )}
      </div>
    </Card>
  );
}
