import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import { Card, Button, Select, Badge } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import type { FactsheetType, FactsheetExpanded } from '../types';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export default function FactsheetList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { records: factsheets, loading } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    sort: '-created',
    expand: 'type',
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...factsheetTypes.map((t) => ({ value: t.id, label: t.name })),
  ];

  const filteredFactsheets = factsheets.filter((fs) => {
    const matchesSearch =
      search === '' ||
      fs.name.toLowerCase().includes(search.toLowerCase()) ||
      fs.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === '' || fs.status === statusFilter;
    const matchesType = typeFilter === '' || fs.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
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
          <h1 className="text-2xl font-bold text-primary-900">Factsheets</h1>
          <p className="text-gray-500 mt-1">
            Manage and track your factsheets
          </p>
        </div>
        <Link to="/factsheets/new">
          <Button icon={<Plus className="w-4 h-4" />}>New Factsheet</Button>
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
                placeholder="Search factsheets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="w-48">
            <Select
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Factsheet list */}
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
      ) : filteredFactsheets.length === 0 ? (
        <Card className="text-center py-16">
          {search || statusFilter || typeFilter ? (
            <>
              <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">No matching factsheets</h3>
              <p className="text-gray-500 mt-2">
                Try adjusting your search or filter criteria
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('');
                  setTypeFilter('');
                }}
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <Plus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-primary-900">No factsheets yet</h3>
              <p className="text-gray-500 mt-2">
                Get started by creating your first factsheet
              </p>
              <Link to="/factsheets/new">
                <Button className="mt-4" showArrow>
                  Create Factsheet
                </Button>
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFactsheets.map((factsheet) => {
            const typeColor = factsheet.expand?.type?.color || '#6b7280';
            const typeName = factsheet.expand?.type?.name || 'Unknown';

            return (
              <Link key={factsheet.id} to={`/factsheets/${factsheet.id}`}>
                <Card hover>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3"
                          style={{ backgroundColor: typeColor }}
                        />
                        <h3 className="text-lg font-medium text-primary-900">
                          {factsheet.name}
                        </h3>
                        <span
                          className="px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: typeColor }}
                        >
                          {typeName}
                        </span>
                        <Badge variant={getStatusVariant(factsheet.status)} size="sm">
                          {factsheet.status}
                        </Badge>
                      </div>
                      <p className="text-gray-500 mt-2 line-clamp-2">
                        {factsheet.description || 'No description provided'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
                    <span>Created {new Date(factsheet.created).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Updated {new Date(factsheet.updated).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
