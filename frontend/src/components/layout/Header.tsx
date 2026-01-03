import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, User } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import UsernamePrompt from '../UsernamePrompt';

export default function Header() {
  const { username, setUsername } = useUser();
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);

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
        <button
          onClick={() => setShowUsernamePrompt(true)}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="w-8 h-8 bg-accent-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
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
