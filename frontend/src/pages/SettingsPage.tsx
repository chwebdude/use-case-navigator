import { useState, useMemo } from 'react';
import { Plus, Trash2, GripVertical, Pencil, Check, X, RotateCcw } from 'lucide-react';
import * as Icons from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardTitle, Button, Input } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import { useAppSettings, AVAILABLE_ICONS, type IconId } from '../hooks/useAppSettings';
import pb from '../lib/pocketbase';
import type { FactsheetType, PropertyDefinition, PropertyOption } from '../types';

// Sortable Type Item component
interface SortableTypeItemProps {
  type: FactsheetType;
  editingType: string | null;
  editTypeData: { name: string; color: string };
  setEditTypeData: (data: { name: string; color: string }) => void;
  handleEditType: (type: FactsheetType) => void;
  handleSaveType: () => void;
  handleCancelEditType: () => void;
  handleDeleteType: (id: string) => void;
  defaultColors: string[];
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
        <>
          <div className="flex gap-2">
            {defaultColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setEditTypeData({ ...editTypeData, color })}
                className={`w-6 h-6 border-2 ${
                  editTypeData.color === color ? 'border-primary-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <input
            type="text"
            value={editTypeData.name}
            onChange={(e) => setEditTypeData({ ...editTypeData, name: e.target.value })}
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
        </>
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
    <div ref={setNodeRef} style={style} className="p-4 bg-gray-50 border border-gray-200">
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
            <div className="flex-1 font-medium text-primary-900">{prop.name}</div>
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
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Options</div>
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
              />
            ))}
          </SortableContext>
        </DndContext>

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
        ) : (
          <button
            onClick={() => handleStartAddOption(prop.id)}
            className="flex items-center gap-1 text-sm text-accent-500 hover:text-accent-600"
          >
            <Plus className="w-3 h-3" />
            Add option
          </button>
        )}
      </div>
    </div>
  );
}

const defaultColors = [
  '#00aeef', // Cerulean
  '#a8005c', // Magenta
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export default function SettingsPage() {
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Factsheet Types
  const { records: factsheetTypes, refresh: refreshTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const [newType, setNewType] = useState({ name: '', color: defaultColors[0] });
  const [savingType, setSavingType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeData, setEditTypeData] = useState({ name: '', color: '' });

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
          pb.collection('factsheet_types').update(type.id, { order: index })
        )
      );
      refreshTypes();
    } catch (err) {
      console.error('Failed to reorder types:', err);
    }
  };

  const handleAddType = async () => {
    if (!newType.name) return;

    setSavingType(true);
    try {
      await pb.collection('factsheet_types').create({
        name: newType.name,
        color: newType.color,
        order: factsheetTypes.length,
      });
      setNewType({ name: '', color: defaultColors[(factsheetTypes.length + 1) % defaultColors.length] });
      refreshTypes();
    } catch (err) {
      console.error('Failed to add factsheet type:', err);
    } finally {
      setSavingType(false);
    }
  };

  const handleEditType = (type: FactsheetType) => {
    setEditingType(type.id);
    setEditTypeData({ name: type.name, color: type.color });
  };

  const handleSaveType = async () => {
    if (!editingType || !editTypeData.name) return;

    try {
      await pb.collection('factsheet_types').update(editingType, {
        name: editTypeData.name,
        color: editTypeData.color,
      });
      setEditingType(null);
      refreshTypes();
    } catch (err) {
      console.error('Failed to update factsheet type:', err);
    }
  };

  const handleCancelEditType = () => {
    setEditingType(null);
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this factsheet type? All factsheets of this type will need to be updated.')) return;

    try {
      await pb.collection('factsheet_types').delete(id);
      refreshTypes();
    } catch (err) {
      console.error('Failed to delete factsheet type:', err);
    }
  };

  // Property Definitions
  const { records: propertyDefinitions, refresh: refreshProps } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  // Property Options
  const { records: propertyOptions, refresh: refreshOptions } = useRealtime<PropertyOption>({
    collection: 'property_options',
    sort: 'order',
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

  const [newProp, setNewProp] = useState({ name: '', options: '' });
  const [savingProp, setSavingProp] = useState(false);
  const [editingPropName, setEditingPropName] = useState<string | null>(null);
  const [editPropNameValue, setEditPropNameValue] = useState('');
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editOptionValue, setEditOptionValue] = useState('');
  const [newOptionForProp, setNewOptionForProp] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');

  const handleAddProperty = async () => {
    if (!newProp.name || !newProp.options) return;

    setSavingProp(true);
    try {
      const optionValues = newProp.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (optionValues.length === 0) {
        alert('Please add at least one option');
        return;
      }

      // Create the property definition first
      const prop = await pb.collection('property_definitions').create({
        name: newProp.name,
        order: propertyDefinitions.length,
      });

      // Create options for this property
      for (let i = 0; i < optionValues.length; i++) {
        await pb.collection('property_options').create({
          property: prop.id,
          value: optionValues[i],
          order: i,
        });
      }

      setNewProp({ name: '', options: '' });
      refreshProps();
      refreshOptions();
    } catch (err) {
      console.error('Failed to add property:', err);
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
      await pb.collection('property_definitions').update(editingPropName, {
        name: editPropNameValue.trim(),
      });
      setEditingPropName(null);
      refreshProps();
    } catch (err) {
      console.error('Failed to update property name:', err);
    }
  };

  const handleCancelEditPropertyName = () => {
    setEditingPropName(null);
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property and all its options?')) return;

    try {
      // Delete all options for this property first
      const options = optionsByProperty.get(id) || [];
      for (const opt of options) {
        await pb.collection('property_options').delete(opt.id);
      }
      // Then delete the property
      await pb.collection('property_definitions').delete(id);
      refreshProps();
      refreshOptions();
    } catch (err) {
      console.error('Failed to delete property:', err);
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
      await pb.collection('property_options').update(editingOption, {
        value: editOptionValue.trim(),
      });
      setEditingOption(null);
      refreshOptions();
    } catch (err) {
      console.error('Failed to update option:', err);
    }
  };

  const handleCancelEditOption = () => {
    setEditingOption(null);
  };

  const handleDeleteOption = async (optionId: string, propertyId: string) => {
    const options = optionsByProperty.get(propertyId) || [];
    if (options.length <= 1) {
      alert('Cannot delete the last option. Delete the property instead.');
      return;
    }

    try {
      await pb.collection('property_options').delete(optionId);
      refreshOptions();
    } catch (err) {
      console.error('Failed to delete option:', err);
    }
  };

  // Add new option to existing property
  const handleStartAddOption = (propId: string) => {
    setNewOptionForProp(propId);
    setNewOptionValue('');
  };

  const handleAddOption = async () => {
    if (!newOptionForProp || !newOptionValue.trim()) return;

    try {
      const options = optionsByProperty.get(newOptionForProp) || [];
      await pb.collection('property_options').create({
        property: newOptionForProp,
        value: newOptionValue.trim(),
        order: options.length,
      });
      setNewOptionForProp(null);
      setNewOptionValue('');
      refreshOptions();
    } catch (err) {
      console.error('Failed to add option:', err);
    }
  };

  const handleCancelAddOption = () => {
    setNewOptionForProp(null);
    setNewOptionValue('');
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
          pb.collection('property_definitions').update(prop.id, { order: index })
        )
      );
      refreshProps();
    } catch (err) {
      console.error('Failed to reorder properties:', err);
    }
  };

  // Handle option reorder within a property
  const handleOptionReorder = async (propertyId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const options = optionsByProperty.get(propertyId) || [];
    const oldIndex = options.findIndex((o) => o.id === active.id);
    const newIndex = options.findIndex((o) => o.id === over.id);
    const reordered = arrayMove(options, oldIndex, newIndex);

    try {
      await Promise.all(
        reordered.map((opt, index) =>
          pb.collection('property_options').update(opt.id, { order: index })
        )
      );
      refreshOptions();
    } catch (err) {
      console.error('Failed to reorder options:', err);
    }
  };

  // App Settings
  const { settings: appSettings, setSettings: setAppSettings, resetSettings: resetAppSettings, defaultSettings } = useAppSettings();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure application and factsheet settings</p>
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

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-primary-900 mb-3">
              Application Icon
            </label>
            <div className="grid grid-cols-6 gap-3">
              {AVAILABLE_ICONS.map(({ id, label }) => {
                const IconComponent = Icons[id] as React.ComponentType<{ className?: string }>;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAppSettings({ icon: id as IconId })}
                    className={`flex flex-col items-center gap-2 p-3 border-2 transition-colors ${
                      appSettings.icon === id
                        ? 'border-accent-500 bg-accent-50'
                        : 'border-gray-200 hover:border-gray-300'
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
              disabled={appSettings.title === defaultSettings.title && appSettings.icon === defaultSettings.icon}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Card>

      {/* Factsheet Types */}
      <Card>
        <CardTitle>Factsheet Types</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Define the types of factsheets (e.g., Use Case, Knowledge, Data Source). Each type has its own color.
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
                />
              ))}
            </SortableContext>
          </DndContext>

          {factsheetTypes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No factsheet types defined yet. Add types like "Use Case", "Knowledge", or "Data Source".
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
                onChange={(e) => setNewType({ ...newType, name: e.target.value })}
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
                      newType.color === color ? 'border-primary-900' : 'border-transparent'
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
          Define the properties that can be assigned to factsheets. Each property has a list of options that can be selected.
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
          <h4 className="font-medium text-primary-900 mb-4">Add New Property</h4>
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
              onChange={(e) => setNewProp({ ...newProp, options: e.target.value })}
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

      {/* PocketBase Admin */}
      <Card>
        <CardTitle>PocketBase Admin</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Access the PocketBase admin dashboard to manage collections and data directly.
        </p>
        <a
          href={`${import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'}/_/`}
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
