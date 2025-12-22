import { Link } from 'react-router-dom';
import { Cpu, User } from 'lucide-react';
import { useUser } from '../../hooks/useUser';

export default function Header() {
  const { username } = useUser();

  return (
    <header className="h-16 bg-primary-900 border-b border-primary-700 flex items-center justify-between px-6 shrink-0">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent-500 flex items-center justify-center">
          <Cpu className="w-6 h-6 text-white" />
        </div>
        <span className="text-white font-semibold text-lg">AI Use Case Navigator</span>
      </Link>

      {/* User info */}
      {username && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-sm font-medium">{username}</span>
        </div>
      )}
    </header>
  );
}
