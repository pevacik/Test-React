import { useCallback, useState } from "react";
import AuthPage from "./page/AuthPage";
import ChatPage from "./page/ChatPage";
import type { Credentials } from "./service/api";

const STORAGE_KEY = "greenapi-credentials";

function readCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Credentials) : null;
  } catch {
    return null;
  }
}

function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(readCredentials);

  const handleAuthorized = useCallback((creds: Credentials) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    setCredentials(creds);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
  }, []);

  if (!credentials) {
    return <AuthPage onAuthorized={handleAuthorized} />;
  }

  return <ChatPage credentials={credentials} onLogout={handleLogout} />;
}

export default App;
