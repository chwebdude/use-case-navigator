import { useState, useMemo } from 'react';
import { Plus, Trash2, GripVertical, Pencil, Check, X } from 'lucide-react';
import { Card, CardTitle, Button, Input } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { FactsheetType, PropertyDefinition, PropertyOption } from '../types';

const defaultColors = [
  '#00aeef', // E+H Cerulean
  '#a8005c', // E+H Magenta
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export default function SettingsPage() {
  // Factsheet Types
  const { records: factsheetTypes, refresh: refreshTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const [newType, setNewType] = useState({ name: '', color: defaultColors[0] });
  const [savingType, setSavingType] = useState(false);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeData, setEditTypeData] = useState({ name: '', color: '' });

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

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure factsheet types and properties</p>
      </div>

      {/* Factsheet Types */}
      <Card>
        <CardTitle>Factsheet Types</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Define the types of factsheets (e.g., Use Case, Knowledge, Data Source). Each type has its own color.
        </p>

        {/* Existing types */}
        <div className="space-y-3 mb-6">
          {factsheetTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center gap-3 p-3 bg-gray-50"
            >
              <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
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
          ))}

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
          {propertyDefinitions.map((prop) => {
            const options = optionsByProperty.get(prop.id) || [];
            return (
              <div key={prop.id} className="p-4 bg-gray-50 border border-gray-200">
                {/* Property name row */}
                <div className="flex items-center gap-3 mb-3">
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
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
                  {options.map((opt) => (
                    <div key={opt.id} className="flex items-center gap-2">
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
                            onClick={() => handleDeleteOption(opt.id, prop.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}

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
          })}

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
