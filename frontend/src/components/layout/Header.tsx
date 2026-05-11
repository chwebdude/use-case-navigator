import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { useAppSettings, type IconId } from '../../hooks/useAppSettings';
import UsernamePrompt from '../UsernamePrompt';

function AppIcon({ iconId, className }: { iconId: IconId; className?: string }) {
  const IconComponent = Icons[iconId] as React.ComponentType<{ className?: string }>;
  return IconComponent ? <IconComponent className={className} /> : <Icons.Cpu className={className} />;
}

interface HeaderProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function Header({
  isSidebarCollapsed,
  onToggleSidebar,
}: HeaderProps) {
  const { username, setUsername } = useUser();
  const { settings } = useAppSettings();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

  return (
    <header className="h-16 bg-primary-900 border-b border-primary-700 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="w-9 h-9 border border-primary-700 text-white hover:bg-primary-800 transition-colors flex items-center justify-center"
          aria-label={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {isSidebarCollapsed ? (
            <Icons.PanelLeftOpen className="w-4 h-4" />
          ) : (
            <Icons.PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-accent-500 flex items-center justify-center shrink-0">
            <AppIcon iconId={settings.icon} className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-semibold text-lg truncate">{settings.title}</span>
        </Link>
      </div>

      {/* User info */}
      {username && (
        <button
          onClick={() => setShowUsernamePrompt(true)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 bg-accent-500 flex items-center justify-center">
            <Icons.User className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-sm font-medium">{username}</span>
        </button>
      )}

      <UsernamePrompt
        isOpen={showUsernamePrompt}
        initialValue={username || ''}
        onSubmit={(newUsername) => {
          setUsername(newUsername);
          setShowUsernamePrompt(false);
        }}
        onClose={() => setShowUsernamePrompt(false)}
      />
    </header>
  );
}
