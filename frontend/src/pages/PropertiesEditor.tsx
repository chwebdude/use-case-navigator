import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, Button, Select } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { PropertyDefinition, FactsheetProperty } from '../types';

export default function PropertiesEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  const { records: propertyDefinitions } = useRealtime<PropertyDefinition>({
    collection: 'property_definitions',
    sort: 'order',
  });

  const { records: existingProperties } = useRealtime<FactsheetProperty>({
    collection: 'factsheet_properties',
    filter: `factsheet = "${id}"`,
  });

  // Initialize values from existing properties
  useEffect(() => {
    const initial: Record<string, string> = {};
    existingProperties.forEach((prop) => {
      initial[prop.property] = prop.value;
    });
    setValues(initial);
  }, [existingProperties]);

  const handleValueChange = (propertyId: string, value: string) => {
    setValues((prev) => ({ ...prev, [propertyId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // For each property definition, create or update the value
      for (const propDef of propertyDefinitions) {
        const value = values[propDef.id];
        const existing = existingProperties.find((p) => p.property === propDef.id);

        if (value && value.trim()) {
          if (existing) {
            // Update existing
            await pb.collection('factsheet_properties').update(existing.id, {
              value: value.trim(),
            });
          } else {
            // Create new
            await pb.collection('factsheet_properties').create({
              factsheet: id,
              property: propDef.id,
              value: value.trim(),
            });
          }
        } else if (existing) {
          // Delete if value is empty but record exists
          await pb.collection('factsheet_properties').delete(existing.id);
        }
      }

      navigate(`/factsheets/${id}`);
    } catch (err) {
      console.error('Failed to save properties:', err);
      setError('Failed to save properties');
    } finally {
      setSaving(false);
    }
  };

  const getOptionsForProperty = (propDef: PropertyDefinition) => {
    const opts = Array.isArray(propDef.options) ? propDef.options : [];
    return [
      { value: '', label: 'Select...' },
      ...opts.map((opt: string) => ({ value: opt, label: opt })),
    ];
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/factsheets/${id}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-primary-900">Edit Properties</h1>
      </div>

      <Card>
        {propertyDefinitions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No property definitions configured yet.</p>
            <Link to="/settings">
              <Button variant="secondary">Go to Settings</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {propertyDefinitions.map((propDef) => (
              <Select
                key={propDef.id}
                label={propDef.name}
                options={getOptionsForProperty(propDef)}
                value={values[propDef.id] || ''}
                onChange={(e) => handleValueChange(propDef.id, e.target.value)}
              />
            ))}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving} icon={<Save className="w-4 h-4" />}>
                {saving ? 'Saving...' : 'Save Properties'}
              </Button>
              <Link to={`/factsheets/${id}`}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
