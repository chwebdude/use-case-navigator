import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import * as Icons from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardTitle, Button, Input } from "../components/ui";
import { useRealtime } from "../hooks/useRealtime";
import {
  useAppSettings,
  AVAILABLE_ICONS,
  type IconId,
} from "../hooks/useAppSettings";
import pb from "../lib/pocketbase";
import { normalizeStatuses } from "../lib/statusConfig";
import type {
  FactsheetType,
  PropertyDefinition,
  PropertyOption,
  MetricExpanded,
  HiddenField,
  StatusDefinition,
} from "../types";

interface StatusConfigEditorProps {
  statuses: StatusDefinition[];
  onChange: (next: StatusDefinition[]) => void;
  addLabel: string;
}

function StatusConfigEditor({
  statuses,
  onChange,
  addLabel,
}: StatusConfigEditorProps) {
  const [newStatus, setNewStatus] = useState<StatusDefinition>({
    id: "",
    label: "",
    color: "#6b7280",
  });
  const [draftIds, setDraftIds] = useState<string[]>(
    statuses.map((status) => status.id),
  );

  useEffect(() => {
    setDraftIds(statuses.map((status) => status.id));
  }, [statuses]);

  const handleChange = (index: number, patch: Partial<StatusDefinition>) => {
    const next = statuses.map((status, idx) =>
      idx === index ? { ...status, ...patch } : status,
    );
    onChange(normalizeStatuses(next));
  };

  const handleDelete = (index: number) => {
    if (statuses.length <= 1) {
      alert("At least one status is required.");
      return;
    }
    onChange(statuses.filter((_, idx) => idx !== index));
  };

  const handleDraftIdChange = (index: number, value: string) => {
    setDraftIds((prev) => prev.map((id, idx) => (idx === index ? value : id)));
  };

  const commitIdOnBlur = (index: number) => {
    const nextId = (draftIds[index] ?? "").trim();
    const currentId = statuses[index]?.id ?? "";

    if (!nextId) {
      alert("Status ID is required.");
      setDraftIds((prev) =>
        prev.map((id, idx) => (idx === index ? currentId : id)),
      );
      return;
    }

    const hasDuplicate = statuses.some(
      (status, idx) => idx !== index && status.id === nextId,
    );

    if (hasDuplicate) {
      alert(`Status ID "${nextId}" already exists.`);
      setDraftIds((prev) =>
        prev.map((id, idx) => (idx === index ? currentId : id)),
      );
      return;
    }

    if (nextId !== currentId) {
      handleChange(index, { id: nextId });
    }
  };

  const handleAdd = () => {
    const trimmedId = newStatus.id.trim();
    const trimmedLabel = newStatus.label.trim();
    if (!trimmedId || !trimmedLabel) {
      return;
    }
    if (statuses.some((status) => status.id === trimmedId)) {
      alert(`Status ID "${trimmedId}" already exists.`);
      return;
    }
    onChange(
      normalizeStatuses([
        ...statuses,
        {
          id: trimmedId,
          label: trimmedLabel,
          color: newStatus.color,
        },
      ]),
    );
    setNewStatus({ id: "", label: "", color: "#6b7280" });
  };

  return (
    <div className="space-y-3">
      {statuses.map((status, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="block text-xs text-gray-600 mb-1">ID</label>
            <input
              type="text"
              value={draftIds[index] ?? status.id}
              onChange={(e) => handleDraftIdChange(index, e.target.value)}
              onBlur={() => commitIdOnBlur(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="col-span-5">
            <label className="block text-xs text-gray-600 mb-1">Label</label>
            <input
              type="text"
              value={status.label}
              onChange={(e) => handleChange(index, { label: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Color</label>
            <input
              type="color"
              value={status.color}
              onChange={(e) => handleChange(index, { color: e.target.value })}
              className="w-full h-9 border border-gray-300"
            />
          </div>
          <div className="col-span-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(index)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}

      <div className="pt-2 border-t border-gray-200">
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="block text-xs text-gray-600 mb-1">New ID</label>
            <input
              type="text"
              value={newStatus.id}
              onChange={(e) =>
                setNewStatus((prev) => ({ ...prev, id: e.target.value }))
              }
              className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="col-span-5">
            <label className="block text-xs text-gray-600 mb-1">
              New Label
            </label>
            <input
              type="text"
              value={newStatus.label}
              onChange={(e) =>
                setNewStatus((prev) => ({ ...prev, label: e.target.value }))
              }
              className="w-full px-2 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Color</label>
            <input
              type="color"
              value={newStatus.color}
              onChange={(e) =>
                setNewStatus((prev) => ({ ...prev, color: e.target.value }))
              }
              className="w-full h-9 border border-gray-300"
            />
          </div>
          <div className="col-span-1">
            <Button variant="ghost" size="sm" onClick={handleAdd}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{addLabel}</p>
      </div>
    </div>
  );
}

// Sortable Type Item component
interface SortableTypeItemProps {
  type: FactsheetType;
  editingType: string | null;
  editTypeData: {
    name: string;
    color: string;
    hidden_fields: HiddenField[];
    has_status_override: boolean;
    status_overrides: StatusDefinition[];
  };
  setEditTypeData: (data: {
    name: string;
    color: string;
    hidden_fields: HiddenField[];
    has_status_override: boolean;
    status_overrides: StatusDefinition[];
  }) => void;
  handleEditType: (type: FactsheetType) => void;
  handleSaveType: () => void;
  handleCancelEditType: () => void;
  handleDeleteType: (id: string) => void;
  defaultColors: string[];
  globalStatuses: StatusDefinition[];
}

function SortableTypeItem({
  type,
  editingType,
  editTypeData,
  setEditTypeData,
  handleEditType,
  handleSaveType,
  handleCancelEditType,
  handleDeleteType,
  defaultColors,
  globalStatuses,
}: SortableTypeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: type.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-gray-50"
    >
      <div {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      {editingType === type.id ? (
        <div className="flex-1 space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex gap-2">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setEditTypeData({ ...editTypeData, color })}
                  className={`w-6 h-6 border-2 ${
                    editTypeData.color === color
                      ? "border-primary-900"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <input
              type="text"
              value={editTypeData.name}
              onChange={(e) =>
                setEditTypeData({ ...editTypeData, name: e.target.value })
              }
              className="flex-1 px-3 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveType}
              className="text-green-600 hover:text-green-700"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEditType}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-white p-3 border border-gray-200">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Hide Fields for This Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "description", label: "Description" },
                  { id: "responsibility", label: "Responsibility" },
                  { id: "what_it_does", label: "What it does" },
                  { id: "benefits", label: "Benefits" },
                  { id: "problems_addressed", label: "Problems Addressed" },
                  { id: "potential_ui", label: "Potential User Interface" },
                ] as { id: HiddenField; label: string }[]
              ).map(({ id, label }) => (
                <label key={id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editTypeData.hidden_fields?.includes(id) ?? false}
                    onChange={(e) => {
                      const current = editTypeData.hidden_fields ?? [];
                      const updated = e.target.checked
                        ? [...current, id]
                        : current.filter((f) => f !== id);
                      setEditTypeData({
                        ...editTypeData,
                        hidden_fields: updated,
                      });
                    }}
                    className="w-4 h-4"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white p-3 border border-gray-200 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editTypeData.has_status_override}
                onChange={(e) =>
                  setEditTypeData({
                    ...editTypeData,
                    has_status_override: e.target.checked,
                    status_overrides: e.target.checked
                      ? normalizeStatuses(editTypeData.status_overrides)
                      : normalizeStatuses(globalStatuses),
                  })
                }
                className="w-4 h-4"
              />
              <span>Override global statuses for this type</span>
            </label>

            {editTypeData.has_status_override && (
              <StatusConfigEditor
                statuses={editTypeData.status_overrides}
                onChange={(status_overrides) =>
                  setEditTypeData({
                    ...editTypeData,
                    status_overrides,
                  })
                }
                addLabel="These statuses are only used by this factsheet type."
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            className="w-6 h-6 border border-gray-300"
            style={{ backgroundColor: type.color }}
          />
          <div className="flex-1">
            <div className="font-medium text-primary-900">{type.name}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditType(type)}
            className="text-gray-400 hover:text-accent-500"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteType(type.id)}
            className="text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

// Sortable Option Item component
interface SortableOptionItemProps {
  opt: PropertyOption;
  propertyId: string;
  editingOption: string | null;
  editOptionValue: string;
  setEditOptionValue: (value: string) => void;
  handleEditOption: (opt: PropertyOption) => void;
  handleSaveOption: () => void;
  handleCancelEditOption: () => void;
  handleDeleteOption: (optionId: string, propertyId: string) => void;
  handleWeightChange: (optionId: string, weight: number) => void;
  maxMetricWeight: number;
}

function SortableOptionItem({
  opt,
  propertyId,
  editingOption,
  editOptionValue,
  setEditOptionValue,
  handleEditOption,
  handleSaveOption,
  handleCancelEditOption,
  handleDeleteOption,
  handleWeightChange,
  maxMetricWeight,
}: SortableOptionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <div {...attributes} {...listeners} className="cursor-move">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>
      {editingOption === opt.id ? (
        <>
          <input
            type="text"
            value={editOptionValue}
            onChange={(e) => setEditOptionValue(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <input
            type="number"
            min={0}
            max={maxMetricWeight}
            value={opt.weight ?? 0}
            onChange={(e) =>
              handleWeightChange(
                opt.id,
                Number.isNaN(Number(e.target.value))
                  ? 0
                  : Number(e.target.value),
              )
            }
            className="w-20 px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveOption}
            className="text-green-600 hover:text-green-700"
          >
            <Check className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelEditOption}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-3 h-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-gray-700 bg-white px-2 py-1 border border-gray-200">
            {opt.value}
          </span>
          <input
            type="number"
            min={0}
            max={maxMetricWeight}
            value={opt.weight ?? 0}
            onChange={(e) =>
              handleWeightChange(
                opt.id,
                Number.isNaN(Number(e.target.value))
                  ? 0
                  : Number(e.target.value),
              )
            }
            className="w-20 px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditOption(opt)}
            className="text-gray-400 hover:text-accent-500"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteOption(opt.id, propertyId)}
            className="text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

// Sortable Property Item component
interface SortablePropertyItemProps {
  prop: PropertyDefinition;
  options: PropertyOption[];
  editingPropName: string | null;
  editPropNameValue: string;
  setEditPropNameValue: (value: string) => void;
  handleEditPropertyName: (prop: PropertyDefinition) => void;
  handleSavePropertyName: () => void;
  handleCancelEditPropertyName: () => void;
  handleDeleteProperty: (id: string) => void;
  editingOption: string | null;
  editOptionValue: string;
  setEditOptionValue: (value: string) => void;
  handleEditOption: (opt: PropertyOption) => void;
  handleSaveOption: () => void;
  handleCancelEditOption: () => void;
  handleDeleteOption: (optionId: string, propertyId: string) => void;
  newOptionForProp: string | null;
  newOptionValue: string;
  setNewOptionValue: (value: string) => void;
  handleStartAddOption: (propId: string) => void;
  handleAddOption: () => void;
  handleCancelAddOption: () => void;
  sensors: ReturnType<typeof useSensors>;
  handleOptionReorder: (propertyId: string, event: DragEndEvent) => void;
  handleWeightChange: (optionId: string, weight: number) => void;
  handleDistributeWeights: (propertyId: string) => void;
  maxMetricWeight: number;
}

function SortablePropertyItem({
  prop,
  options,
  editingPropName,
  editPropNameValue,
  setEditPropNameValue,
  handleEditPropertyName,
  handleSavePropertyName,
  handleCancelEditPropertyName,
  handleDeleteProperty,
  editingOption,
  editOptionValue,
  setEditOptionValue,
  handleEditOption,
  handleSaveOption,
  handleCancelEditOption,
  handleDeleteOption,
  newOptionForProp,
  newOptionValue,
  setNewOptionValue,
  handleStartAddOption,
  handleAddOption,
  handleCancelAddOption,
  sensors,
  handleOptionReorder,
  handleWeightChange,
  handleDistributeWeights,
  maxMetricWeight,
}: SortablePropertyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-4 bg-gray-50 border border-gray-200"
    >
      {/* Property name row */}
      <div className="flex items-center gap-3 mb-3">
        <div {...attributes} {...listeners} className="cursor-move">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        {editingPropName === prop.id ? (
          <>
            <input
              type="text"
              value={editPropNameValue}
              onChange={(e) => setEditPropNameValue(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSavePropertyName}
              className="text-green-600 hover:text-green-700"
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEditPropertyName}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex-1 font-medium text-primary-900">
              {prop.name}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditPropertyName(prop)}
              className="text-gray-400 hover:text-accent-500"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteProperty(prop.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Options list */}
      <div className="ml-7 space-y-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
          Options
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => handleOptionReorder(prop.id, event)}
        >
          <SortableContext
            items={options.map((o) => o.id)}
            strategy={verticalListSortingStrategy}
          >
            {options.map((opt) => (
              <SortableOptionItem
                key={opt.id}
                opt={opt}
                propertyId={prop.id}
                editingOption={editingOption}
                editOptionValue={editOptionValue}
                setEditOptionValue={setEditOptionValue}
                handleEditOption={handleEditOption}
                handleSaveOption={handleSaveOption}
                handleCancelEditOption={handleCancelEditOption}
                handleDeleteOption={handleDeleteOption}
                handleWeightChange={handleWeightChange}
                maxMetricWeight={maxMetricWeight}
              />
            ))}
          </SortableContext>
        </DndContext>

        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => handleStartAddOption(prop.id)}
            className="flex items-center gap-1 text-sm text-accent-500 hover:text-accent-600"
          >
            <Plus className="w-3 h-3" />
            Add option
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDistributeWeights(prop.id)}
            className="text-accent-600 hover:text-accent-700"
          >
            Distribute weights
          </Button>
        </div>

        {/* Add new option */}
        {newOptionForProp === prop.id ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              placeholder="New option value"
              className="flex-1 px-2 py-1 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddOption}
              disabled={!newOptionValue.trim()}
              className="text-green-600 hover:text-green-700"
            >
              <Check className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelAddOption}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const defaultColors = [
  "#00aeef", // Cerulean
  "#a8005c", // Magenta
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#84cc16", // Lime
];

export default function SettingsPage() {
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // App Settings
  const {
    settings: appSettings,
    setSettings: setAppSettings,
    resetSettings: resetAppSettings,
    defaultSettings,
  } = useAppSettings();

  // Factsheet Types
  const { records: factsheetTypes, refresh: refreshTypes } =
    useRealtime<FactsheetType>({
      collection: "factsheet_types",
      sort: "order",
    });

  const [newType, setNewType] = useState({ name: "", color: defaultColors[0] });
  const [savingType, setSavingType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeData, setEditTypeData] = useState({
    name: "",
    color: "",
    hidden_fields: [] as HiddenField[],
    has_status_override: false,
    status_overrides: normalizeStatuses(appSettings.statuses),
  });

  // Handle type reorder
  const handleTypeReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = factsheetTypes.findIndex((t) => t.id === active.id);
    const newIndex = factsheetTypes.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(factsheetTypes, oldIndex, newIndex);

    // Update order in database
    try {
      await Promise.all(
        reordered.map((type, index) =>
          pb.collection("factsheet_types").update(type.id, { order: index }),
        ),
      );
      refreshTypes();
    } catch (err) {
      console.error("Failed to reorder types:", err);
    }
  };

  const handleAddType = async () => {
    if (!newType.name) return;

    setSavingType(true);
    try {
      await pb.collection("factsheet_types").create({
        name: newType.name,
        color: newType.color,
        order: factsheetTypes.length,
      });
      setNewType({
        name: "",
        color:
          defaultColors[(factsheetTypes.length + 1) % defaultColors.length],
      });
      refreshTypes();
    } catch (err) {
      console.error("Failed to add factsheet type:", err);
    } finally {
      setSavingType(false);
    }
  };

  const handleEditType = (type: FactsheetType) => {
    setEditingType(type.id);
    setEditTypeData({
      name: type.name,
      color: type.color,
      hidden_fields: type.hidden_fields ?? [],
      has_status_override:
        Array.isArray(type.status_overrides) &&
        type.status_overrides.length > 0,
      status_overrides: normalizeStatuses(
        type.status_overrides ?? appSettings.statuses,
      ),
    });
  };

  const handleSaveType = async () => {
    if (!editingType || !editTypeData.name) return;

    try {
      await pb.collection("factsheet_types").update(editingType, {
        name: editTypeData.name,
        color: editTypeData.color,
        hidden_fields:
          editTypeData.hidden_fields.length > 0
            ? editTypeData.hidden_fields
            : null,
        status_overrides: editTypeData.has_status_override
          ? normalizeStatuses(editTypeData.status_overrides)
          : null,
      });
      setEditingType(null);
      refreshTypes();
    } catch (err) {
      console.error("Failed to update factsheet type:", err);
    }
  };

  const handleCancelEditType = () => {
    setEditingType(null);
  };

  const handleDeleteType = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this factsheet type? All factsheets of this type will need to be updated.",
      )
    )
      return;

    try {
      await pb.collection("factsheet_types").delete(id);
      refreshTypes();
    } catch (err) {
      console.error("Failed to delete factsheet type:", err);
    }
  };

  // Property Definitions
  const { records: propertyDefinitions, refresh: refreshProps } =
    useRealtime<PropertyDefinition>({
      collection: "property_definitions",
      sort: "order",
    });

  // Property Options
  const { records: propertyOptions, refresh: refreshOptions } =
    useRealtime<PropertyOption>({
      collection: "property_options",
      sort: "order",
    });

  // Group options by property
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

  const [newProp, setNewProp] = useState({ name: "", options: "" });
  const [savingProp, setSavingProp] = useState(false);
  const [editingPropName, setEditingPropName] = useState<string | null>(null);
  const [editPropNameValue, setEditPropNameValue] = useState("");
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editOptionValue, setEditOptionValue] = useState("");
  const [newOptionForProp, setNewOptionForProp] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");
  const maxMetricWeight =
    appSettings.maxMetricWeight ?? defaultSettings.maxMetricWeight;

  const computeDistributedWeights = (count: number, max: number) => {
    if (count <= 0) return [] as number[];
    if (count === 1) return [max];
    const step = max / (count - 1);
    return Array.from({ length: count }, (_, idx) =>
      Math.max(0, Math.round(step * idx * 100) / 100),
    );
  };

  const handleAddProperty = async () => {
    if (!newProp.name || !newProp.options) return;

    setSavingProp(true);
    try {
      const optionValues = newProp.options
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (optionValues.length === 0) {
        alert("Please add at least one option");
        return;
      }

      // Create the property definition first
      const prop = await pb.collection("property_definitions").create({
        name: newProp.name,
        order: propertyDefinitions.length,
      });

      const distributedWeights = computeDistributedWeights(
        optionValues.length,
        maxMetricWeight,
      );

      // Create options for this property
      for (let i = 0; i < optionValues.length; i++) {
        await pb.collection("property_options").create({
          property: prop.id,
          value: optionValues[i],
          order: i,
          weight: distributedWeights[i] ?? maxMetricWeight,
        });
      }

      setNewProp({ name: "", options: "" });
      refreshProps();
      refreshOptions();
    } catch (err) {
      console.error("Failed to add property:", err);
    } finally {
      setSavingProp(false);
    }
  };

  const handleEditPropertyName = (prop: PropertyDefinition) => {
    setEditingPropName(prop.id);
    setEditPropNameValue(prop.name);
  };

  const handleSavePropertyName = async () => {
    if (!editingPropName || !editPropNameValue.trim()) return;

    try {
      await pb.collection("property_definitions").update(editingPropName, {
        name: editPropNameValue.trim(),
      });
      setEditingPropName(null);
      refreshProps();
    } catch (err) {
      console.error("Failed to update property name:", err);
    }
  };

  const handleCancelEditPropertyName = () => {
    setEditingPropName(null);
  };

  const handleDeleteProperty = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this property and all its options?",
      )
    )
      return;

    try {
      // Delete all options for this property first
      const options = optionsByProperty.get(id) || [];
      for (const opt of options) {
        await pb.collection("property_options").delete(opt.id);
      }
      // Then delete the property
      await pb.collection("property_definitions").delete(id);
      refreshProps();
      refreshOptions();
    } catch (err) {
      console.error("Failed to delete property:", err);
    }
  };

  // Option editing
  const handleEditOption = (opt: PropertyOption) => {
    setEditingOption(opt.id);
    setEditOptionValue(opt.value);
  };

  const handleSaveOption = async () => {
    if (!editingOption || !editOptionValue.trim()) return;

    try {
      await pb.collection("property_options").update(editingOption, {
        value: editOptionValue.trim(),
      });
      setEditingOption(null);
      refreshOptions();
    } catch (err) {
      console.error("Failed to update option:", err);
    }
  };

  const handleCancelEditOption = () => {
    setEditingOption(null);
  };

  const handleDeleteOption = async (optionId: string, propertyId: string) => {
    const options = optionsByProperty.get(propertyId) || [];
    if (options.length <= 1) {
      alert("Cannot delete the last option. Delete the property instead.");
      return;
    }

    try {
      await pb.collection("property_options").delete(optionId);
      refreshOptions();
    } catch (err) {
      console.error("Failed to delete option:", err);
    }
  };

  // Add new option to existing property
  const handleStartAddOption = (propId: string) => {
    setNewOptionForProp(propId);
    setNewOptionValue("");
  };

  const handleAddOption = async () => {
    if (!newOptionForProp || !newOptionValue.trim()) return;

    try {
      const options = optionsByProperty.get(newOptionForProp) || [];
      await pb.collection("property_options").create({
        property: newOptionForProp,
        value: newOptionValue.trim(),
        order: options.length,
        weight: maxMetricWeight,
      });
      setNewOptionForProp(null);
      setNewOptionValue("");
      refreshOptions();
    } catch (err) {
      console.error("Failed to add option:", err);
    }
  };

  const handleCancelAddOption = () => {
    setNewOptionForProp(null);
    setNewOptionValue("");
  };

  const handleUpdateOptionWeight = async (optionId: string, weight: number) => {
    const clamped = Math.max(0, Math.min(weight, maxMetricWeight));
    try {
      await pb.collection("property_options").update(optionId, {
        weight: clamped,
      });
      refreshOptions();
    } catch (err) {
      console.error("Failed to update option weight:", err);
    }
  };

  const handleDistributeWeights = async (propertyId: string) => {
    const opts = optionsByProperty.get(propertyId) || [];
    if (opts.length === 0) return;
    const weights = computeDistributedWeights(opts.length, maxMetricWeight);
    try {
      await Promise.all(
        opts.map((opt, idx) =>
          pb.collection("property_options").update(opt.id, {
            weight: weights[idx] ?? maxMetricWeight,
          }),
        ),
      );
      refreshOptions();
    } catch (err) {
      console.error("Failed to distribute weights:", err);
    }
  };

  // Handle property definition reorder
  const handlePropertyReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = propertyDefinitions.findIndex((p) => p.id === active.id);
    const newIndex = propertyDefinitions.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(propertyDefinitions, oldIndex, newIndex);

    try {
      await Promise.all(
        reordered.map((prop, index) =>
          pb
            .collection("property_definitions")
            .update(prop.id, { order: index }),
        ),
      );
      refreshProps();
    } catch (err) {
      console.error("Failed to reorder properties:", err);
    }
  };

  // Handle option reorder within a property
  const handleOptionReorder = async (
    propertyId: string,
    event: DragEndEvent,
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const options = optionsByProperty.get(propertyId) || [];
    const oldIndex = options.findIndex((o) => o.id === active.id);
    const newIndex = options.findIndex((o) => o.id === over.id);
    const reordered = arrayMove(options, oldIndex, newIndex);

    try {
      await Promise.all(
        reordered.map((opt, index) =>
          pb.collection("property_options").update(opt.id, { order: index }),
        ),
      );
      refreshOptions();
    } catch (err) {
      console.error("Failed to reorder options:", err);
    }
  };

  // Metrics (list + create)
  const { records: metrics, refresh: refreshMetrics } =
    useRealtime<MetricExpanded>({
      collection: "metrics",
      sort: "order",
      expand: "properties",
    });
  const [newMetricName, setNewMetricName] = useState("");
  const [newMetricProps, setNewMetricProps] = useState<string[]>([]);
  const [savingMetric, setSavingMetric] = useState(false);
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [editMetricName, setEditMetricName] = useState("");
  const [editMetricProps, setEditMetricProps] = useState<string[]>([]);

  const toggleMetricProp = (propId: string) => {
    setNewMetricProps((prev) =>
      prev.includes(propId)
        ? prev.filter((id) => id !== propId)
        : [...prev, propId],
    );
  };

  const toggleEditMetricProp = (propId: string) => {
    setEditMetricProps((prev) =>
      prev.includes(propId)
        ? prev.filter((id) => id !== propId)
        : [...prev, propId],
    );
  };

  const handleAddMetric = async () => {
    if (!newMetricName.trim() || newMetricProps.length === 0) return;
    setSavingMetric(true);
    try {
      await pb.collection("metrics").create({
        name: newMetricName.trim(),
        properties: newMetricProps,
        order: metrics.length,
      });
      setNewMetricName("");
      setNewMetricProps([]);
      refreshMetrics();
    } catch (err) {
      console.error("Failed to add metric:", err);
    } finally {
      setSavingMetric(false);
    }
  };

  const handleDeleteMetric = async (id: string) => {
    if (!confirm("Delete this metric?")) return;
    try {
      await pb.collection("metrics").delete(id);
      refreshMetrics();
    } catch (err) {
      console.error("Failed to delete metric:", err);
    }
  };

  const handleStartEditMetric = (m: MetricExpanded) => {
    setEditingMetric(m.id);
    setEditMetricName(m.name);
    const ids =
      m.properties && m.properties.length > 0
        ? m.properties
        : (m.expand?.properties || []).map((p) => p.id);
    setEditMetricProps(ids);
  };

  const handleCancelEditMetric = () => {
    setEditingMetric(null);
    setEditMetricName("");
    setEditMetricProps([]);
  };

  const handleSaveMetric = async () => {
    if (!editingMetric) return;
    if (!editMetricName.trim() || editMetricProps.length === 0) return;
    setSavingMetric(true);
    try {
      await pb.collection("metrics").update(editingMetric, {
        name: editMetricName.trim(),
        properties: editMetricProps,
      });
      handleCancelEditMetric();
      refreshMetrics();
    } catch (err) {
      console.error("Failed to update metric:", err);
    } finally {
      setSavingMetric(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure application and factsheet settings
        </p>
      </div>

      {/* Application Settings */}
      <Card>
        <CardTitle>Application Settings</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Customize the application title and icon.
        </p>

        <div className="space-y-6">
          {/* App Title */}
          <Input
            label="Application Title"
            placeholder="Enter application title"
            value={appSettings.title}
            onChange={(e) => setAppSettings({ title: e.target.value })}
          />

          <Input
            label="Max Metric Weight"
            type="number"
            min={0}
            value={appSettings.maxMetricWeight}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (Number.isNaN(val)) return;
              setAppSettings({ maxMetricWeight: val });
            }}
            hint="Global maximum weight used when distributing option weights."
          />

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-primary-900 mb-3">
              Application Icon
            </label>
            <div className="grid grid-cols-6 gap-3">
              {AVAILABLE_ICONS.map(({ id, label }) => {
                const IconComponent = Icons[id] as React.ComponentType<{
                  className?: string;
                }>;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAppSettings({ icon: id as IconId })}
                    className={`flex flex-col items-center gap-2 p-3 border-2 transition-colors ${
                      appSettings.icon === id
                        ? "border-accent-500 bg-accent-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    title={label}
                  >
                    <IconComponent className="w-6 h-6 text-primary-900" />
                    <span className="text-xs text-gray-600">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={resetAppSettings}
              icon={<RotateCcw className="w-4 h-4" />}
              disabled={
                appSettings.title === defaultSettings.title &&
                appSettings.icon === defaultSettings.icon &&
                appSettings.maxMetricWeight === defaultSettings.maxMetricWeight
              }
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Card>

      {/* Status Configuration */}
      <Card>
        <CardTitle>Global Status Configuration</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Configure status IDs, labels, and colors. Factsheet records store the
          status ID, while labels and colors can be updated at any time.
        </p>

        <StatusConfigEditor
          statuses={normalizeStatuses(appSettings.statuses)}
          onChange={(statuses) => setAppSettings({ statuses })}
          addLabel="Global statuses are used by default unless a factsheet type overrides them."
        />
      </Card>

      {/* Default Page Filters */}
      <Card>
        <CardTitle>Default Page Filters</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Set default filters for each page. Users will see these filters when
          they navigate to a page without query parameters. Configure filters on
          each page and come back here to save them as defaults.
        </p>

        <div className="space-y-6">
          {/* Factsheet Filters */}
          <div className="border-b pb-6 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-primary-900 mb-2">
              Factsheet List Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultFactsheetFilters &&
              Object.keys(appSettings.defaultFactsheetFilters).length > 0 ? (
                <>
                  {appSettings.defaultFactsheetFilters.search && (
                    <p>
                      Search: "{appSettings.defaultFactsheetFilters.search}"
                    </p>
                  )}
                  {appSettings.defaultFactsheetFilters.typeFilter && (
                    <p>
                      Type Filter: "
                      {appSettings.defaultFactsheetFilters.typeFilter}"
                    </p>
                  )}
                  {appSettings.defaultFactsheetFilters.statusFilter && (
                    <p>
                      Status Filter: "
                      {appSettings.defaultFactsheetFilters.statusFilter}"
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultFactsheetFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>

          {/* Dependencies Filters */}
          <div className="border-b pb-6 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-primary-900 mb-2">
              Dependencies Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultDependenciesFilters &&
              Object.keys(appSettings.defaultDependenciesFilters).length > 0 ? (
                <>
                  {appSettings.defaultDependenciesFilters.search && (
                    <p>
                      Search: "{appSettings.defaultDependenciesFilters.search}"
                    </p>
                  )}
                  {appSettings.defaultDependenciesFilters.typeFilter && (
                    <p>
                      Type Filter: "
                      {appSettings.defaultDependenciesFilters.typeFilter}"
                    </p>
                  )}
                  {appSettings.defaultDependenciesFilters
                    .unrelatedDisplayMode && (
                    <p>
                      Unrelated Mode: "
                      {
                        appSettings.defaultDependenciesFilters
                          .unrelatedDisplayMode
                      }
                      "
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultDependenciesFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>

          {/* Matrix Filters */}
          <div className="border-b pb-6 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-primary-900 mb-2">
              Matrix View Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultMatrixFilters &&
              Object.keys(appSettings.defaultMatrixFilters).length > 0 ? (
                <>
                  {appSettings.defaultMatrixFilters.search && (
                    <p>Search: "{appSettings.defaultMatrixFilters.search}"</p>
                  )}
                  {appSettings.defaultMatrixFilters.xAxis && (
                    <p>X-Axis: "{appSettings.defaultMatrixFilters.xAxis}"</p>
                  )}
                  {appSettings.defaultMatrixFilters.yAxis && (
                    <p>Y-Axis: "{appSettings.defaultMatrixFilters.yAxis}"</p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultMatrixFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>

          {/* Spider Filters */}
          <div className="border-b pb-6 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-primary-900 mb-2">
              Spider Diagram Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultSpiderFilters &&
              Object.keys(appSettings.defaultSpiderFilters).length > 0 ? (
                <>
                  {appSettings.defaultSpiderFilters.search && (
                    <p>Search: "{appSettings.defaultSpiderFilters.search}"</p>
                  )}
                  {appSettings.defaultSpiderFilters.axisMode && (
                    <p>
                      Axis Mode: "{appSettings.defaultSpiderFilters.axisMode}"
                    </p>
                  )}
                  {appSettings.defaultSpiderFilters.selectedMetrics &&
                    (() => {
                      try {
                        const ids = JSON.parse(
                          appSettings.defaultSpiderFilters.selectedMetrics!,
                        );
                        if (Array.isArray(ids) && ids.length > 0) {
                          return <p>Dimensions: {ids.length} selected</p>;
                        }
                      } catch {
                        /* ignore */
                      }
                      return null;
                    })()}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultSpiderFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>

          {/* Scatter Plot Filters */}
          <div className="border-b pb-6 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-primary-900 mb-2">
              Scatter Plot Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultScatterFilters &&
              Object.keys(appSettings.defaultScatterFilters).length > 0 ? (
                <>
                  {appSettings.defaultScatterFilters.search && (
                    <p>Search: "{appSettings.defaultScatterFilters.search}"</p>
                  )}
                  {appSettings.defaultScatterFilters.xAxis && (
                    <p>X-Axis: "{appSettings.defaultScatterFilters.xAxis}"</p>
                  )}
                  {appSettings.defaultScatterFilters.yAxis && (
                    <p>Y-Axis: "{appSettings.defaultScatterFilters.yAxis}"</p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultScatterFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>

          {/* Impact Analysis Filters */}
          <div>
            <h4 className="font-semibold text-primary-900 mb-2">
              Impact Analysis Default
            </h4>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              {appSettings.defaultImpactFilters &&
              Object.keys(appSettings.defaultImpactFilters).length > 0 ? (
                <>
                  {appSettings.defaultImpactFilters.search && (
                    <p>Search: "{appSettings.defaultImpactFilters.search}"</p>
                  )}
                  {appSettings.defaultImpactFilters.metricFilter && (
                    <p>
                      Metric: "{appSettings.defaultImpactFilters.metricFilter}"
                    </p>
                  )}
                  {appSettings.defaultImpactFilters.calculationMode && (
                    <p>
                      Calculation Mode: "
                      {appSettings.defaultImpactFilters.calculationMode}"
                      {appSettings.defaultImpactFilters.calculationMode ===
                        "custom" &&
                        appSettings.defaultImpactFilters.customDepth &&
                        ` (${appSettings.defaultImpactFilters.customDepth} levels)`}
                    </p>
                  )}
                  {appSettings.defaultImpactFilters.sortField && (
                    <p>
                      Sort By: "{appSettings.defaultImpactFilters.sortField}"
                    </p>
                  )}
                  {appSettings.defaultImpactFilters.sortOrder && (
                    <p>
                      Sort Order: "{appSettings.defaultImpactFilters.sortOrder}"
                    </p>
                  )}
                </>
              ) : (
                <p className="text-gray-400 italic">No defaults set</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAppSettings({ defaultImpactFilters: {} });
              }}
            >
              Clear Defaults
            </Button>
          </div>
        </div>
      </Card>

      {/* Factsheet Types */}
      <Card>
        <CardTitle>Factsheet Types</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Define the types of factsheets (e.g., Use Case, Knowledge, Data
          Source). Each type has its own color.
        </p>

        {/* Existing types */}
        <div className="space-y-3 mb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleTypeReorder}
          >
            <SortableContext
              items={factsheetTypes.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {factsheetTypes.map((type) => (
                <SortableTypeItem
                  key={type.id}
                  type={type}
                  editingType={editingType}
                  editTypeData={editTypeData}
                  setEditTypeData={setEditTypeData}
                  handleEditType={handleEditType}
                  handleSaveType={handleSaveType}
                  handleCancelEditType={handleCancelEditType}
                  handleDeleteType={handleDeleteType}
                  defaultColors={defaultColors}
                  globalStatuses={normalizeStatuses(appSettings.statuses)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {factsheetTypes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No factsheet types defined yet. Add types like "Use Case",
              "Knowledge", or "Data Source".
            </div>
          )}
        </div>

        {/* Add new type */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="font-medium text-primary-900 mb-4">Add New Type</h4>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Input
                label="Type Name"
                placeholder="e.g., Use Case"
                value={newType.name}
                onChange={(e) =>
                  setNewType({ ...newType, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-900 mb-1.5">
                Color
              </label>
              <div className="flex gap-2">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewType({ ...newType, color })}
                    className={`w-8 h-8 border-2 ${
                      newType.color === color
                        ? "border-primary-900"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Button
              onClick={handleAddType}
              loading={savingType}
              disabled={!newType.name}
              icon={<Plus className="w-4 h-4" />}
            >
              Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Property Definitions */}
      <Card>
        <CardTitle>Property Definitions</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Define the properties that can be assigned to factsheets. Each
          property has a list of options that can be selected.
        </p>

        {/* Existing properties */}
        <div className="space-y-4 mb-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePropertyReorder}
          >
            <SortableContext
              items={propertyDefinitions.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {propertyDefinitions.map((prop) => {
                const options = optionsByProperty.get(prop.id) || [];
                return (
                  <SortablePropertyItem
                    key={prop.id}
                    prop={prop}
                    options={options}
                    editingPropName={editingPropName}
                    editPropNameValue={editPropNameValue}
                    setEditPropNameValue={setEditPropNameValue}
                    handleEditPropertyName={handleEditPropertyName}
                    handleSavePropertyName={handleSavePropertyName}
                    handleCancelEditPropertyName={handleCancelEditPropertyName}
                    handleDeleteProperty={handleDeleteProperty}
                    editingOption={editingOption}
                    editOptionValue={editOptionValue}
                    setEditOptionValue={setEditOptionValue}
                    handleEditOption={handleEditOption}
                    handleSaveOption={handleSaveOption}
                    handleCancelEditOption={handleCancelEditOption}
                    handleDeleteOption={handleDeleteOption}
                    newOptionForProp={newOptionForProp}
                    newOptionValue={newOptionValue}
                    setNewOptionValue={setNewOptionValue}
                    handleStartAddOption={handleStartAddOption}
                    handleAddOption={handleAddOption}
                    handleCancelAddOption={handleCancelAddOption}
                    sensors={sensors}
                    handleOptionReorder={handleOptionReorder}
                    handleWeightChange={handleUpdateOptionWeight}
                    handleDistributeWeights={handleDistributeWeights}
                    maxMetricWeight={maxMetricWeight}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

          {propertyDefinitions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No properties defined yet
            </div>
          )}
        </div>

        {/* Add new property */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="font-medium text-primary-900 mb-4">
            Add New Property
          </h4>
          <div className="space-y-4">
            <Input
              label="Property Name"
              placeholder="e.g., Complexity"
              value={newProp.name}
              onChange={(e) => setNewProp({ ...newProp, name: e.target.value })}
            />
            <Input
              label="Initial Options (comma-separated)"
              placeholder="e.g., Low, Medium, High"
              value={newProp.options}
              onChange={(e) =>
                setNewProp({ ...newProp, options: e.target.value })
              }
              hint="Enter the initial values for this property, separated by commas. You can add more options later."
            />
            <Button
              onClick={handleAddProperty}
              loading={savingProp}
              disabled={!newProp.name || !newProp.options}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Property
            </Button>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <Card>
        <CardTitle>Metrics</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Create metrics composed of one or more properties. These can be used
          to group or evaluate factsheets.
        </p>

        {/* Existing metrics */}
        <div className="space-y-3 mb-6">
          {metrics.map((m) => (
            <div key={m.id} className="p-3 bg-gray-50">
              {editingMetric === m.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editMetricName}
                      onChange={(e) => setEditMetricName(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      placeholder="Metric name"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                      Properties
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {propertyDefinitions.map((prop) => (
                        <label
                          key={prop.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={editMetricProps.includes(prop.id)}
                            onChange={() => toggleEditMetricProp(prop.id)}
                          />
                          <span>{prop.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveMetric}
                      className="text-green-600 hover:text-green-700"
                      loading={savingMetric}
                      disabled={
                        !editMetricName.trim() || editMetricProps.length === 0
                      }
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEditMetric}
                      className="text-gray-400 hover:text-gray-600"
                      disabled={savingMetric}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-primary-900">{m.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {(m.expand?.properties || [])
                        .map((p) => p.name)
                        .join(", ") || "No properties"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEditMetric(m)}
                      className="text-gray-400 hover:text-accent-500"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMetric(m.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {metrics.length === 0 && (
            <div className="text-center py-8 text-gray-500">No metrics yet</div>
          )}
        </div>

        {/* Add new metric */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="font-medium text-primary-900 mb-4">Add New Metric</h4>
          <div className="space-y-4">
            <Input
              label="Metric Name"
              placeholder="e.g., Priority Score"
              value={newMetricName}
              onChange={(e) => setNewMetricName(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-primary-900 mb-2">
                Properties
              </label>
              <div className="grid grid-cols-2 gap-2">
                {propertyDefinitions.map((prop) => (
                  <label
                    key={prop.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={newMetricProps.includes(prop.id)}
                      onChange={() => toggleMetricProp(prop.id)}
                    />
                    <span>{prop.name}</span>
                  </label>
                ))}
              </div>
              {propertyDefinitions.length === 0 && (
                <p className="text-sm text-gray-500">
                  No properties available. Define properties above first.
                </p>
              )}
            </div>
            <Button
              onClick={handleAddMetric}
              loading={savingMetric}
              disabled={!newMetricName.trim() || newMetricProps.length === 0}
              icon={<Plus className="w-4 h-4" />}
            >
              Add Metric
            </Button>
          </div>
        </div>
      </Card>

      {/* PocketBase Admin */}
      <Card>
        <CardTitle>PocketBase Admin</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Access the PocketBase admin dashboard to manage collections and data
          directly.
        </p>
        <a
          href={`${import.meta.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090"}/_/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="secondary" showArrow>
            Open Admin Dashboard
          </Button>
        </a>
      </Card>
    </div>
  );
}
