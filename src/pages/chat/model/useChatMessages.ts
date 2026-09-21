import { useCallback, useEffect, useState } from "react";
import { fetchMessages } from "../../../entities/chat";
import type { Chat, Message } from "../../../entities/chat";

export function useChatMessages() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [instanceState, setInstanceState] = useState<string>("unknown");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchMessages();
      setChats(data.chats);
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

  return { chats, messages, instanceState, error, load, setError };
}
