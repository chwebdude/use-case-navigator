import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Plus, GitBranch } from 'lucide-react';
import { Card, CardTitle, Button, Badge } from '../components/ui';
import { useRecord, useRealtime } from '../hooks/useRealtime';
import pb from '../lib/pocketbase';
import type { UseCase, Dependency, UseCasePropertyExpanded } from '../types';

export default function UseCaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { record: useCase, loading } = useRecord<UseCase>('use_cases', id);
  const { records: dependencies } = useRealtime<Dependency>({
    collection: 'dependencies',
    filter: `use_case = "${id}"`,
  });
  const { records: properties } = useRealtime<UseCasePropertyExpanded>({
    collection: 'use_case_properties',
    filter: `use_case = "${id}"`,
    expand: 'property',
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this use case?')) return;

    try {
      await pb.collection('use_cases').delete(id!);
      navigate('/use-cases');
    } catch (err) {
      console.error('Failed to delete use case:', err);
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

  const getDependencyTypeVariant = (type: string) => {
    switch (type) {
      case 'data':
        return 'info';
      case 'knowledge':
        return 'success';
      case 'system':
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

  if (!useCase) {
    return (
      <Card className="text-center py-12">
        <h2 className="text-lg font-medium text-primary-900">Use case not found</h2>
        <p className="text-gray-500 mt-2">The requested use case does not exist.</p>
        <Link to="/use-cases">
          <Button variant="secondary" className="mt-4">
            Back to Use Cases
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/use-cases">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-primary-900">{useCase.name}</h1>
              <Badge variant={getStatusVariant(useCase.status)}>{useCase.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/use-cases/${id}/edit`}>
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
          {useCase.description || 'No description provided'}
        </p>
      </Card>

      {/* Dependencies */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Dependencies</CardTitle>
          <Link to={`/use-cases/${id}/dependencies/new`}>
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
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary-900">{dep.name}</span>
                    <Badge variant={getDependencyTypeVariant(dep.type)} size="sm">
                      {dep.type}
                    </Badge>
                  </div>
                  {dep.description && (
                    <p className="text-sm text-gray-500 mt-1">{dep.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Properties */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Properties</CardTitle>
          <Link to={`/use-cases/${id}/properties`}>
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
                <p className="font-medium text-primary-900">{prop.value}</p>
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
            {new Date(useCase.created).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Updated:</span>{' '}
            {new Date(useCase.updated).toLocaleDateString()}
          </div>
        </div>
      </Card>
    </div>
  );
}
