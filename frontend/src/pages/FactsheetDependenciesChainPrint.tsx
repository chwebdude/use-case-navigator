import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "../components/ui";
import { useRecord } from "../hooks/useRealtime";
import pb from "../lib/pocketbase";
import type { Dependency, FactsheetExpanded } from "../types";

export default function FactsheetDependenciesChainPrint() {
  const { id } = useParams();

  const { record: factsheet, loading } = useRecord<FactsheetExpanded>(
    "factsheets",
    id,
    "type",
  );

  const [relatedFactsheets, setRelatedFactsheets] = useState<
    FactsheetExpanded[]
  >([]);
  const [chainLoading, setChainLoading] = useState(true);

  // Fetch the full dependency chain
  useEffect(() => {
    if (!id) {
      setRelatedFactsheets([]);
      setChainLoading(false);
      return;
    }

    setChainLoading(true);

    // Fetch all dependencies to traverse the full chain
    pb.collection("dependencies")
      .getFullList<Dependency>()
      .then((deps) => {
        // Build adjacency lists for traversal
        const downstream = new Map<string, string[]>(); // factsheet -> what it depends on
        const upstream = new Map<string, string[]>(); // factsheet -> what depends on it

        deps.forEach((dep) => {
          if (!downstream.has(dep.factsheet)) {
            downstream.set(dep.factsheet, []);
          }
          downstream.get(dep.factsheet)!.push(dep.depends_on);

          if (!upstream.has(dep.depends_on)) {
            upstream.set(dep.depends_on, []);
          }
          upstream.get(dep.depends_on)!.push(dep.factsheet);
        });

        // Find all related factsheet IDs (full chain)
        const related = new Set<string>();
        related.add(id);

        // Traverse downstream (what the focused factsheet depends on, recursively)
        const traverseDownstream = (factsheetId: string) => {
          const children = downstream.get(factsheetId) || [];
          for (const childId of children) {
            if (!related.has(childId)) {
              related.add(childId);
              traverseDownstream(childId);
            }
          }
        };

        // Traverse upstream (what depends on the focused factsheet, recursively)
        const traverseUpstream = (factsheetId: string) => {
          const parents = upstream.get(factsheetId) || [];
          for (const parentId of parents) {
            if (!related.has(parentId)) {
              related.add(parentId);
              traverseUpstream(parentId);
            }
          }
        };

        traverseDownstream(id);
        traverseUpstream(id);

        // Fetch related factsheets with expand
        if (related.size > 0) {
          const filter = Array.from(related)
            .map((factsheetId) => `id = "${factsheetId}"`)
            .join(" || ");
          pb.collection("factsheets")
            .getFullList<FactsheetExpanded>({ filter, expand: "type" })
            .then(setRelatedFactsheets)
            .catch(() => setRelatedFactsheets([]));
        } else {
          setRelatedFactsheets([]);
        }
      })
      .catch(() => {
        setRelatedFactsheets([]);
      })
      .finally(() => setChainLoading(false));
  }, [id]);

  if (loading || chainLoading) {
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

  // Sort factsheets: main factsheet first, then others
  const sortedFactsheets = [
    factsheet,
    ...relatedFactsheets.filter((fs) => fs.id !== id),
  ];

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
            Full Dependency Chain ({sortedFactsheets.length} factsheets)
          </p>
        </div>

        {/* All Factsheets Cards */}
        <div className="space-y-4">
          {sortedFactsheets.map((fs) => {
            const fsTypeColor = fs.expand?.type?.color || "#6b7280";

            return (
              <div
                key={fs.id}
                className="factsheet-print-card bg-white border border-gray-300 flex flex-col"
              >
                <div
                  className="factsheet-print-color-bar h-3 w-full"
                  style={{ backgroundColor: fsTypeColor }}
                />
                <div className="flex-1 p-5 flex flex-col justify-center gap-3 text-left">
                  {fs.expand?.type && (
                    <p className="text-sm font-medium text-gray-600 uppercase tracking-wide break-words">
                      {fs.expand.type.name}
                    </p>
                  )}
                  <h2 className="text-3xl font-bold leading-tight text-primary-900 break-words">
                    {fs.name}
                  </h2>
                  <p className="factsheet-print-description text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {fs.description || "No description provided"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
