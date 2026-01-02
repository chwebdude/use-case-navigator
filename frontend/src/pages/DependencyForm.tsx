import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, Button, Select } from '../components/ui';
import { Textarea } from '../components/ui/Input';
import { useRealtime, useRecord } from '../hooks/useRealtime';
import { useChangeLog } from '../hooks/useChangeLog';
import pb from '../lib/pocketbase';
import type { Factsheet, FactsheetExpanded } from '../types';

export default function DependencyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [dependsOn, setDependsOn] = useState('');
  const [description, setDescription] = useState('');

  const { record: sourceFactsheet } = useRecord<Factsheet>('factsheets', id);

  const { records: factsheets } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    expand: 'type',
  });

  const { logDependencyAdded } = useChangeLog();

  const factsheetOptions = [
    { value: '', label: 'Select a factsheet...' },
    ...factsheets
      .filter((fs) => fs.id !== id)
      .map((fs) => ({
        value: fs.id,
        label: `${fs.name} (${fs.expand?.type?.name || 'Unknown'})`,
      })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dependsOn) {
      setError('Please select a factsheet to depend on');
      return;
    }

    setSaving(true);
    setError('');

    const descriptionTrimmed = description.trim() || undefined;
    const targetFactsheet = factsheets.find((fs) => fs.id === dependsOn);

    try {
      await pb.collection('dependencies').create({
        factsheet: id,
        depends_on: dependsOn,
        description: descriptionTrimmed || null,
      });

      // Log the change for both factsheets
      if (sourceFactsheet && targetFactsheet) {
        await logDependencyAdded(
          id!,
          sourceFactsheet.name,
          dependsOn,
          targetFactsheet.name,
          descriptionTrimmed
        );
      }

      navigate(`/factsheets/${id}`);
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
        <Link to={`/factsheets/${id}`}>
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

          <Select
            label="Depends On"
            options={factsheetOptions}
            value={dependsOn}
            onChange={(e) => setDependsOn(e.target.value)}
            hint="Select the factsheet this one depends on"
          />

          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dependency relationship..."
            rows={3}
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Dependency'}
            </Button>
            <Link to={`/factsheets/${id}`}>
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
