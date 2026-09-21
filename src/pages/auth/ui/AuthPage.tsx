import { useState, type SubmitEvent } from "react";
import { authorize, type Credentials } from "../../../features/auth";
import styles from "./Auth.module.css";

interface AuthPageProps {
  onAuthorized: (creds: Credentials) => void;
}

const AuthPage = ({ onAuthorized }: AuthPageProps) => {
  const [apiUrl, setApiUrl] = useState("https://4100.api.green-api.com");
  const [idInstance, setIdInstance] = useState("");
  const [apiTokenInstance, setApiTokenInstance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError("Заполните idInstance и apiTokenInstance");
      return;
    }

    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const creds: Credentials = {
        apiUrl: apiUrl.trim(),
        idInstance: idInstance.trim(),
        apiTokenInstance: apiTokenInstance.trim(),
      };
      const res = await authorize(creds);
      if (res.stateInstance === "authorized") {
        onAuthorized(creds);
      } else {
        setHint(
          `Инстанс не авторизован (${res.stateInstance}). Пройдите авторизацию по QR-коду в личном кабинете green-api и повторите вход.`,
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authWrap}>
      <form className={styles.authCard} onSubmit={handleSubmit}>
        <div className={styles.authLogo}>TG</div>
        <h1 className={styles.authTitle}>Вход в green-api</h1>
        <p className={styles.authSubtitle}>
          Данные инстанса из личного кабинета console.green-api.com
        </p>

        <label className={styles.authLabel}>
          apiUrl
          <input
            className={styles.authInput}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://4100.api.green-api.com"
          />
        </label>

        <label className={styles.authLabel}>
          idInstance
          <input
            className={styles.authInput}
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="410022740510"
            autoFocus
          />
        </label>

        <label className={styles.authLabel}>
          apiTokenInstance
          <input
            className={styles.authInput}
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="606cec2f…"
            type="password"
          />
        </label>

        {error && <div className={styles.authError}>{error}</div>}
        {hint && <div className={styles.authHint}>{hint}</div>}

        <button className={styles.authSubmit} type="submit" disabled={loading}>
          {loading ? "Проверка…" : "Войти"}
        </button>
      </form>
    </div>
  );
};

export default AuthPage;
