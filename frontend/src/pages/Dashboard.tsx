import { FileText, GitBranch, Grid3X3, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardTitle, Button } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import type { FactsheetType, Dependency, FactsheetExpanded } from '../types';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  href: string;
}

function StatCard({ title, value, icon, color, href }: StatCardProps) {
  return (
    <Link to={href}>
      <Card hover className="flex items-center gap-4">
        <div className={`w-12 h-12 flex items-center justify-center`} style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-primary-900">{value}</p>
        </div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { records: factsheets, loading: loadingFactsheets } = useRealtime<FactsheetExpanded>({
    collection: 'factsheets',
    sort: '-created',
    expand: 'type',
  });

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: 'factsheet_types',
    sort: 'order',
  });

  const { records: dependencies } = useRealtime<Dependency>({
    collection: 'dependencies',
  });

  const activeFactsheets = factsheets.filter((fs) => fs.status === 'active');

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Overview of your factsheets and dependencies
          </p>
        </div>
        <Link to="/factsheets/new">
          <Button showArrow>New Factsheet</Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Factsheets"
          value={factsheets.length}
          icon={<FileText className="w-6 h-6 text-white" />}
          color="#00aeef"
          href="/factsheets"
        />
        <StatCard
          title="Active"
          value={activeFactsheets.length}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="#10b981"
          href="/factsheets"
        />
        <StatCard
          title="Dependencies"
          value={dependencies.length}
          icon={<GitBranch className="w-6 h-6 text-white" />}
          color="#8b5cf6"
          href="/dependencies"
        />
        <StatCard
          title="Types"
          value={factsheetTypes.length}
          icon={<Grid3X3 className="w-6 h-6 text-white" />}
          color="#a8005c"
          href="/settings"
        />
      </div>

      {/* Factsheets by type */}
      {factsheetTypes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-primary-900 mb-4">By Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {factsheetTypes.map((type) => {
              const count = factsheets.filter((fs) => fs.type === type.id).length;
              return (
                <Card key={type.id} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="font-medium text-primary-900">{type.name}</span>
                  <span className="text-gray-500 ml-auto">{count}</span>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent factsheets */}
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-4">Recent Factsheets</h2>
        {loadingFactsheets ? (
          <Card>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 w-1/4"></div>
              <div className="h-4 bg-gray-200 w-1/2"></div>
            </div>
          </Card>
        ) : factsheets.length === 0 ? (
          <Card className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <CardTitle>No factsheets yet</CardTitle>
            <p className="text-gray-500 mt-2 mb-6">
              Get started by creating your first factsheet
            </p>
            <Link to="/factsheets/new">
              <Button showArrow>Create Factsheet</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {factsheets.slice(0, 5).map((factsheet) => {
              const typeColor = factsheet.expand?.type?.color || '#6b7280';
              const typeName = factsheet.expand?.type?.name || 'Unknown';

              return (
                <Link key={factsheet.id} to={`/factsheets/${factsheet.id}`}>
                  <Card hover className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3"
                        style={{ backgroundColor: typeColor }}
                      />
                      <div>
                        <h3 className="font-medium text-primary-900">{factsheet.name}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {factsheet.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: typeColor }}
                      >
                        {typeName}
                      </span>
                      <span
                        className={`px-2.5 py-1 text-xs font-medium ${
                          factsheet.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : factsheet.status === 'draft'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {factsheet.status}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
