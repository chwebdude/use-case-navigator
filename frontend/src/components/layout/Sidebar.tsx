import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  GitBranch,
  Grid3X3,
  Settings,
  Database,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const mainNavItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/use-cases', icon: <Briefcase className="w-5 h-5" />, label: 'Use Cases' },
  { to: '/dependencies', icon: <GitBranch className="w-5 h-5" />, label: 'Dependencies' },
  { to: '/matrix', icon: <Grid3X3 className="w-5 h-5" />, label: 'Matrix View' },
];

const resourceNavItems: NavItem[] = [
  { to: '/data-sources', icon: <Database className="w-5 h-5" />, label: 'Data Sources' },
  { to: '/knowledge', icon: <BookOpen className="w-5 h-5" />, label: 'Knowledge Base' },
];

const settingsNavItems: NavItem[] = [
  { to: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium mx-2 transition-colors ${
                isActive
                  ? 'bg-accent-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-primary-900'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="flex-1 py-6 overflow-y-auto">
        <NavSection items={mainNavItems} />
        <NavSection title="Resources" items={resourceNavItems} />
        <NavSection title="System" items={settingsNavItems} />
      </div>
    </aside>
  );
}
