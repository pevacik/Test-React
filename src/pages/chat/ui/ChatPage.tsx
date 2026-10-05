import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import { findContact, sendMessage, type Contact } from "../../../entities/chat";
import { authorize, type Credentials } from "../../../features/auth";
import { useChatMessages } from "../model";
import styles from "./Chat.module.css";

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

interface ActiveChat {
  chatId: string;
  name: string;
}

interface ChatPageProps {
  credentials: Credentials;
  onLogout: () => void;
}

const ChatPage = ({ credentials, onLogout }: ChatPageProps) => {
  const { chats, messages, instanceState, error, load, setError } =
    useChatMessages();
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Contact | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    authorize(credentials).catch(() => {});
  }, [credentials]);

  const activeMessages = activeChat ? (messages[activeChat.chatId] ?? []) : [];

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
    if (!text || !activeChat || sending) return;

    setError(null);
    setSending(true);
    try {
      await sendMessage(activeChat.chatId, text);
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

  const handleSearch = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = query.trim();
    if (!value || searching) return;

    setError(null);
    setFound(null);
    setSearching(true);
    try {
      const contact = await findContact(value);
      if (contact.exists) {
        setFound(contact);
      } else {
        setError("Контакт не найден");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const startChat = (chatId: string, name: string) => {
    setActiveChat({ chatId, name });
    setFound(null);
    setQuery("");
  };

  const closeChat = () => {
    setActiveChat(null);
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
            className={styles.logoutBtn}
            onClick={onLogout}
            title="Сменить аккаунт"
          >
            ⏻
          </button>
        </header>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Номер или @username"
            autoFocus
          />
          <button
            className={styles.searchBtn}
            type="submit"
            disabled={searching || !query.trim()}
          >
            {searching ? "…" : "Найти"}
          </button>
        </form>

        {found && (
          <div className={styles.foundCard}>
            <div className={styles.avatar}>{initials(found.name)}</div>
            <div className={styles.foundInfo}>
              <div className={styles.foundName}>{found.name}</div>
              <div className={styles.foundId}>{found.chatId}</div>
            </div>
            <button
              className={styles.startChatBtn}
              onClick={() => startChat(found.chatId, found.name)}
            >
              Начать чат
            </button>
          </div>
        )}

        <div className={styles.chatList}>
          {chats.map((chat) => (
            <button
              key={chat.chatId}
              className={`${styles.chatItem} ${
                activeChat?.chatId === chat.chatId ? styles.chatItemActive : ""
              }`}
              onClick={() => startChat(chat.chatId, chat.name)}
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
              <p>Введите номер или @username, чтобы найти собеседника.</p>
            </div>
          )}
        </div>
      </aside>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}

        {activeChat ? (
          <>
            <header className={styles.chatHeader}>
              <button
                className={styles.backBtn}
                onClick={closeChat}
                title="Назад к поиску"
              >
                ←
              </button>
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
              <p>Поиск собеседника</p>
            </div>
            <div className={styles.emptyHint}>
              <p>Введите номер или @username в поле поиска слева и нажмите «Найти»</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatPage;

