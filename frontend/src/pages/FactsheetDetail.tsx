import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  GitBranch,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardTitle, Button, Badge, MetricBadge } from "../components/ui";
import { SpiderDiagram } from "../components/visualizations";
import type { SpiderDataPoint } from "../components/visualizations/SpiderDiagram";
import { useRecord, useRealtime } from "../hooks/useRealtime";
import { useChangeLog } from "../hooks/useChangeLog";
import pb from "../lib/pocketbase";
import type {
  Factsheet,
  FactsheetType,
  FactsheetPropertyExpanded,
  DependencyExpanded,
  ChangeLogExpanded,
  MetricExpanded,
} from "../types";

export default function FactsheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const { record: factsheet, loading } = useRecord<Factsheet>("factsheets", id);
  const { record: factsheetType } = useRecord<FactsheetType>(
    "factsheet_types",
    factsheet?.type,
  );

  const { records: dependencies } = useRealtime<DependencyExpanded>({
    collection: "dependencies",
    filter: `factsheet = "${id}"`,
    expand: "depends_on",
  });

  const { records: properties } = useRealtime<FactsheetPropertyExpanded>({
    collection: "factsheet_properties",
    filter: `factsheet = "${id}"`,
    expand: "property,option",
  });

  const { records: metrics } = useRealtime<MetricExpanded>({
    collection: "metrics",
    sort: "order",
    expand: "properties",
  });

  const { records: changeLogs } = useRealtime<ChangeLogExpanded>({
    collection: "change_log",
    filter: `factsheet = "${id}"`,
    sort: "-created",
    expand: "related_factsheet",
  });

  const { logDependencyRemoved } = useChangeLog();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this factsheet?")) return;

    try {
      await pb.collection("factsheets").delete(id!);
      navigate("/factsheets");
    } catch (err) {
      console.error("Failed to delete factsheet:", err);
    }
  };

  const handleDeleteDependency = async (depId: string) => {
    if (!confirm("Remove this dependency?")) return;

    const dep = dependencies.find((d) => d.id === depId);
    const targetFactsheet = dep?.expand?.depends_on;

    try {
      await pb.collection("dependencies").delete(depId);

      // Log the change for both factsheets
      if (factsheet && targetFactsheet) {
        await logDependencyRemoved(
          id!,
          factsheet.name,
          targetFactsheet.id,
          targetFactsheet.name,
        );
      }
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "draft":
        return "default";
      case "archived":
        return "warning";
      default:
        return "default";
    }
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

  const typeColor = factsheetType?.color || "#6b7280";

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

    // Only include if we have at least some valid metric values
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 w-1/3"></div>
            <div className="h-4 bg-gray-200 w-2/3"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!factsheet) {
    return (
      <Card className="text-center py-12">
        <h2 className="text-lg font-medium text-primary-900">
          Factsheet not found
        </h2>
        <p className="text-gray-500 mt-2">
          The requested factsheet does not exist.
        </p>
        <Link to="/factsheets">
          <Button variant="secondary" className="mt-4">
            Back to Factsheets
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/factsheets">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4" style={{ backgroundColor: typeColor }} />
              <h1 className="text-2xl font-bold text-primary-900">
                {factsheet.name}
              </h1>
              {factsheetType && (
                <span
                  className="px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: typeColor }}
                >
                  {factsheetType.name}
                </span>
              )}
              <Badge variant={getStatusVariant(factsheet.status)}>
                {factsheet.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/factsheets/${id}/edit`}>
            <Button variant="secondary" icon={<Edit className="w-4 h-4" />}>
              Edit
            </Button>
          </Link>
          <Button
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardTitle>Description</CardTitle>
        <p className="text-gray-600 mt-2 whitespace-pre-wrap">
          {factsheet.description || "No description provided"}
        </p>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Responsibility */}
        {factsheet.responsibility && (
          <Card>
            <CardTitle>Responsibility</CardTitle>
            <p className="text-gray-600 mt-2">{factsheet.responsibility}</p>
          </Card>
        )}

        {/* What it does */}
        {factsheet.what_it_does && (
          <Card>
            <CardTitle>What it does</CardTitle>
            <div
              className="text-gray-600 mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: factsheet.what_it_does }}
            />
          </Card>
        )}

        {/* Benefits */}
        {factsheet.benefits && (
          <Card>
            <CardTitle>Benefits</CardTitle>
            <div
              className="text-gray-600 mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: factsheet.benefits }}
            />
          </Card>
        )}

        {/* Problems Addressed */}
        {factsheet.problems_addressed && (
          <Card>
            <CardTitle>Problems Addressed</CardTitle>
            <div
              className="text-gray-600 mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: factsheet.problems_addressed }}
            />
          </Card>
        )}

        {/* Potential UI */}
        {factsheet.potential_ui && (
          <Card className="md:col-span-2">
            <CardTitle>Potential User Interface</CardTitle>
            <div
              className="text-gray-600 mt-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: factsheet.potential_ui }}
            />
          </Card>
        )}
      </div>

      {/* Dependencies */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Dependencies</CardTitle>
          <Link to={`/factsheets/${id}/dependencies/new`}>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Dependency
            </Button>
          </Link>
        </div>

        {dependencies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitBranch className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No dependencies added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between p-3 bg-gray-50"
              >
                <div>
                  <Link
                    to={`/factsheets/${dep.depends_on}`}
                    className="font-medium text-primary-900 hover:text-accent-500"
                  >
                    {dep.expand?.depends_on?.name || "Unknown Factsheet"}
                  </Link>
                  {dep.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {dep.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDependency(dep.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Properties */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Properties</CardTitle>
          <Link to={`/factsheets/${id}/properties`}>
            <Button
              size="sm"
              variant="secondary"
              icon={<Edit className="w-4 h-4" />}
            >
              Edit Properties
            </Button>
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No properties configured yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {properties.map((prop) => (
              <div key={prop.id} className="p-3 bg-gray-50">
                <p className="text-sm text-gray-500">
                  {prop.expand?.property?.name || "Property"}
                </p>
                <p className="font-medium text-primary-900">
                  {prop.expand?.option?.value || "Not set"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Metrics */}
      {metrics.length > 0 && (
        <Card>
          <CardTitle>Metrics</CardTitle>
          <div className="mt-4">
            {/* Spider Diagram */}
            {spiderData.length > 0 && metricNames.length >= 3 && (
              <div className="flex justify-center mb-6">
                <SpiderDiagram
                  data={spiderData}
                  metrics={metricNames}
                  maxValue={10}
                  size={350}
                  showLabels={true}
                  showLegend={false}
                  interactive={false}
                />
              </div>
            )}
            {/* Metric badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          </div>
        </Card>
      )}

      {/* Change History */}
      <Card>
        <button
          type="button"
          onClick={() => setHistoryExpanded(!historyExpanded)}
          className="w-full text-left flex items-center gap-2 hover:opacity-80"
        >
          {historyExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
          <History className="w-5 h-5 text-gray-400" />
          <CardTitle>Change History ({changeLogs.length})</CardTitle>
        </button>

        {historyExpanded &&
          (changeLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No changes recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {changeLogs.map((log) => (
                <div key={log.id} className="p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <p className="text-gray-700">{log.description}</p>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {new Date(log.created).toLocaleDateString()}{" "}
                      {new Date(log.created).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    by {log.username}
                  </p>
                </div>
              ))}
            </div>
          ))}
      </Card>

      {/* Metadata */}
      <Card padding="sm">
        <div className="flex gap-8 text-sm text-gray-500">
          <div>
            <span className="font-medium">Created:</span>{" "}
            {new Date(factsheet.created).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Updated:</span>{" "}
            {new Date(factsheet.updated).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </div>
  );
}
