import { useCallback, useState } from "react";

const STORAGE_KEY = "fantasy-cricket-session-token";
const LEGACY_STORAGE_KEY = "fantasy-cricket-session";

function readStoredSessionToken() {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function useSessionToken() {
  const [sessionToken, setSessionToken] = useState<string | null>(() => readStoredSessionToken());

  const persistSession = useCallback((token: string) => {
    window.localStorage.setItem(STORAGE_KEY, token);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setSessionToken(token);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setSessionToken(null);
  }, []);

  return {
    sessionToken,
    persistSession,
    clearSession,
    setSessionToken
  };
}
