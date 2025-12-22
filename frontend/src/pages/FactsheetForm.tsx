import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, Button, Input, Select } from '../components/ui';
import { Textarea } from '../components/ui/Input';
import { useRecord, useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { Factsheet, FactsheetType } from '../types';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function FactsheetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { record: existingFactsheet, loading: loadingRecord } = useRecord<Factsheet>(
    'factsheets',
    id
  );

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const typeOptions = factsheetTypes.map((t) => ({ value: t.id, label: t.name }));

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingFactsheet) {
      setFormData({
        name: existingFactsheet.name,
        description: existingFactsheet.description || '',
        type: existingFactsheet.type,
        status: existingFactsheet.status,
      });
    }
  }, [existingFactsheet]);

  // Set default type when types are loaded
  useEffect(() => {
    if (!isEdit && factsheetTypes.length > 0 && !formData.type) {
      setFormData((prev) => ({ ...prev, type: factsheetTypes[0].id }));
    }
  }, [factsheetTypes, isEdit, formData.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.type) {
      setError('Please select a factsheet type');
      return;
    }

    setSaving(true);

    try {
      if (isEdit && id) {
        await pb.collection('factsheets').update(id, formData);
      } else {
        await pb.collection('factsheets').create(formData);
      }
      navigate('/factsheets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save factsheet');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingRecord) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 w-1/3"></div>
            <div className="h-10 bg-gray-200"></div>
            <div className="h-32 bg-gray-200"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (factsheetTypes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <h1 className="text-2xl font-bold text-primary-900">New Factsheet</h1>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-primary-900">No factsheet types defined</h3>
          <p className="text-gray-500 mt-2">
            Please create at least one factsheet type in Settings before creating a factsheet.
          </p>
          <Button className="mt-4" onClick={() => navigate('/settings')}>
            Go to Settings
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
        <h1 className="text-2xl font-bold text-primary-900">
          {isEdit ? 'Edit Factsheet' : 'New Factsheet'}
        </h1>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Select
            label="Type"
            options={typeOptions}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          />

          <Input
            label="Name"
            placeholder="Enter factsheet name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe the factsheet..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={4}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          />

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
            >
              {isEdit ? 'Save Changes' : 'Create Factsheet'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
