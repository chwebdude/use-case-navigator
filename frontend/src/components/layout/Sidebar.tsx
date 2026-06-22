import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  Grid3X3,
  Radar,
  Settings,
  ScatterChart,
  TrendingUp,
  MessageSquare,
} from "lucide-react";
import { useUser } from "../../hooks/useUser";

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

interface NavSectionProps {
  title?: string;
  items: NavItem[];
  isCollapsed: boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
}

const mainNavItems: NavItem[] = [
  {
    to: "/",
    icon: <LayoutDashboard className="w-5 h-5" />,
    label: "Dashboard",
  },
  {
    to: "/factsheets",
    icon: <FileText className="w-5 h-5" />,
    label: "Factsheets",
  },
  {
    to: "/dependencies",
    icon: <GitBranch className="w-5 h-5" />,
    label: "Dependencies",
  },
  {
    to: "/matrix",
    icon: <Grid3X3 className="w-5 h-5" />,
    label: "Matrix View",
  },
  {
    to: "/spider",
    icon: <Radar className="w-5 h-5" />,
    label: "Spider Diagram",
  },
  {
    to: "/scatter",
    icon: <ScatterChart className="w-5 h-5" />,
    label: "Scatter Plot",
  },
  {
    to: "/impact",
    icon: <TrendingUp className="w-5 h-5" />,
    label: "Impact Analysis",
  },
  {
    to: "/chat",
    icon: <MessageSquare className="w-5 h-5" />,
    label: "Chat",
  },
];

const settingsNavItems: NavItem[] = [
  {
    to: "/settings",
    icon: <Settings className="w-5 h-5" />,
    label: "Settings",
  },
];

function NavSection({ title, items, isCollapsed }: NavSectionProps) {
  return (
    <div className="mb-6">
      {title && !isCollapsed && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
      )}
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-2.5 text-sm font-medium mx-2 transition-colors ${
                isActive
                  ? "bg-accent-500 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-primary-900"
              }`
            }
          >
            {item.icon}
            {!isCollapsed && item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar({ isCollapsed }: SidebarProps) {
  const { isPowerUser } = useUser();

  return (
    <aside
      className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-[width] duration-200 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex-1 py-6 overflow-y-auto">
        <NavSection items={mainNavItems} isCollapsed={isCollapsed} />
        {isPowerUser && (
          <NavSection
            title="System"
            items={settingsNavItems}
            isCollapsed={isCollapsed}
          />
        )}
      </div>
    </aside>
  );
}
