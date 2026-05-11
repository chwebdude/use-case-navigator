import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Card, Select, Button, MultiSelect } from "./ui";
import type {
  PropertyDefinition,
  PropertyOption,
  FactsheetType,
} from "../types";
import { useEffect, useMemo, useState } from "react";
import { useAppSettings } from "../hooks/useAppSettings";
import { getStatusesForType } from "../lib/statusConfig";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;

  statusFilter: string;
  onStatusChange: (value: string) => void;

  typeFilter: string[];
  onTypeChange: (values: string[]) => void;

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
  const {
    settings: { statuses: globalStatuses },
  } = useAppSettings();

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

  const statusOptions = useMemo(() => {
    if (typeFilter.length > 0) {
      // If specific types are selected, show statuses for those types
      const seen = new Set<string>();
      const combined = typeFilter
        .map((typeId) => factsheetTypes.find((type) => type.id === typeId))
        .filter((type): type is FactsheetType => type !== undefined)
        .flatMap((type) => getStatusesForType(globalStatuses, type))
        .filter((status) => {
          if (seen.has(status.id)) return false;
          seen.add(status.id);
          return true;
        });

      return [
        { value: "", label: "All Statuses" },
        ...combined.map((status) => ({
          value: status.id,
          label: status.label,
        })),
      ];
    }

    // If no types selected, show all available statuses
    const seen = new Set<string>();
    const combined = [
      ...getStatusesForType(globalStatuses),
      ...factsheetTypes.flatMap((type) =>
        getStatusesForType(globalStatuses, type),
      ),
    ].filter((status) => {
      if (seen.has(status.id)) return false;
      seen.add(status.id);
      return true;
    });

    return [
      { value: "", label: "All Statuses" },
      ...combined.map((status) => ({ value: status.id, label: status.label })),
    ];
  }, [factsheetTypes, globalStatuses, typeFilter]);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter out excluded properties
  const filterableProperties = propertyDefinitions.filter(
    (p) => !excludePropertyIds.includes(p.id),
  );

  const visiblePropertyFilters = filterableProperties;
  const hasAdvancedFilters =
    filterableProperties.length > 0 || Boolean(additionalSettings);
  const activePropertyFilterCount = Object.values(propertyFilters).filter(
    (value) => value !== "",
  ).length;

  useEffect(() => {
    if (activePropertyFilterCount > 0) {
      setShowAdvancedFilters(true);
    }
  }, [activePropertyFilterCount]);

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
            <MultiSelect
              label="Type"
              className="h-8"
              placeholder="All Types"
              options={factsheetTypes
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              values={typeFilter}
              onChange={onTypeChange}
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

          {/* Advanced filters toggle */}
          {hasAdvancedFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              icon={<SlidersHorizontal className="w-4 h-4" />}
            >
              {showAdvancedFilters ? "Hide advanced" : "More filters"}
              {activePropertyFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-500 text-white rounded-full">
                  {activePropertyFilterCount}
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 ml-1 transition-transform ${
                  showAdvancedFilters ? "rotate-180" : "rotate-0"
                }`}
              />
            </Button>
          )}

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

        {/* Advanced filters */}
        {showAdvancedFilters && hasAdvancedFilters && (
          <div className="space-y-2">
            {filterableProperties.length > 0 && (
              <>
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
              </>
            )}

            {/* Additional settings row (for display properties, etc.) */}
            {additionalSettings && (
              <div className="border-t border-gray-200 pt-2">
                {additionalSettings}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
