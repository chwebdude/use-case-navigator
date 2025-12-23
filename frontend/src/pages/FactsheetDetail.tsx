import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, GitBranch } from 'lucide-react';
import { Card, CardTitle, Button, Badge } from '../components/ui';
import { useRecord, useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { Factsheet, FactsheetType, FactsheetPropertyExpanded, DependencyExpanded } from '../types';

export default function FactsheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { record: factsheet, loading } = useRecord<Factsheet>('factsheets', id);
  const { record: factsheetType } = useRecord<FactsheetType>(
    'factsheet_types',
    factsheet?.type
  );

  const { records: dependencies } = useRealtime<DependencyExpanded>({
    collection: 'dependencies',
    filter: `factsheet = "${id}"`,
    expand: 'depends_on',
  });

  const { records: properties } = useRealtime<FactsheetPropertyExpanded>({
    collection: 'factsheet_properties',
    filter: `factsheet = "${id}"`,
    expand: 'property,option',
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this factsheet?')) return;

    try {
      await pb.collection('factsheets').delete(id!);
      navigate('/factsheets');
    } catch (err) {
      console.error('Failed to delete factsheet:', err);
    }
  };

  const handleDeleteDependency = async (depId: string) => {
    if (!confirm('Remove this dependency?')) return;
    try {
      await pb.collection('dependencies').delete(depId);
    } catch (err) {
      console.error('Failed to delete dependency:', err);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'default';
      case 'archived':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 w-1/3"></div>
            <div className="h-4 bg-gray-200 w-2/3"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!factsheet) {
    return (
      <Card className="text-center py-12">
        <h2 className="text-lg font-medium text-primary-900">Factsheet not found</h2>
        <p className="text-gray-500 mt-2">The requested factsheet does not exist.</p>
        <Link to="/factsheets">
          <Button variant="secondary" className="mt-4">
            Back to Factsheets
          </Button>
        </Link>
      </Card>
    );
  }

  const typeColor = factsheetType?.color || '#6b7280';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/factsheets">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4"
                style={{ backgroundColor: typeColor }}
              />
              <h1 className="text-2xl font-bold text-primary-900">{factsheet.name}</h1>
              {factsheetType && (
                <span
                  className="px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: typeColor }}
                >
                  {factsheetType.name}
                </span>
              )}
              <Badge variant={getStatusVariant(factsheet.status)}>{factsheet.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/factsheets/${id}/edit`}>
            <Button variant="secondary" icon={<Edit className="w-4 h-4" />}>
              Edit
            </Button>
          </Link>
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardTitle>Description</CardTitle>
        <p className="text-gray-600 mt-2">
          {factsheet.description || 'No description provided'}
        </p>
      </Card>

      {/* Dependencies */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Dependencies</CardTitle>
          <Link to={`/factsheets/${id}/dependencies/new`}>
            <Button size="sm" variant="secondary" icon={<Plus className="w-4 h-4" />}>
              Add Dependency
            </Button>
          </Link>
        </div>

        {dependencies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <GitBranch className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No dependencies added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between p-3 bg-gray-50"
              >
                <div>
                  <Link
                    to={`/factsheets/${dep.depends_on}`}
                    className="font-medium text-primary-900 hover:text-accent-500"
                  >
                    {dep.expand?.depends_on?.name || 'Unknown Factsheet'}
                  </Link>
                  {dep.description && (
                    <p className="text-sm text-gray-500 mt-1">{dep.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDependency(dep.id)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Properties */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Properties</CardTitle>
          <Link to={`/factsheets/${id}/properties`}>
            <Button size="sm" variant="secondary" icon={<Edit className="w-4 h-4" />}>
              Edit Properties
            </Button>
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No properties configured yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {properties.map((prop) => (
              <div key={prop.id} className="p-3 bg-gray-50">
                <p className="text-sm text-gray-500">
                  {prop.expand?.property?.name || 'Property'}
                </p>
                <p className="font-medium text-primary-900">
                  {prop.expand?.option?.value || 'Not set'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Metadata */}
      <Card padding="sm">
        <div className="flex gap-8 text-sm text-gray-500">
          <div>
            <span className="font-medium">Created:</span>{' '}
            {new Date(factsheet.created).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Updated:</span>{' '}
            {new Date(factsheet.updated).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </div>
  );
}
