import { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutGrid,
  Eye,
  ChevronDown,
  Check,
  MessageSquare,
  Focus,
  EyeOff,
  Download,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Card, CardTitle, Button, Modal } from "../components/ui";
import { FilterBar } from "../components/FilterBar";
import { Textarea } from "../components/ui/Input";
import {
  DependencyGraph,
  type ConnectionRequest,
  type DependencyGraphExportHandlers,
  type DependencyGraphViewportHandlers,
  type GraphViewportState,
} from "../components/visualizations";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useRealtime } from "../hooks/useRealtime";
import { useChangeLog } from "../hooks/useChangeLog";
import { useQueryStates } from "../hooks/useQueryState";
import { useAppSettings } from "../hooks/useAppSettings";
import { useApplyPageDefaults } from "../hooks/useApplyPageDefaults";
import { SaveDefaultsButton } from "../components/SaveDefaultsButton";
import pb from "../lib/pocketbase";
import type {
  FactsheetExpanded,
  Dependency,
  FactsheetType,
  PropertyDefinition,
  PropertyOption,
  FactsheetPropertyExpanded,
} from "../types";

export default function DependenciesPage() {
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    settings,
    loading: settingsLoading,
    setSettings: setAppSettings,
  } = useAppSettings();

  const [state, setState] = useQueryStates({
    search: "",
    typeFilter: [] as string[],
    statusFilter: "",
    verifiedOnly: "",
    propertyFilters: {} as Record<string, string>,
    displayProperties: [] as string[],
    showComments: true,
    focusedFactsheetId: null as string | null,
    unrelatedDisplayMode: "dim" as "dim" | "hide",
  });

  const {
    search,
    typeFilter,
    statusFilter,
    verifiedOnly,
    propertyFilters,
    displayProperties,
    showComments,
    focusedFactsheetId,
    unrelatedDisplayMode,
  } = state;
  const setSearch = (v: string) => setState("search", v);
  const setTypeFilter = (v: string[]) => setState("typeFilter", v);
  const setStatusFilter = (v: string) => setState("statusFilter", v);
  const setVerifiedOnly = (v: boolean) =>
    setState("verifiedOnly", v ? "true" : "");
  const setPropertyFilters = (v: Record<string, string>) =>
    setState("propertyFilters", v);
  const setDisplayProperties = (v: string[]) =>
    setState("displayProperties", v);
  const setShowComments = (v: boolean) => setState("showComments", v);
  const setFocusedFactsheetId = (v: string | null) =>
    setState("focusedFactsheetId", v);
  const setUnrelatedDisplayMode = (v: "dim" | "hide") =>
    setState("unrelatedDisplayMode", v);

  useApplyPageDefaults(
    settings.defaultDependenciesFilters,
    setState,
    settingsLoading,
  );

  const [layoutKey, setLayoutKey] = useState(0);
  const isFirstRender = useRef(true);
  const exportGraphHandlerRef = useRef<DependencyGraphExportHandlers | null>(
    null,
  );
  const [exportingGraphFormat, setExportingGraphFormat] = useState<
    "png" | "svg" | null
  >(null);
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [isGraphRenderReady, setIsGraphRenderReady] = useState(false);
  const viewportHandlerRef = useRef<DependencyGraphViewportHandlers | null>(
    null,
  );
  const viewportBeforeHideFocusRef = useRef<GraphViewportState | null>(null);
  const shouldRestoreViewportRef = useRef(false);

  // Connection modal state (for creating new dependencies)
  const [connectionModal, setConnectionModal] =
    useState<ConnectionRequest | null>(null);
  const [connectionDescription, setConnectionDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit modal state (for editing existing dependencies)
  const [editingDependency, setEditingDependency] = useState<Dependency | null>(
    null,
  );
  const [editDescription, setEditDescription] = useState("");

  // Factsheet detail modal state
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );

  // Auto-align when focus changes in hide mode (since nodes are removed/added)
  useEffect(() => {
    if (unrelatedDisplayMode === "hide") {
      if (!focusedFactsheetId && shouldRestoreViewportRef.current) {
        return;
      }
      setLayoutKey((k) => k + 1);
    }
  }, [focusedFactsheetId, unrelatedDisplayMode]);

  useEffect(() => {
    if (unrelatedDisplayMode !== "hide") {
      return;
    }

    if (focusedFactsheetId !== null || !shouldRestoreViewportRef.current) {
      return;
    }

    const savedViewport = viewportBeforeHideFocusRef.current;
    if (!savedViewport) {
      shouldRestoreViewportRef.current = false;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      void viewportHandlerRef.current?.setViewport(savedViewport);
      shouldRestoreViewportRef.current = false;
      viewportBeforeHideFocusRef.current = null;
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusedFactsheetId, unrelatedDisplayMode]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen =
        document.fullscreenElement === graphContainerRef.current;
      setIsGraphFullscreen(isFullscreen);

      if (isFullscreen) {
        window.requestAnimationFrame(() => {
          void viewportHandlerRef.current?.fitView();
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const { records: factsheets, loading: loadingFactsheets } =
    useRealtime<FactsheetExpanded>({
      collection: "factsheets",
      expand: "type",
    });

  const { records: dependencies, loading: loadingDeps } =
    useRealtime<Dependency>({
      collection: "dependencies",
    });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: "factsheet_types",
    sort: "order",
  });

  const { records: propertyDefinitions } = useRealtime<PropertyDefinition>({
    collection: "property_definitions",
    sort: "order",
  });

  const { records: propertyOptions } = useRealtime<PropertyOption>({
    collection: "property_options",
    sort: "order",
  });

  const { records: factsheetProperties } =
    useRealtime<FactsheetPropertyExpanded>({
      collection: "factsheet_properties",
      expand: "property,option",
    });

  const { logDependencyAdded, logDependencyRemoved, logDependencyUpdated } =
    useChangeLog();

  // Build property lookup: factsheetId -> { propertyId -> optionValue }
  const propertyLookup = useMemo(() => {
    const lookup = new Map<string, Map<string, string>>();
    factsheetProperties.forEach((fp) => {
      if (!lookup.has(fp.factsheet)) {
        lookup.set(fp.factsheet, new Map());
      }
      // Use the expanded option value
      const optionValue = fp.expand?.option?.value || "";
      if (optionValue) {
        lookup.get(fp.factsheet)!.set(fp.property, optionValue);
      }
    });
    return lookup;
  }, [factsheetProperties]);

  // Filter factsheets
  const filteredFactsheets = useMemo(() => {
    return factsheets.filter((fs) => {
      const matchesSearch =
        search === "" ||
        fs.name.toLowerCase().includes(search.toLowerCase()) ||
        fs.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        typeFilter.length === 0 || typeFilter.includes(fs.type);
      const matchesStatus =
        statusFilter === "" || (fs.status_id || fs.status) === statusFilter;
      const matchesVerified = verifiedOnly !== "true" || Boolean(fs.reviewed);

      // Check property filters
      const matchesProperties = Object.entries(propertyFilters).every(
        ([propId, value]) => {
          if (value === "") return true;
          const fsProps = propertyLookup.get(fs.id);
          return fsProps?.get(propId) === value;
        },
      );

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesVerified &&
        matchesProperties
      );
    });
  }, [
    factsheets,
    search,
    typeFilter,
    statusFilter,
    verifiedOnly,
    propertyFilters,
    propertyLookup,
  ]);

  // Filter dependencies to only include those where both factsheets are visible
  const filteredDependencies = useMemo(() => {
    const visibleIds = new Set(filteredFactsheets.map((fs) => fs.id));
    return dependencies.filter(
      (dep) => visibleIds.has(dep.factsheet) && visibleIds.has(dep.depends_on),
    );
  }, [dependencies, filteredFactsheets]);

  // Auto-align whenever the set of filtered factsheets changes due to filtering
  const filteredFactsheetIds = useMemo(
    () =>
      filteredFactsheets
        .map((fs) => fs.id)
        .sort()
        .join(","),
    [filteredFactsheets],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setLayoutKey((k) => k + 1);
  }, [filteredFactsheetIds]);

  const handleNodeClick = (factsheetId: string) => {
    setSelectedFactsheetId(factsheetId);
  };

  const handleNodeRightClick = (factsheetId: string) => {
    // Toggle focus: if already focused on this node, clear focus
    const isClearingFocus = focusedFactsheetId === factsheetId;

    if (unrelatedDisplayMode === "hide") {
      if (isClearingFocus) {
        shouldRestoreViewportRef.current =
          viewportBeforeHideFocusRef.current !== null;
      } else {
        viewportBeforeHideFocusRef.current =
          viewportHandlerRef.current?.getViewport() || null;
        shouldRestoreViewportRef.current = false;
      }
    }

    setFocusedFactsheetId(isClearingFocus ? null : factsheetId);
  };

  const handleConnect = (connection: ConnectionRequest) => {
    setConnectionModal(connection);
    setConnectionDescription("");
  };

  const handleCreateDependency = async () => {
    if (!connectionModal) return;

    const descriptionTrimmed = connectionDescription.trim() || undefined;

    setSaving(true);
    try {
      await pb.collection("dependencies").create({
        factsheet: connectionModal.sourceId,
        depends_on: connectionModal.targetId,
        description: descriptionTrimmed || null,
      });

      // Log the change for both factsheets
      await logDependencyAdded(
        connectionModal.sourceId,
        connectionModal.sourceName,
        connectionModal.targetId,
        connectionModal.targetName,
        descriptionTrimmed,
      );

      setConnectionModal(null);
      setConnectionDescription("");
    } catch (err) {
      console.error("Failed to create dependency:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoAlign = () => {
    setLayoutKey((k) => k + 1);
  };

  const handleToggleFullscreen = async () => {
    if (!graphContainerRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === graphContainerRef.current) {
        await document.exitFullscreen();
      } else {
        await graphContainerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen for dependencies view", error);
    }
  };

  const handleExportGraph = async (format: "png" | "svg") => {
    if (!exportGraphHandlerRef.current || exportingGraphFormat) {
      return;
    }

    setShowExportDropdown(false);
    setExportingGraphFormat(format);
    try {
      await exportGraphHandlerRef.current[format]();
    } catch (error) {
      console.error(
        `Failed to export dependency graph as ${format.toUpperCase()}`,
        error,
      );
    } finally {
      setExportingGraphFormat(null);
    }
  };

  const handleEdgeClick = (dependencyId: string) => {
    const dep = dependencies.find((d) => d.id === dependencyId);
    if (dep) {
      setEditingDependency(dep);
      setEditDescription(dep.description || "");
    }
  };

  const handleUpdateDependency = async () => {
    if (!editingDependency) return;

    const sourceFactsheet = factsheets.find(
      (f) => f.id === editingDependency.factsheet,
    );
    const targetFactsheet = factsheets.find(
      (f) => f.id === editingDependency.depends_on,
    );
    const oldDescription = editingDependency.description || null;
    const newDescription = editDescription.trim() || null;

    // Only update if description actually changed
    if (oldDescription === newDescription) {
      setEditingDependency(null);
      setEditDescription("");
      return;
    }

    setSaving(true);
    try {
      await pb.collection("dependencies").update(editingDependency.id, {
        description: newDescription,
      });

      // Log the change for both factsheets
      if (sourceFactsheet && targetFactsheet) {
        await logDependencyUpdated(
          editingDependency.factsheet,
          sourceFactsheet.name,
          editingDependency.depends_on,
          targetFactsheet.name,
          oldDescription,
          newDescription,
        );
      }

      setEditingDependency(null);
      setEditDescription("");
    } catch (err) {
      console.error("Failed to update dependency:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDependency = async () => {
    if (!editingDependency) return;
    if (!confirm("Are you sure you want to delete this dependency?")) return;

    const sourceFactsheet = factsheets.find(
      (f) => f.id === editingDependency.factsheet,
    );
    const targetFactsheet = factsheets.find(
      (f) => f.id === editingDependency.depends_on,
    );

    setSaving(true);
    try {
      await pb.collection("dependencies").delete(editingDependency.id);

      // Log the change for both factsheets
      if (sourceFactsheet && targetFactsheet) {
        await logDependencyRemoved(
          editingDependency.factsheet,
          sourceFactsheet.name,
          editingDependency.depends_on,
          targetFactsheet.name,
        );
      }

      setEditingDependency(null);
      setEditDescription("");
    } catch (err) {
      console.error("Failed to delete dependency:", err);
    } finally {
      setSaving(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter([]);
    setStatusFilter("");
    setVerifiedOnly(false);
    setPropertyFilters({});
  };

  // Build property values for display on nodes: factsheetId -> { propertyId -> value }
  const factsheetPropertyValues = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    factsheetProperties.forEach((fp) => {
      if (!map.has(fp.factsheet)) {
        map.set(fp.factsheet, new Map());
      }
      const optionValue = fp.expand?.option?.value || "";
      if (optionValue) {
        map.get(fp.factsheet)!.set(fp.property, optionValue);
      }
    });
    return map;
  }, [factsheetProperties]);

  // Property display dropdown state
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowPropertyDropdown(false);
      }

      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExportDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const togglePropertyDisplay = (propId: string) => {
    setDisplayProperties(
      displayProperties.includes(propId)
        ? displayProperties.filter((id) => id !== propId)
        : [...displayProperties, propId],
    );
  };

  const loading = loadingFactsheets || loadingDeps;

  const hasFilters =
    search !== "" ||
    typeFilter.length > 0 ||
    statusFilter !== "" ||
    verifiedOnly === "true" ||
    Object.values(propertyFilters).some((v) => v !== "");

  useEffect(() => {
    if (loading || filteredFactsheets.length === 0) {
      setIsGraphRenderReady(false);
      return;
    }

    const markGraphReady = () => {
      setIsGraphRenderReady(true);
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(markGraphReady, {
        timeout: 400,
      });

      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = window.setTimeout(markGraphReady, 120);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loading, filteredFactsheets.length]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Dependencies</h1>
          <p className="text-gray-500 mt-1">
            Visualize the relationships between factsheets. Drag from one node
            to another to create a dependency.
          </p>
        </div>
        <SaveDefaultsButton
          type="dependencies"
          filters={state}
          onSave={(filters) =>
            setAppSettings({ defaultDependenciesFilters: filters })
          }
        />
      </div>

      {/* Filters and Additional Settings */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        verifiedOnly={verifiedOnly === "true"}
        onVerifiedOnlyChange={setVerifiedOnly}
        propertyFilters={propertyFilters}
        onPropertyFilterChange={(propId, value) =>
          setPropertyFilters({ ...propertyFilters, [propId]: value })
        }
        propertyDefinitions={propertyDefinitions}
        propertyOptions={propertyOptions}
        factsheetTypes={factsheetTypes}
        hasFilters={hasFilters}
        onClearFilters={clearAllFilters}
        filteredCount={filteredFactsheets.length}
        totalCount={factsheets.length}
        additionalSettings={
          <div className="flex items-center gap-4">
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
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        Display on nodes
                      </span>
                    </div>
                    {propertyDefinitions.map((prop) => (
                      <button
                        key={prop.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => togglePropertyDisplay(prop.id)}
                      >
                        <div
                          className={`w-4 h-4 border flex items-center justify-center ${
                            displayProperties.includes(prop.id)
                              ? "bg-accent-500 border-accent-500"
                              : "border-gray-300"
                          }`}
                        >
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

            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              title={showComments ? "Hide edge comments" : "Show edge comments"}
              className={`h-8 px-3 text-sm font-medium flex items-center gap-1.5 transition-colors rounded border ${
                showComments
                  ? "bg-accent-500 text-white border-accent-500"
                  : "bg-white text-primary-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comments
            </button>

            {/* Focus mode toggle */}
            <div className="flex items-center border border-gray-200 rounded overflow-hidden">
              <button
                type="button"
                onClick={() => setUnrelatedDisplayMode("dim")}
                title="Dim unrelated factsheets when focused"
                className={`h-8 px-3 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  unrelatedDisplayMode === "dim"
                    ? "bg-accent-500 text-white"
                    : "bg-white text-primary-700 hover:bg-gray-50"
                }`}
              >
                <Eye className="w-4 h-4" />
                Dim
              </button>
              <button
                type="button"
                onClick={() => setUnrelatedDisplayMode("hide")}
                title="Hide unrelated factsheets when focused"
                className={`h-8 px-3 text-sm font-medium flex items-center gap-1.5 transition-colors border-l border-gray-200 ${
                  unrelatedDisplayMode === "hide"
                    ? "bg-accent-500 text-white"
                    : "bg-white text-primary-700 hover:bg-gray-50"
                }`}
              >
                <EyeOff className="w-4 h-4" />
                Hide
              </button>
            </div>

            {focusedFactsheetId && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Focus className="w-4 h-4" />}
                onClick={() => setFocusedFactsheetId(null)}
                title="Clear focus"
              >
                Clear Focus
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              icon={<LayoutGrid className="w-4 h-4" />}
              onClick={handleAutoAlign}
            >
              Auto Align
            </Button>

            <div className="relative" ref={exportDropdownRef}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => setShowExportDropdown((open) => !open)}
                disabled={
                  loading ||
                  filteredFactsheets.length === 0 ||
                  exportingGraphFormat !== null
                }
              >
                {exportingGraphFormat
                  ? `Exporting ${exportingGraphFormat.toUpperCase()}...`
                  : "Export Graph"}
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>

              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-white border border-gray-200 shadow-lg z-50">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => handleExportGraph("png")}
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-t border-gray-100"
                    onClick={() => handleExportGraph("svg")}
                  >
                    Export SVG
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Graph */}
      {loading || (!isGraphRenderReady && filteredFactsheets.length > 0) ? (
        <Card className="flex-1 min-h-[320px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">
            {loading ? "Loading graph..." : "Preparing graph..."}
          </div>
        </Card>
      ) : filteredFactsheets.length === 0 ? (
        <Card className="flex-1 min-h-[320px] text-center py-16">
          <CardTitle>
            {hasFilters ? "No matching factsheets" : "No factsheets yet"}
          </CardTitle>
          <p className="text-gray-500 mt-2">
            {hasFilters
              ? "Try adjusting your filters to see more factsheets"
              : "Create some factsheets to see the dependency graph"}
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
        <div
          ref={graphContainerRef}
          className={`relative flex-1 border border-gray-200 bg-white overflow-hidden ${
            isGraphFullscreen ? "bg-gray-100" : "min-h-[320px]"
          }`}
        >
          <Button
            variant="secondary"
            size="sm"
            icon={
              isGraphFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )
            }
            onClick={handleToggleFullscreen}
            title={
              isGraphFullscreen
                ? "Exit fullscreen view"
                : "Open diagram in fullscreen"
            }
            className="absolute top-3 right-3 z-20"
          >
            {isGraphFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>

          <DependencyGraph
            key={layoutKey}
            factsheets={filteredFactsheets}
            dependencies={filteredDependencies}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onConnect={handleConnect}
            onEdgeClick={handleEdgeClick}
            displayProperties={displayProperties}
            propertyDefinitions={propertyDefinitions}
            factsheetPropertyValues={factsheetPropertyValues}
            showComments={showComments}
            focusedFactsheetId={focusedFactsheetId}
            unrelatedDisplayMode={unrelatedDisplayMode}
            onExportHandlerChange={(handler) => {
              exportGraphHandlerRef.current = handler;
            }}
            onViewportHandlerChange={(handler) => {
              viewportHandlerRef.current = handler;
            }}
          />
        </div>
      )}

      {/* Connection Modal */}
      <Modal
        isOpen={connectionModal !== null}
        onClose={() => setConnectionModal(null)}
        title="Create Dependency"
      >
        {connectionModal && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">Creating dependency:</p>
              <div className="bg-gray-50 p-3 space-y-2">
                <div>
                  <span className="font-medium text-primary-900">
                    {connectionModal.sourceName}
                  </span>
                </div>
                <div className="text-center text-gray-400">depends on</div>
                <div>
                  <span className="font-medium text-primary-900">
                    {connectionModal.targetName}
                  </span>
                </div>
              </div>
            </div>

            <Textarea
              label="Description (optional)"
              value={connectionDescription}
              onChange={(e) => setConnectionDescription(e.target.value)}
              placeholder="Describe the dependency relationship..."
              rows={3}
            />

            <div className="flex gap-3 pt-2">
              <Button onClick={handleCreateDependency} disabled={saving}>
                {saving ? "Creating..." : "Create Dependency"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConnectionModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Dependency Modal */}
      <Modal
        isOpen={editingDependency !== null}
        onClose={() => setEditingDependency(null)}
        title="Edit Dependency"
      >
        {editingDependency && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <p className="mb-2">Dependency:</p>
              <div className="bg-gray-50 p-3 space-y-2">
                <div>
                  <span className="font-medium text-primary-900">
                    {factsheets.find(
                      (f) => f.id === editingDependency.factsheet,
                    )?.name || "Unknown"}
                  </span>
                </div>
                <div className="text-center text-gray-400">depends on</div>
                <div>
                  <span className="font-medium text-primary-900">
                    {factsheets.find(
                      (f) => f.id === editingDependency.depends_on,
                    )?.name || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            <Textarea
              label="Description (optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe the dependency relationship..."
              rows={3}
            />

            <div className="flex gap-3 pt-2">
              <Button onClick={handleUpdateDependency} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditingDependency(null)}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeleteDependency}
                disabled={saving}
                className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Factsheet Detail Modal */}
      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
