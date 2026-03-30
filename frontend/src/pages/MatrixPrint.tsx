import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "../components/ui";
import { PropertyMatrix } from "../components/visualizations";
import { useRealtime } from "../hooks/useRealtime";
import type {
  FactsheetExpanded,
  PropertyDefinition,
  FactsheetPropertyExpanded,
  FactsheetType,
  PropertyOption,
} from "../types";

interface MatrixPrintQueryState {
  search: string;
  xAxis: string;
  yAxis: string;
  typeFilter: string;
  statusFilter: string;
  propertyFilters: Record<string, string>;
  displayProperties: string[];
}

function parseJsonParam<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function MatrixPrint() {
  const location = useLocation();

  const queryState = useMemo<MatrixPrintQueryState>(() => {
    const params = new URLSearchParams(location.search);

    return {
      search: params.get("search") ?? "",
      xAxis: params.get("xAxis") ?? "",
      yAxis: params.get("yAxis") ?? "",
      typeFilter: params.get("typeFilter") ?? "",
      statusFilter: params.get("statusFilter") ?? "",
      propertyFilters: parseJsonParam<Record<string, string>>(
        params.get("propertyFilters"),
        {},
      ),
      displayProperties: parseJsonParam<string[]>(
        params.get("displayProperties"),
        [],
      ),
    };
  }, [location.search]);

  const { records: factsheets, loading: loadingFactsheets } =
    useRealtime<FactsheetExpanded>({
      collection: "factsheets",
      expand: "type",
    });

  const { records: propertyDefinitions, loading: loadingDefs } =
    useRealtime<PropertyDefinition>({
      collection: "property_definitions",
      sort: "order",
    });

  const { records: properties, loading: loadingProps } =
    useRealtime<FactsheetPropertyExpanded>({
      collection: "factsheet_properties",
      expand: "property,option",
    });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: "factsheet_types",
    sort: "order",
  });

  const { records: propertyOptions } = useRealtime<PropertyOption>({
    collection: "property_options",
    sort: "order",
  });

  const propertyLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, string>>();
    properties.forEach((fp) => {
      if (!lookup.has(fp.factsheet)) {
        lookup.set(fp.factsheet, new Map());
      }
      const optionValue = fp.expand?.option?.value || "";
      if (optionValue) {
        lookup.get(fp.factsheet)?.set(fp.property, optionValue);
      }
    });
    return lookup;
  }, [properties]);

  const filteredFactsheets = useMemo(() => {
    return factsheets.filter((fs) => {
      const matchesSearch =
        queryState.search === "" ||
        fs.name.toLowerCase().includes(queryState.search.toLowerCase()) ||
        fs.description?.toLowerCase().includes(queryState.search.toLowerCase());
      const matchesType =
        queryState.typeFilter === "" || fs.type === queryState.typeFilter;
      const matchesStatus =
        queryState.statusFilter === "" ||
        (fs.status_id || fs.status) === queryState.statusFilter;
      const matchesProperties = Object.entries(
        queryState.propertyFilters,
      ).every(([propId, value]) => {
        if (value === "") return true;
        const fsProps = propertyLookup.get(fs.id);
        return fsProps?.get(propId) === value;
      });

      return matchesSearch && matchesType && matchesStatus && matchesProperties;
    });
  }, [factsheets, propertyLookup, queryState]);

  const loading = loadingFactsheets || loadingDefs || loadingProps;
  const xAxisLabel =
    propertyDefinitions.find((p) => p.id === queryState.xAxis)?.name ||
    queryState.xAxis;
  const yAxisLabel =
    propertyDefinitions.find((p) => p.id === queryState.yAxis)?.name ||
    queryState.yAxis;
  const activeFilterCount =
    (queryState.search ? 1 : 0) +
    (queryState.typeFilter ? 1 : 0) +
    (queryState.statusFilter ? 1 : 0) +
    Object.values(queryState.propertyFilters).filter(Boolean).length;

  return (
    <>
      <style media="print">{`
        @page {
          size: A3 landscape;
          margin: 10mm;
        }
      `}</style>

      <div className="min-h-screen p-6 bg-gray-50 flex flex-col gap-6 print-page-root matrix-print-root">
        <div className="print-controls flex gap-2 self-start">
          <Link to={`/matrix${location.search}`}>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </Link>
          <Button
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>

        <div className="matrix-print-sheet bg-white border border-gray-300 p-6 print:border-0 print:p-0 print:bg-white">
          <div className="matrix-print-header flex items-start justify-between gap-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary-900">
                Matrix View
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Printable A3 landscape matrix of the current filtered view
              </p>
            </div>
            <div className="text-right text-sm text-gray-600 shrink-0">
              <p>
                Factsheets:{" "}
                <span className="font-semibold text-primary-900">
                  {filteredFactsheets.length}
                </span>
              </p>
              <p>
                Active filters:{" "}
                <span className="font-semibold text-primary-900">
                  {activeFilterCount}
                </span>
              </p>
            </div>
          </div>

          <div className="matrix-print-meta grid grid-cols-4 gap-3 mb-5 text-sm">
            <div className="border border-gray-300 px-3 py-2 bg-gray-50">
              <span className="block text-xs uppercase tracking-wide text-gray-500">
                X Axis
              </span>
              <span className="font-semibold text-primary-900">
                {xAxisLabel || "Not selected"}
              </span>
            </div>
            <div className="border border-gray-300 px-3 py-2 bg-gray-50">
              <span className="block text-xs uppercase tracking-wide text-gray-500">
                Y Axis
              </span>
              <span className="font-semibold text-primary-900">
                {yAxisLabel || "Not selected"}
              </span>
            </div>
            <div className="border border-gray-300 px-3 py-2 bg-gray-50">
              <span className="block text-xs uppercase tracking-wide text-gray-500">
                Search
              </span>
              <span className="font-semibold text-primary-900 break-words">
                {queryState.search || "None"}
              </span>
            </div>
            <div className="border border-gray-300 px-3 py-2 bg-gray-50">
              <span className="block text-xs uppercase tracking-wide text-gray-500">
                Cards show
              </span>
              <span className="font-semibold text-primary-900">
                {queryState.displayProperties.length || 0} properties
              </span>
            </div>
          </div>

          {queryState.xAxis &&
            queryState.yAxis &&
            factsheetTypes.length > 0 && (
              <div className="mb-5 border border-gray-200 px-4 py-3">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <div className="font-semibold text-primary-900 uppercase tracking-wide">
                    Types
                  </div>
                  {factsheetTypes.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 border border-gray-300"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-gray-700">{type.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {loading ? (
            <div className="h-[520px] flex items-center justify-center border border-gray-200 bg-gray-50 text-gray-500">
              Loading matrix...
            </div>
          ) : propertyDefinitions.length === 0 ? (
            <div className="h-[520px] flex items-center justify-center border border-gray-200 bg-gray-50 text-gray-500">
              No properties configured
            </div>
          ) : !queryState.xAxis || !queryState.yAxis ? (
            <div className="h-[520px] flex items-center justify-center border border-gray-200 bg-gray-50 text-gray-500">
              Select both axes in Matrix View before printing
            </div>
          ) : filteredFactsheets.length === 0 ? (
            <div className="h-[520px] flex items-center justify-center border border-gray-200 bg-gray-50 text-gray-500">
              No factsheets match the current matrix filters
            </div>
          ) : (
            <PropertyMatrix
              factsheets={filteredFactsheets}
              properties={properties}
              propertyDefinitions={propertyDefinitions}
              propertyOptions={propertyOptions}
              xAxisProperty={queryState.xAxis}
              yAxisProperty={queryState.yAxis}
              displayProperties={queryState.displayProperties}
              factsheetPropertyValues={propertyLookup}
              printable
            />
          )}
        </div>
      </div>
    </>
  );
}
