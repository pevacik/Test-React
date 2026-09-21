import { useCallback, useState } from "react";
import AuthPage from "../pages/auth";
import ChatPage from "../pages/chat";
import {
  readCredentials,
  saveCredentials,
  clearCredentials,
  type Credentials,
} from "../features/auth";

function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(
    readCredentials,
  );

  const handleAuthorized = useCallback((creds: Credentials) => {
    saveCredentials(creds);
    setCredentials(creds);
  }, []);

  const handleLogout = useCallback(() => {
    clearCredentials();
    setCredentials(null);
  }, []);

  if (!credentials) {
    return <AuthPage onAuthorized={handleAuthorized} />;
  }

  return <ChatPage credentials={credentials} onLogout={handleLogout} />;
}

export default App;
