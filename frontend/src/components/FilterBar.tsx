import { Search } from "lucide-react";
import { Card, Select, Button } from "./ui";
import type {
  PropertyDefinition,
  PropertyOption,
  FactsheetType,
} from "../types";
import { useMemo } from "react";

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

  // Filter out excluded properties
  const filterableProperties = propertyDefinitions.filter(
    (p) => !excludePropertyIds.includes(p.id),
  );

  return (
    <Card padding="sm">
      <div className="space-y-4">
        {/* Main filter row */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search bar */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search factsheets..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Type filter */}
          <div className="w-40">
            <Select
              label="Type"
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
          <div className="w-40">
            <Select
              label="Status"
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
              <span className="text-sm text-gray-500 whitespace-nowrap">
                {filteredCount} of {totalCount}
              </span>
            </div>
          )}
        </div>

        {/* Property filters in grid if more than 3 */}
        {filterableProperties.length > 3 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filterableProperties.map((prop) => {
              const opts = optionsByProperty.get(prop.id) || [];
              return (
                <div key={prop.id}>
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
                      onPropertyFilterChange(prop.id, e.target.value)
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Additional settings row (for display properties, etc.) */}
        {additionalSettings && (
          <div className="border-t border-gray-200 pt-4">
            {additionalSettings}
          </div>
        )}
      </div>
    </Card>
  );
}
