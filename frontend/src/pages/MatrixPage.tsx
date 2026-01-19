import { useState, useMemo, useRef, useEffect } from 'react';
import { Eye, ChevronDown, Check } from 'lucide-react';
import { Card, CardTitle, Select, Button } from '../components/ui';
import { PropertyMatrix } from '../components/visualizations';
import FactsheetDetailModal from '../components/FactsheetDetailModal';
import { useRealtime } from '../hooks/useRealtime';
import type { FactsheetExpanded, PropertyDefinition, FactsheetPropertyExpanded, FactsheetType, PropertyOption } from '../types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function MatrixPage() {
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(null);

  // Filter state
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilters, setPropertyFilters] = useState<Record<string, string>>({});

  // Display properties state
  const [displayProperties, setDisplayProperties] = useState<string[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { records: factsheets, loading: loadingFactsheets } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    expand: 'type',
  });

  const { records: propertyDefinitions, loading: loadingDefs } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const { records: properties, loading: loadingProps } = useRealtime<FactsheetPropertyExpanded>({
    collection: 'factsheet_properties',
    expand: 'property,option',
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const { records: propertyOptions } = useRealtime<PropertyOption>({
    collection: 'property_options',
    sort: 'order',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPropertyDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFactsheetClick = (factsheetId: string) => {
    setSelectedFactsheetId(factsheetId);
  };

  const togglePropertyDisplay = (propId: string) => {
    setDisplayProperties((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
    );
  };

  const clearAllFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setPropertyFilters({});
  };

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
    properties.forEach((fp) => {
      if (!lookup.has(fp.factsheet)) {
        lookup.set(fp.factsheet, new Map());
      }
      const optionValue = fp.expand?.option?.value || '';
      if (optionValue) {
        lookup.get(fp.factsheet)!.set(fp.property, optionValue);
      }
    });
    return lookup;
  }, [properties]);

  // Filter factsheets
  const filteredFactsheets = useMemo(() => {
    return factsheets.filter((fs) => {
      const matchesType = typeFilter === '' || fs.type === typeFilter;
      const matchesStatus = statusFilter === '' || fs.status === statusFilter;

      // Check property filters
      const matchesProperties = Object.entries(propertyFilters).every(([propId, value]) => {
        if (value === '') return true;
        const fsProps = propertyLookup.get(fs.id);
        return fsProps?.get(propId) === value;
      });

      return matchesType && matchesStatus && matchesProperties;
    });
  }, [factsheets, typeFilter, statusFilter, propertyFilters, propertyLookup]);

  const loading = loadingFactsheets || loadingDefs || loadingProps;

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...factsheetTypes.map((t) => ({ value: t.id, label: t.name })),
  ];

  // All properties for axis selection
  const axisOptions = propertyDefinitions.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const hasFilters = typeFilter !== '' || statusFilter !== '' || Object.values(propertyFilters).some((v) => v !== '');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Matrix View</h1>
        <p className="text-gray-500 mt-1">
          Plot factsheets on a matrix based on their properties
        </p>
      </div>

      {/* Axis selectors */}
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

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-4 items-end">
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
          {propertyDefinitions
            .filter((prop) => prop.id !== xAxis && prop.id !== yAxis)
            .map((prop) => {
              const opts = optionsByProperty.get(prop.id) || [];
              return (
                <div key={prop.id} className="w-40">
                  <Select
                    label={prop.name}
                    options={[
                      { value: '', label: `All ${prop.name}` },
                      ...opts.map((opt) => ({ value: opt.value, label: opt.value })),
                    ]}
                    value={propertyFilters[prop.id] || ''}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {filteredFactsheets.length} of {factsheets.length} factsheets
            </span>

            {/* Property display dropdown */}
            {propertyDefinitions.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Eye className="w-4 h-4" />}
                  onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                >
                  Show Properties
                  {displayProperties.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent-500 text-white rounded-full">
                      {displayProperties.length}
                    </span>
                  )}
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>

                {showPropertyDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg z-50 min-w-[200px]">
                    <div className="p-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase">Display on cards</span>
                    </div>
                    {propertyDefinitions.map((prop) => (
                      <button
                        key={prop.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => togglePropertyDisplay(prop.id)}
                      >
                        <div className={`w-4 h-4 border flex items-center justify-center ${
                          displayProperties.includes(prop.id)
                            ? 'bg-accent-500 border-accent-500'
                            : 'border-gray-300'
                        }`}>
                          {displayProperties.includes(prop.id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        {prop.name}
                      </button>
                    ))}
                    {displayProperties.length > 0 && (
                      <div className="p-2 border-t border-gray-100">
                        <button
                          className="text-xs text-gray-500 hover:text-gray-700"
                          onClick={() => setDisplayProperties([])}
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Legend */}
      {xAxis && yAxis && factsheetTypes.length > 0 && (
        <Card padding="sm">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 mr-4">
              <span className="font-medium text-primary-900">Types:</span>
            </div>
            {factsheetTypes.map((type) => (
              <div key={type.id} className="flex items-center gap-2">
                <div
                  className="w-4 h-4"
                  style={{ backgroundColor: type.color }}
                />
                <span>{type.name}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Matrix */}
      {loading ? (
        <Card className="h-[600px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading matrix...</div>
        </Card>
      ) : propertyDefinitions.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>No properties configured</CardTitle>
          <p className="text-gray-500 mt-2">
            Configure property definitions in settings to use the matrix view
          </p>
        </Card>
      ) : !xAxis || !yAxis ? (
        <Card className="text-center py-16">
          <CardTitle>Select axes</CardTitle>
          <p className="text-gray-500 mt-2">
            Choose properties for the X and Y axes to view the matrix
          </p>
        </Card>
      ) : filteredFactsheets.length === 0 ? (
        <Card className="text-center py-16">
          <CardTitle>
            {hasFilters ? 'No matching factsheets' : 'No factsheets yet'}
          </CardTitle>
          <p className="text-gray-500 mt-2">
            {hasFilters
              ? 'Try adjusting your filters to see more factsheets'
              : 'Create some factsheets to see the matrix'}
          </p>
          {hasFilters && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={clearAllFilters}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <PropertyMatrix
          factsheets={filteredFactsheets}
          properties={properties}
          propertyDefinitions={propertyDefinitions}
          propertyOptions={propertyOptions}
          xAxisProperty={xAxis}
          yAxisProperty={yAxis}
          onFactsheetClick={handleFactsheetClick}
          displayProperties={displayProperties}
          factsheetPropertyValues={propertyLookup}
        />
      )}

      {/* Factsheet Detail Modal */}
      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
