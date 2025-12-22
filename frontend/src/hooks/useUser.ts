import { useState } from 'react';

const USERNAME_KEY = 'ai-use-case-navigator-username';

export function useUser() {
  const [username, setUsernameState] = useState<string | null>(() => {
    return localStorage.getItem(USERNAME_KEY);
  });

  const setUsername = (name: string) => {
    localStorage.setItem(USERNAME_KEY, name);
    setUsernameState(name);
  };

  const clearUsername = () => {
    localStorage.removeItem(USERNAME_KEY);
    setUsernameState(null);
  };

  return {
    username,
    setUsername,
    clearUsername,
    isLoggedIn: Boolean(username),
  };
}
