import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "../components/ui";
import { useRecord } from "../hooks/useRealtime";
import type { Factsheet, FactsheetType } from "../types";

export default function FactsheetPrint() {
  const { id } = useParams();

  const { record: factsheet, loading } = useRecord<Factsheet>("factsheets", id);
  const { record: factsheetType } = useRecord<FactsheetType>(
    "factsheet_types",
    factsheet?.type,
  );

  const typeColor = factsheetType?.color || "#6b7280";

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

      <div className="factsheet-print-card bg-white border border-gray-300 flex flex-col">
        <div
          className="factsheet-print-color-bar h-3 w-full"
          style={{ backgroundColor: typeColor }}
        />
        <div className="flex-1 p-5 flex flex-col justify-center gap-3 text-center">
          {factsheetType && (
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wide break-words">
              {factsheetType.name}
            </p>
          )}
          <h1 className="text-5xl font-bold leading-tight text-primary-900 break-words w-full">
            {factsheet.name}
          </h1>
          <p className="factsheet-print-description text-sm text-gray-700 whitespace-pre-wrap break-words w-full">
            {factsheet.description || "No description provided"}
          </p>
        </div>
      </div>
    </div>
  );
}
