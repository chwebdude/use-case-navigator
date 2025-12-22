import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, Button, Select, Badge } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import type { UseCase } from '../types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function UseCaseList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { records: useCases, loading } = useRealtime<UseCase>({
    collection: 'use_cases',
    sort: '-created',
  });

  const filteredUseCases = useCases.filter((uc) => {
    const matchesSearch =
      search === '' ||
      uc.name.toLowerCase().includes(search.toLowerCase()) ||
      uc.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || uc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Use Cases</h1>
          <p className="text-gray-500 mt-1">
            Manage and track your AI use cases
          </p>
        </div>
        <Link to="/use-cases/new">
          <Button icon={<Plus className="w-4 h-4" />}>New Use Case</Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search use cases..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-48">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="Filter by status"
            />
          </div>
        </div>
      </Card>

      {/* Use case list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 w-1/3"></div>
                <div className="h-4 bg-gray-200 w-2/3"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredUseCases.length === 0 ? (
        <Card className="text-center py-16">
          {search || statusFilter ? (
            <>
              <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">No matching use cases</h3>
              <p className="text-gray-500 mt-2">
                Try adjusting your search or filter criteria
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <Plus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">No use cases yet</h3>
              <p className="text-gray-500 mt-2">
                Get started by creating your first AI use case
              </p>
              <Link to="/use-cases/new">
                <Button className="mt-4" showArrow>
                  Create Use Case
                </Button>
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredUseCases.map((useCase) => (
            <Link key={useCase.id} to={`/use-cases/${useCase.id}`}>
              <Card hover>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-primary-900">
                        {useCase.name}
                      </h3>
                      <Badge variant={getStatusVariant(useCase.status)} size="sm">
                        {useCase.status}
                      </Badge>
                    </div>
                    <p className="text-gray-500 mt-2 line-clamp-2">
                      {useCase.description || 'No description provided'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                  <span>Created {new Date(useCase.created).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Updated {new Date(useCase.updated).toLocaleDateString()}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
