import { useState } from 'react';
import { User } from 'lucide-react';
import Modal from './ui/Modal';
import { Button, Input } from './ui';

interface UsernamePromptProps {
  isOpen: boolean;
  onSubmit: (username: string) => void;
}

export default function UsernamePrompt({ isOpen, onSubmit }: UsernamePromptProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Modal isOpen={isOpen} title="Welcome" showCloseButton={false}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-accent-500 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-primary-900">
            AI Use Case Navigator
          </h3>
          <p className="text-gray-500 mt-1">
            Enter your name to get started
          </p>
        </div>

        <Input
          label="Your Name"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          error={error}
          autoFocus
        />

        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </Modal>
  );
}
