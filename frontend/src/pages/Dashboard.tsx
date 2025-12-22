import { Briefcase, Database, BookOpen, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardTitle, Button } from '../components/ui';
import { useRealtime } from '../hooks/useRealtime';
import type { UseCase, Dependency } from '../types';

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
        <div className={`w-12 h-12 flex items-center justify-center ${color}`}>
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
  const { records: useCases, loading: loadingUseCases } = useRealtime<UseCase>({
    collection: 'use_cases',
    sort: '-created',
  });

  const { records: dependencies } = useRealtime<Dependency>({
    collection: 'dependencies',
  });

  const activeUseCases = useCases.filter((uc) => uc.status === 'active');
  const dataDeps = dependencies.filter((d) => d.type === 'data');
  const knowledgeDeps = dependencies.filter((d) => d.type === 'knowledge');

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Overview of your AI use cases and dependencies
          </p>
        </div>
        <Link to="/use-cases/new">
          <Button showArrow>New Use Case</Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Use Cases"
          value={useCases.length}
          icon={<Briefcase className="w-6 h-6 text-white" />}
          color="bg-accent-500"
          href="/use-cases"
        />
        <StatCard
          title="Active Use Cases"
          value={activeUseCases.length}
          icon={<TrendingUp className="w-6 h-6 text-white" />}
          color="bg-green-500"
          href="/use-cases?status=active"
        />
        <StatCard
          title="Data Sources"
          value={dataDeps.length}
          icon={<Database className="w-6 h-6 text-white" />}
          color="bg-blue-500"
          href="/data-sources"
        />
        <StatCard
          title="Knowledge Items"
          value={knowledgeDeps.length}
          icon={<BookOpen className="w-6 h-6 text-white" />}
          color="bg-purple-500"
          href="/knowledge"
        />
      </div>

      {/* Recent use cases */}
      <div>
        <h2 className="text-lg font-semibold text-primary-900 mb-4">Recent Use Cases</h2>
        {loadingUseCases ? (
          <Card>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 w-1/4"></div>
              <div className="h-4 bg-gray-200 w-1/2"></div>
            </div>
          </Card>
        ) : useCases.length === 0 ? (
          <Card className="text-center py-12">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <CardTitle>No use cases yet</CardTitle>
            <p className="text-gray-500 mt-2 mb-6">
              Get started by creating your first AI use case
            </p>
            <Link to="/use-cases/new">
              <Button showArrow>Create Use Case</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4">
            {useCases.slice(0, 5).map((useCase) => (
              <Link key={useCase.id} to={`/use-cases/${useCase.id}`}>
                <Card hover className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-primary-900">{useCase.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {useCase.description || 'No description'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium ${
                      useCase.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : useCase.status === 'draft'
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {useCase.status}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
