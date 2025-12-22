import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Card, CardTitle, Button, Input, Select } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { PropertyDefinition } from '../types';

const typeOptions = [
  { value: 'enum', label: 'Enum (List of options)' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
];

export default function SettingsPage() {
  const { records: propertyDefinitions, refresh } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const [newProp, setNewProp] = useState({
    name: '',
    type: 'enum',
    options: '',
  });
  const [saving, setSaving] = useState(false);

  const handleAddProperty = async () => {
    if (!newProp.name) return;

    setSaving(true);
    try {
      await pb.collection('property_definitions').create({
        name: newProp.name,
        type: newProp.type,
        options: newProp.type === 'enum' ? newProp.options.split(',').map((o) => o.trim()) : null,
        order: propertyDefinitions.length,
      });
      setNewProp({ name: '', type: 'enum', options: '' });
      refresh();
    } catch (err) {
      console.error('Failed to add property:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      await pb.collection('property_definitions').delete(id);
      refresh();
    } catch (err) {
      console.error('Failed to delete property:', err);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure property definitions for use cases</p>
      </div>

      {/* Property Definitions */}
      <Card>
        <CardTitle>Property Definitions</CardTitle>
        <p className="text-sm text-gray-500 mt-1 mb-6">
          Define the properties that can be assigned to use cases. Enum properties can be used
          in the matrix view.
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
                  {prop.type}
                  {prop.type === 'enum' && prop.options && (
                    <span className="ml-2">
                      ({(prop.options as string[]).join(', ')})
                    </span>
                  )}
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Property Name"
              placeholder="e.g., Complexity"
              value={newProp.name}
              onChange={(e) => setNewProp({ ...newProp, name: e.target.value })}
            />
            <Select
              label="Type"
              options={typeOptions}
              value={newProp.type}
              onChange={(e) => setNewProp({ ...newProp, type: e.target.value })}
            />
          </div>
          {newProp.type === 'enum' && (
            <div className="mt-4">
              <Input
                label="Options (comma-separated)"
                placeholder="e.g., Low, Medium, High"
                value={newProp.options}
                onChange={(e) => setNewProp({ ...newProp, options: e.target.value })}
              />
            </div>
          )}
          <div className="mt-4">
            <Button
              onClick={handleAddProperty}
              loading={saving}
              disabled={!newProp.name}
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
