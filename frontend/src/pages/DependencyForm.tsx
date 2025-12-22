import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, Button, Input, Select } from '../components/ui';
import { Textarea } from '../components/ui/Input';
import { useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { UseCase } from '../types';

const typeOptions = [
  { value: 'data', label: 'Data' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'system', label: 'System' },
];

export default function DependencyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState('data');
  const [description, setDescription] = useState('');
  const [dependsOn, setDependsOn] = useState('');

  const { records: useCases } = useRealtime<UseCase>({
    collection: 'use_cases',
  });

  const useCaseOptions = [
    { value: '', label: 'None' },
    ...useCases
      .filter((uc) => uc.id !== id)
      .map((uc) => ({ value: uc.id, label: uc.name })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await pb.collection('dependencies').create({
        use_case: id,
        name: name.trim(),
        type,
        description: description.trim() || null,
        depends_on: dependsOn || null,
      });
      navigate(`/use-cases/${id}`);
    } catch (err) {
      console.error('Failed to create dependency:', err);
      setError('Failed to create dependency');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/use-cases/${id}`}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-primary-900">Add Dependency</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer Database"
            required
          />

          <Select
            label="Type"
            options={typeOptions}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dependency..."
            rows={3}
          />

          <Select
            label="Depends On (Use Case)"
            options={useCaseOptions}
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            hint="Optional: Link this dependency to another use case"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Dependency'}
            </Button>
            <Link to={`/use-cases/${id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
