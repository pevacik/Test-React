import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import {
  authorize,
  fetchMessages,
  sendMessage,
  type Chat,
  type Credentials,
  type Message,
} from "../service/api";
import styles from "../service/Chat.module.css";

function formatTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

interface ChatPageProps {
  credentials: Credentials;
  onLogout: () => void;
}

const ChatPage = ({ credentials, onLogout }: ChatPageProps) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [instanceState, setInstanceState] = useState<string>("unknown");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMessages();
      setChats(data.chats);
      // Убираем дубликаты по id (защита от повторной доставки).
      const deduped: Record<string, Message[]> = {};
      for (const [chatId, list] of Object.entries(data.messages)) {
        const byId = new Map<string, Message>();
        for (const m of list) byId.set(m.id, m);
        // Сортируем по времени, чтобы сообщения шли друг за другом как в мессенджере.
        deduped[chatId] = [...byId.values()].sort(
          (a, b) => a.timestamp - b.timestamp || (a.seq ?? 0) - (b.seq ?? 0),
        );
      }
      setMessages(deduped);
      setInstanceState(data.instanceState ?? "unknown");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(load, 0);
    const id = setInterval(load, 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    authorize(credentials).catch(() => {});
  }, [credentials]);

  const activeChatId = useMemo(() => {
    if (selectedChatId && chats.some((c) => c.chatId === selectedChatId)) {
      return selectedChatId;
    }
    return chats[0]?.chatId ?? null;
  }, [selectedChatId, chats]);

  const activeChat = useMemo(
    () => chats.find((c) => c.chatId === activeChatId) ?? null,
    [chats, activeChatId],
  );

  const activeMessages = activeChatId ? (messages[activeChatId] ?? []) : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeChatId || sending) return;

    setError(null);
    setSending(true);
    try {
      await sendMessage(activeChatId, text);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const submitNewChat = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = newChatId.trim();
    if (!id) return;
    setSelectedChatId(id);
    setNewChatId("");
    setShowNewChat(false);
  };

  const authorized = instanceState === "authorized";

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div className={styles.avatar}>TG</div>
          <div className={styles.account}>
            <div className={styles.accountName}>Telegram</div>
            <div
              className={`${styles.accountStatus} ${authorized ? styles.ok : styles.bad}`}
            >
              {authorized ? "подключено" : instanceState}
            </div>
          </div>
          <button
            className={styles.newChatBtn}
            onClick={() => setShowNewChat((v) => !v)}
            title="Новый чат"
          >
            +
          </button>
          <button
            className={styles.logoutBtn}
            onClick={onLogout}
            title="Сменить аккаунт"
          >
            ⏻
          </button>
        </header>

        {showNewChat && (
          <form className={styles.newChatForm} onSubmit={submitNewChat}>
            <input
              className={styles.newChatInput}
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              placeholder="chatId (id пользователя)"
              autoFocus
            />
            <button className={styles.newChatSubmit} type="submit">
              OK
            </button>
          </form>
        )}

        <div className={styles.chatList}>
          {chats.map((chat) => (
            <button
              key={chat.chatId}
              className={`${styles.chatItem} ${chat.chatId === activeChatId ? styles.chatItemActive : ""}`}
              onClick={() => setSelectedChatId(chat.chatId)}
            >
              <div className={styles.avatar}>{initials(chat.name)}</div>
              <div className={styles.chatBody}>
                <div className={styles.chatTop}>
                  <span className={styles.chatName}>{chat.name}</span>
                  <span className={styles.chatTime}>
                    {formatTime(chat.lastTimestamp)}
                  </span>
                </div>
                <div className={styles.chatPreview}>{chat.lastMessage}</div>
              </div>
            </button>
          ))}
          {chats.length === 0 && (
            <div className={styles.noChats}>
              <p>Пока нет чатов. Напишите боту или создайте чат по chatId.</p>
            </div>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}

        {activeChat ? (
          <>
            <header className={styles.chatHeader}>
              <div className={styles.avatar}>{initials(activeChat.name)}</div>
              <div className={styles.headerText}>
                <div className={styles.chatTitle}>{activeChat.name}</div>
                <div className={styles.chatSubtitle}>{activeChat.chatId}</div>
              </div>
            </header>

            <div className={styles.messagesArea}>
              {activeMessages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.row} ${m.direction === "out" ? styles.rowOut : styles.rowIn}`}
                >
                  <div
                    className={`${styles.bubble} ${
                      m.direction === "out" ? styles.bubbleOut : styles.bubbleIn
                    }`}
                  >
                    <span className={styles.bubbleText}>{m.text}</span>
                    <span className={styles.bubbleTime}>
                      {formatTime(m.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Сообщение"
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={handleSend}
                disabled={!input.trim() || sending}
              >
                {sending ? "…" : "➤"}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>
              <p>Выберите чат</p>
            </div>
            <div className={styles.emptyHint}>
              <p>или создайте новый по кнопке «+» и введите chatId</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatPage;
