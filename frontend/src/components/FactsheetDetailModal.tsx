import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Edit,
  ExternalLink,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Modal, Button, Badge, MetricBadge } from "./ui";
import { DependencyGraph, SpiderDiagram } from "./visualizations";
import type { SpiderDataPoint } from "./visualizations/SpiderDiagram";
import { useRecord, useRealtime } from "../hooks/useRealtime";
import { useAppSettings } from "../hooks/useAppSettings";
import { useChangeLog } from "../hooks/useChangeLog";
import pb from "../lib/pocketbase";
import {
  getStatusMeta,
  getStatusTextColor,
  getStatusesForType,
} from "../lib/statusConfig";
import type {
  Factsheet,
  FactsheetType,
  FactsheetPropertyExpanded,
  ChangeLogExpanded,
  FactsheetExpanded,
  Dependency,
  MetricExpanded,
} from "../types";

interface FactsheetDetailModalProps {
  factsheetId: string | null;
  onClose: () => void;
}

export default function FactsheetDetailModal({
  factsheetId,
  onClose,
}: FactsheetDetailModalProps) {
  const [activeFactsheetId, setActiveFactsheetId] = useState<string | null>(
    factsheetId,
  );
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const { settings: appSettings } = useAppSettings();
  const { logChange } = useChangeLog();

  useEffect(() => {
    setActiveFactsheetId(factsheetId);
    setHistoryExpanded(false);
    setStatusDropdownOpen(false);
  }, [factsheetId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
    };
    if (statusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusDropdownOpen]);

  const { record: factsheet, loading } = useRecord<Factsheet>(
    "factsheets",
    activeFactsheetId || undefined,
  );
  const { record: factsheetType } = useRecord<FactsheetType>(
    "factsheet_types",
    factsheet?.type,
  );

  // Helper function to check if a field should be hidden
  const isFieldHidden = (fieldName: string): boolean => {
    return (factsheetType?.hidden_fields ?? []).includes(fieldName as any);
  };

  // Fetch all dependencies and related factsheets for the full dependency chain
  const [allDependencies, setAllDependencies] = useState<Dependency[]>([]);
  const [relatedFactsheets, setRelatedFactsheets] = useState<
    FactsheetExpanded[]
  >([]);

  useEffect(() => {
    if (!activeFactsheetId) {
      setAllDependencies([]);
      setRelatedFactsheets([]);
      return;
    }

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
        related.add(activeFactsheetId);

        // Traverse downstream (what the focused factsheet depends on, recursively)
        const traverseDownstream = (id: string) => {
          const children = downstream.get(id) || [];
          for (const childId of children) {
            if (!related.has(childId)) {
              related.add(childId);
              traverseDownstream(childId);
            }
          }
        };

        // Traverse upstream (what depends on the focused factsheet, recursively)
        const traverseUpstream = (id: string) => {
          const parents = upstream.get(id) || [];
          for (const parentId of parents) {
            if (!related.has(parentId)) {
              related.add(parentId);
              traverseUpstream(parentId);
            }
          }
        };

        traverseDownstream(activeFactsheetId);
        traverseUpstream(activeFactsheetId);

        // Filter dependencies to only include those between related factsheets
        const relevantDeps = deps.filter(
          (dep) => related.has(dep.factsheet) && related.has(dep.depends_on),
        );
        setAllDependencies(relevantDeps);

        // Fetch related factsheets
        if (related.size > 0) {
          const filter = Array.from(related)
            .map((id) => `id = "${id}"`)
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
  }, [activeFactsheetId]);

  // Count direct dependencies for the summary text
  const directOutgoingCount = allDependencies.filter(
    (d) => d.factsheet === activeFactsheetId,
  ).length;
  const directIncomingCount = allDependencies.filter(
    (d) => d.depends_on === activeFactsheetId,
  ).length;

  const { records: properties } = useRealtime<FactsheetPropertyExpanded>({
    collection: "factsheet_properties",
    filter: activeFactsheetId ? `factsheet = "${activeFactsheetId}"` : "",
    expand: "property,option",
  });

  const { records: changeLogs } = useRealtime<ChangeLogExpanded>({
    collection: "change_log",
    filter: activeFactsheetId ? `factsheet = "${activeFactsheetId}"` : "",
    sort: "-created",
    expand: "related_factsheet",
  });

  const { records: metrics } = useRealtime<MetricExpanded>({
    collection: "metrics",
    sort: "order",
    expand: "properties",
  });

  const typeColor = factsheetType?.color || "#6b7280";
  const statusId = factsheet?.status_id || factsheet?.status || "";
  const statusMeta = getStatusMeta(
    statusId,
    appSettings.statuses,
    factsheetType ?? undefined,
  );

  const availableStatuses = getStatusesForType(
    appSettings.statuses,
    factsheetType ?? undefined,
  );

  const LEGACY_STATUS_VALUES = new Set(["draft", "active", "archived"]);

  const handleStatusChange = async (newStatusId: string) => {
    if (!factsheet || !activeFactsheetId || newStatusId === statusId) {
      setStatusDropdownOpen(false);
      return;
    }
    const oldMeta = statusMeta;
    const newMeta = getStatusMeta(
      newStatusId,
      appSettings.statuses,
      factsheetType ?? undefined,
    );
    const legacyStatus = LEGACY_STATUS_VALUES.has(newStatusId)
      ? newStatusId
      : factsheet.status;
    try {
      await pb.collection("factsheets").update(activeFactsheetId, {
        status_id: newStatusId,
        status: legacyStatus,
      });
      await logChange({
        factsheetId: activeFactsheetId,
        action: "updated",
        description: `Status changed from "${oldMeta.label}" to "${newMeta.label}"`,
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
    setStatusDropdownOpen(false);
  };

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
      const w =
        typeof fp.expand?.option?.weight === "number"
          ? fp.expand.option.weight
          : 0;
      sum += w;
      count += 1;
    });
    if (count === 0) return null;
    return sum / count;
  };

  // Spider diagram data for this factsheet
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
        (v) =>
          v.value > 0 || metrics.every((m) => computeMetricScore(m) !== null),
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

  const metricNames = useMemo(() => metrics.map((m) => m.name), [metrics]);

  return (
    <Modal
      isOpen={activeFactsheetId !== null}
      onClose={() => {
        setActiveFactsheetId(null);
        onClose();
      }}
      title={loading ? "Loading..." : factsheet?.name || "Factsheet"}
      size="full"
    >
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 w-1/3"></div>
          <div className="h-4 bg-gray-200 w-2/3"></div>
          <div className="h-4 bg-gray-200 w-1/2"></div>
        </div>
      ) : factsheet ? (
        <div className="space-y-6">
          {/* Header info */}
          <div className="flex items-center gap-3 flex-wrap">
            {factsheetType && (
              <span
                className="px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: typeColor }}
              >
                {factsheetType.name}
              </span>
            )}
            <div className="relative" ref={statusDropdownRef}>
              <Badge
                className="rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: statusMeta.color,
                  color: getStatusTextColor(statusMeta.color),
                }}
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              >
                {statusMeta.label}
                <ChevronDown className="w-3 h-3 ml-1 inline" />
              </Badge>
              {statusDropdownOpen && (
                <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                  {availableStatuses.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleStatusChange(s.id)}
                      className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-100 ${
                        s.id === statusId ? "font-semibold" : ""
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {!isFieldHidden("description") && factsheet.description && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">
                Description
              </h4>
              <p className="text-gray-700 whitespace-pre-wrap">
                {factsheet.description}
              </p>
            </div>
          )}

          {/* Properties */}
          {properties.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Properties
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {properties.map((prop) => (
                  <div key={prop.id} className="bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">
                      {prop.expand?.property?.name}
                    </p>
                    <p className="text-sm font-medium text-primary-900">
                      {prop.expand?.option?.value || "Not set"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          {metrics.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">
                Metrics
              </h4>
              {/* Spider Diagram */}
              {spiderData.length > 0 && metricNames.length >= 3 && (
                <div className="flex justify-center mb-4">
                  <SpiderDiagram
                    data={spiderData}
                    metrics={metricNames}
                    maxValue={10}
                    size={280}
                    showLabels={true}
                    showLegend={false}
                    interactive={false}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => {
                  const score = computeMetricScore(metric);
                  return score !== null ? (
                    <MetricBadge
                      key={metric.id}
                      name={metric.name}
                      score={score}
                      variant="default"
                    />
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isFieldHidden("responsibility") && factsheet.responsibility && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">
                  Responsibility
                </h4>
                <p className="text-gray-700">{factsheet.responsibility}</p>
              </div>
            )}

            {!isFieldHidden("what_it_does") && factsheet.what_it_does && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">
                  What it does
                </h4>
                <div
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.what_it_does }}
                />
              </div>
            )}

            {!isFieldHidden("benefits") && factsheet.benefits && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">
                  Benefits
                </h4>
                <div
                  className="text-gray-700 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: factsheet.benefits }}
                />
              </div>
            )}

            {!isFieldHidden("problems_addressed") &&
              factsheet.problems_addressed && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    Problems Addressed
                  </h4>
                  <div
                    className="text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: factsheet.problems_addressed,
                    }}
                  />
                </div>
              )}
          </div>

          {!isFieldHidden("potential_ui") && factsheet.potential_ui && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-1">
                Potential User Interface
              </h4>
              <div
                className="text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: factsheet.potential_ui }}
              />
            </div>
          )}

          {/* Dependencies Graph */}
          {relatedFactsheets.length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">
                Dependencies
              </h4>
              <div className="h-[500px] border border-gray-200 rounded-lg overflow-hidden">
                <DependencyGraph
                  factsheets={relatedFactsheets}
                  dependencies={allDependencies}
                  onNodeClick={setActiveFactsheetId}
                  showComments={false}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {directOutgoingCount > 0 &&
                  `Depends on ${directOutgoingCount} factsheet${directOutgoingCount > 1 ? "s" : ""}`}
                {directOutgoingCount > 0 && directIncomingCount > 0 && " · "}
                {directIncomingCount > 0 &&
                  `${directIncomingCount} factsheet${directIncomingCount > 1 ? "s" : ""} depend${directIncomingCount === 1 ? "s" : ""} on this`}
              </p>
            </div>
          )}

          {/* Change History */}
          {changeLogs.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="w-full text-left text-sm font-medium text-gray-500 flex items-center gap-2 hover:text-gray-700"
              >
                {historyExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <History className="w-4 h-4" />
                Change History ({changeLogs.length})
              </button>
              {historyExpanded && (
                <div className="space-y-2 max-h-48 overflow-y-auto mt-2">
                  {changeLogs.map((log) => (
                    <div key={log.id} className="bg-gray-50 p-2 text-sm">
                      <div className="flex justify-between items-start">
                        <p className="text-gray-700">{log.description}</p>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {new Date(log.created).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        by {log.username}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Link
              to={`/factsheets/${activeFactsheetId}/edit`}
              onClick={onClose}
            >
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit className="w-4 h-4" />}
              >
                Edit
              </Button>
            </Link>
            <Link to={`/factsheets/${activeFactsheetId}`} onClick={onClose}>
              <Button
                variant="ghost"
                size="sm"
                icon={<ExternalLink className="w-4 h-4" />}
              >
                Open Full Page
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Factsheet not found
        </div>
      )}
    </Modal>
  );
}
