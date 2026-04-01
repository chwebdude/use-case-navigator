import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toPng } from "html-to-image";
import { Badge, Button, MetricBadge } from "../components/ui";
import { DependencyGraph, SpiderDiagram } from "../components/visualizations";
import type { SpiderDataPoint } from "../components/visualizations/SpiderDiagram";
import { useAppSettings } from "../hooks/useAppSettings";
import { useRecord, useRealtime } from "../hooks/useRealtime";
import pb from "../lib/pocketbase";
import { getStatusMeta, getStatusTextColor } from "../lib/statusConfig";
import type {
  Dependency,
  Factsheet,
  FactsheetExpanded,
  FactsheetPropertyExpanded,
  FactsheetType,
  HiddenField,
  MetricExpanded,
} from "../types";

export default function FactsheetFullPrint() {
  const { id } = useParams();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [allDependencies, setAllDependencies] = useState<Dependency[]>([]);
  const [relatedFactsheets, setRelatedFactsheets] = useState<
    FactsheetExpanded[]
  >([]);
  const { settings: appSettings } = useAppSettings();

  const { record: factsheet, loading } = useRecord<Factsheet>("factsheets", id);
  const { record: factsheetType } = useRecord<FactsheetType>(
    "factsheet_types",
    factsheet?.type,
  );
  const { records: properties, loading: loadingProperties } =
    useRealtime<FactsheetPropertyExpanded>({
      collection: "factsheet_properties",
      filter: `factsheet = "${id}"`,
      expand: "property,option",
    });
  const { records: metrics, loading: loadingMetrics } =
    useRealtime<MetricExpanded>({
      collection: "metrics",
      sort: "order",
      expand: "properties",
    });

  useEffect(() => {
    if (!id) {
      setAllDependencies([]);
      setRelatedFactsheets([]);
      return;
    }

    pb.collection("dependencies")
      .getFullList<Dependency>()
      .then((deps) => {
        const downstream = new Map<string, string[]>();
        const upstream = new Map<string, string[]>();

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

        const related = new Set<string>();
        related.add(id);

        const traverseDownstream = (factsheetId: string) => {
          const children = downstream.get(factsheetId) || [];
          for (const childId of children) {
            if (!related.has(childId)) {
              related.add(childId);
              traverseDownstream(childId);
            }
          }
        };

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

        const relevantDeps = deps.filter(
          (dep) => related.has(dep.factsheet) && related.has(dep.depends_on),
        );
        setAllDependencies(relevantDeps);

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
        setAllDependencies([]);
        setRelatedFactsheets([]);
      });
  }, [id]);

  const propertyMap = useMemo(() => {
    const map = new Map<string, FactsheetPropertyExpanded>();
    properties.forEach((fp) => {
      map.set(fp.property, fp);
    });
    return map;
  }, [properties]);

  const computeMetricScore = (metric: MetricExpanded) => {
    const props = metric.properties?.length
      ? metric.properties
      : (metric.expand?.properties?.map((p) => p.id) ?? []);
    if (props.length === 0) return null;

    let sum = 0;
    let count = 0;
    props.forEach((pid) => {
      const fp = propertyMap.get(pid);
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

  const typeColor = factsheetType?.color || "#6b7280";
  const statusId = factsheet?.status_id || factsheet?.status || "";
  const statusMeta = getStatusMeta(
    statusId,
    appSettings.statuses,
    factsheetType ?? undefined,
  );

  const hiddenFields = useMemo(() => {
    return new Set<HiddenField>(factsheetType?.hidden_fields ?? []);
  }, [factsheetType?.hidden_fields]);

  const spiderData: SpiderDataPoint[] = useMemo(() => {
    if (!factsheet || metrics.length < 3) return [];

    const values = metrics
      .map((metric) => {
        const score = computeMetricScore(metric);
        return {
          metric: metric.name,
          value: score ?? 0,
        };
      })
      .filter(
        (value) =>
          value.value > 0 ||
          metrics.every((metric) => computeMetricScore(metric) !== null),
      );

    if (values.length < 3) return [];

    return [
      {
        id: factsheet.id,
        name: factsheet.name,
        color: typeColor,
        values,
      },
    ];
  }, [factsheet, metrics, propertyMap, typeColor]);

  const metricNames = useMemo(
    () => metrics.map((metric) => metric.name),
    [metrics],
  );
  const loadingAll = loading || loadingProperties || loadingMetrics;

  const handleExportPng = async () => {
    if (!sheetRef.current || exporting) {
      return;
    }

    setExporting(true);

    try {
      const dataUrl = await toPng(sheetRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        canvasWidth: sheetRef.current.scrollWidth,
        canvasHeight: sheetRef.current.scrollHeight,
      });

      const link = document.createElement("a");
      const nameSlug = (factsheet?.name || "factsheet")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      link.download = `${nameSlug}-full-details.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Failed to export full factsheet print as PNG", error);
    } finally {
      setExporting(false);
    }
  };

  if (loadingAll) {
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
    <>
      <style media="print">{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
      `}</style>

      <div className="min-h-screen p-6 bg-gray-50 flex flex-col gap-6 print-page-root">
        <div className="print-controls flex gap-2 self-start">
          <Link to={`/factsheets/${id}`}>
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
          <Button
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportPng}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export PNG"}
          </Button>
        </div>

        <div
          ref={sheetRef}
          className="w-full max-w-5xl bg-white border border-gray-300 p-8 space-y-8 print:max-w-none print:border-0 print:p-0"
        >
          <div className="h-3 w-full" style={{ backgroundColor: typeColor }} />

          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {factsheetType && (
                <span
                  className="px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: typeColor }}
                >
                  {factsheetType.name}
                </span>
              )}
              <Badge
                className="rounded-full"
                style={{
                  backgroundColor: statusMeta.color,
                  color: getStatusTextColor(statusMeta.color),
                }}
              >
                {statusMeta.label}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-primary-900 break-words">
              {factsheet.name}
            </h1>
          </header>

          {!hiddenFields.has("description") && (
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                Description
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                {factsheet.description || "No description provided"}
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!hiddenFields.has("responsibility") &&
              factsheet.responsibility && (
                <section className="space-y-2 break-inside-avoid">
                  <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                    Responsibility
                  </h2>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                    {factsheet.responsibility}
                  </p>
                </section>
              )}

            {!hiddenFields.has("what_it_does") && factsheet.what_it_does && (
              <section className="space-y-2 break-inside-avoid">
                <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                  What It Does
                </h2>
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.what_it_does }}
                />
              </section>
            )}

            {!hiddenFields.has("benefits") && factsheet.benefits && (
              <section className="space-y-2 break-inside-avoid">
                <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                  Benefits
                </h2>
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.benefits }}
                />
              </section>
            )}

            {!hiddenFields.has("problems_addressed") &&
              factsheet.problems_addressed && (
                <section className="space-y-2 break-inside-avoid">
                  <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                    Problems Addressed
                  </h2>
                  <div
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: factsheet.problems_addressed,
                    }}
                  />
                </section>
              )}

            {!hiddenFields.has("potential_ui") && factsheet.potential_ui && (
              <section className="space-y-2 break-inside-avoid md:col-span-2">
                <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
                  Potential User Interface
                </h2>
                <div
                  className="text-sm text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.potential_ui }}
                />
              </section>
            )}
          </div>

          <section className="space-y-3 break-inside-avoid">
            <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
              Dependency Graph
            </h2>
            {relatedFactsheets.length > 1 ? (
              <div className="h-[520px] border border-gray-200 overflow-hidden print:break-inside-avoid">
                <DependencyGraph
                  factsheets={relatedFactsheets}
                  dependencies={allDependencies}
                  showComments={false}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No dependency graph available
              </p>
            )}
          </section>

          <section className="space-y-3 break-inside-avoid">
            <h2 className="text-base font-semibold text-primary-900 uppercase tracking-wide">
              Metrics
            </h2>
            {spiderData.length > 0 && metricNames.length >= 3 ? (
              <div className="flex justify-center">
                <SpiderDiagram
                  data={spiderData}
                  metrics={metricNames}
                  maxValue={10}
                  size={420}
                  showLabels
                  showLegend={false}
                  interactive={false}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Not enough metric data for chart
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map((metric) => {
                const score = computeMetricScore(metric);
                return score !== null ? (
                  <MetricBadge
                    key={metric.id}
                    name={metric.name}
                    score={score}
                    variant="detailed"
                  />
                ) : null;
              })}
            </div>
          </section>

          <section className="pt-2 border-t border-gray-200 text-sm text-gray-500 flex flex-wrap gap-x-8 gap-y-2">
            <p>
              <span className="font-medium">Created:</span>{" "}
              {new Date(factsheet.created).toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium">Updated:</span>{" "}
              {new Date(factsheet.updated).toLocaleDateString()}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
