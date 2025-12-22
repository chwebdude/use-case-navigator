import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, Button, Input, Select } from '../components/ui';
import { Textarea } from '../components/ui/Input';
import { useRecord } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { UseCase } from '../types';

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function UseCaseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { record: existingUseCase, loading: loadingRecord } = useRecord<UseCase>(
    'use_cases',
    id
  );

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingUseCase) {
      setFormData({
        name: existingUseCase.name,
        description: existingUseCase.description || '',
        status: existingUseCase.status,
      });
    }
  }, [existingUseCase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEdit && id) {
        await pb.collection('use_cases').update(id, formData);
      } else {
        await pb.collection('use_cases').create({
          ...formData,
          owner: pb.authStore.model?.id,
        });
      }
      navigate('/use-cases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save use case');
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
          {isEdit ? 'Edit Use Case' : 'New Use Case'}
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

          <Input
            label="Name"
            placeholder="Enter use case name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe the use case..."
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
              {isEdit ? 'Save Changes' : 'Create Use Case'}
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
