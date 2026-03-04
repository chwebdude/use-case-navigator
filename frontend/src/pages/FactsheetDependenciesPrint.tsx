import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "../components/ui";
import { useRecord, useRealtime } from "../hooks/useRealtime";
import type { Factsheet, DependencyExpanded } from "../types";

export default function FactsheetDependenciesPrint() {
  const { id } = useParams();

  const { record: factsheet, loading } = useRecord<Factsheet>("factsheets", id);
  const { records: dependencies } = useRealtime<DependencyExpanded>({
    collection: "dependencies",
    filter: `factsheet = "${id}"`,
    expand: "depends_on,depends_on.type",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="factsheet-print-card animate-pulse bg-white border border-gray-300" />
      </div>
    );
  }

  if (!factsheet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="print-controls flex flex-col items-center gap-4">
          <p className="text-primary-900 font-medium">Factsheet not found</p>
          <Link to="/factsheets">
            <Button
              variant="secondary"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 flex flex-col items-center gap-6 print-page-root">
      <div className="print-controls flex gap-2 self-start">
        <Link to={`/factsheets/${id}`}>
          <Button variant="secondary" icon={<ArrowLeft className="w-4 h-4" />}>
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

      <div className="w-full max-w-4xl space-y-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary-900 mb-1">
            {factsheet.name}
          </h1>
          <p className="text-sm text-gray-600">
            Dependencies ({dependencies.length})
          </p>
        </div>

        {/* Dependencies Cards */}
        {dependencies.length === 0 ? (
          <div className="factsheet-print-card bg-white border border-gray-300 flex items-center justify-center">
            <p className="text-gray-500 text-center">No dependencies</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dependencies.map((dep) => {
              const depTypeColor =
                dep.expand?.depends_on?.expand?.type?.color || "#6b7280";
              const depFactsheet = dep.expand?.depends_on;
              return (
                <div
                  key={dep.id}
                  className="factsheet-print-card bg-white border border-gray-300 flex flex-col"
                >
                  <div
                    className="factsheet-print-color-bar h-3 w-full"
                    style={{ backgroundColor: depTypeColor }}
                  />
                  <div className="flex-1 p-5 flex flex-col justify-center gap-3 text-left">
                    {depFactsheet?.expand?.type && (
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-wide break-words">
                        {depFactsheet.expand.type.name}
                      </p>
                    )}
                    <h2 className="text-3xl font-bold leading-tight text-primary-900 break-words">
                      {depFactsheet?.name || "Unknown Factsheet"}
                    </h2>
                    <p className="factsheet-print-description text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {depFactsheet?.description || "No description provided"}
                    </p>
                    {dep.description && (
                      <p className="text-xs text-gray-500 italic border-t pt-2 mt-2">
                        Dependency note: {dep.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
