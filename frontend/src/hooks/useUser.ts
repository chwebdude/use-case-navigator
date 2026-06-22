import { useState } from 'react';

const USERNAME_KEY = 'ai-use-case-navigator-username';
const POWER_KEY = 'ai-use-case-navigator-has-power';

export function useUser() {
  const [username, setUsernameState] = useState<string | null>(() => {
    return localStorage.getItem(USERNAME_KEY);
  });
  const [isPowerUser, setIsPowerUser] = useState<boolean>(() => {
    return localStorage.getItem(POWER_KEY) === 'true';
  });

  const setUsername = (name: string) => {
    localStorage.setItem(USERNAME_KEY, name);
    setUsernameState(name);
  };

  const clearUsername = () => {
    localStorage.removeItem(USERNAME_KEY);
    setUsernameState(null);
  };

  const grantPower = () => {
    localStorage.setItem(POWER_KEY, 'true');
    setIsPowerUser(true);
  };

  return {
    username,
    setUsername,
    clearUsername,
    isPowerUser,
    grantPower,
    isLoggedIn: Boolean(username),
  };
}
