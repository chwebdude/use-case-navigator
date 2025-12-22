import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Card, CardTitle, Button, Input } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { FactsheetType, PropertyDefinition } from '../types';

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

  const [newProp, setNewProp] = useState({ name: '', options: '' });
  const [savingProp, setSavingProp] = useState(false);

  const handleAddProperty = async () => {
    if (!newProp.name || !newProp.options) return;

    setSavingProp(true);
    try {
      const options = newProp.options.split(',').map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) {
        alert('Please add at least one option');
        return;
      }

      await pb.collection('property_definitions').create({
        name: newProp.name,
        options,
        order: propertyDefinitions.length,
      });
      setNewProp({ name: '', options: '' });
      refreshProps();
    } catch (err) {
      console.error('Failed to add property:', err);
    } finally {
      setSavingProp(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      await pb.collection('property_definitions').delete(id);
      refreshProps();
    } catch (err) {
      console.error('Failed to delete property:', err);
    }
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
                onClick={() => handleDeleteType(type.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
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
          Define the properties that can be assigned to factsheets. Properties are always a selection from a list of options.
        </p>

        {/* Existing properties */}
        <div className="space-y-3 mb-6">
          {propertyDefinitions.map((prop) => (
            <div
              key={prop.id}
              className="flex items-center gap-3 p-3 bg-gray-50"
            >
              <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
              <div className="flex-1">
                <div className="font-medium text-primary-900">{prop.name}</div>
                <div className="text-sm text-gray-500">
                  {Array.isArray(prop.options) ? prop.options.join(', ') : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteProperty(prop.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

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
              label="Options (comma-separated)"
              placeholder="e.g., Low, Medium, High"
              value={newProp.options}
              onChange={(e) => setNewProp({ ...newProp, options: e.target.value })}
              hint="Enter the available values for this property, separated by commas"
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
