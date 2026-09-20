export type Direction = "in" | "out";

export interface Message {
  id: string;
  chatId: string;
  text: string;
  direction: Direction;
  timestamp: number;
  seq?: number; 
}

export interface Chat {
  chatId: string;
  name: string;
  lastMessage: string;
  lastTimestamp: number;
}

export interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  instanceState?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    let message = `Ошибка HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.message) message = String(data.message);
    } catch {
      //
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function fetchMessages(): Promise<ChatState> {
  return request<ChatState>("/api/messages");
}

export function fetchInstanceState(): Promise<{ stateInstance: string }> {
  return request<{ stateInstance: string }>("/api/instance-state");
}

export function sendMessage(
  chatId: string,
  text: string,
): Promise<{ status: string; idMessage: string | null }> {
  return request("/api/send", {
    method: "POST",
    body: JSON.stringify({ chatId, message: text }),
  });
}

export interface Credentials {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
}

export function authorize(
  creds: Credentials,
): Promise<{ status: string; stateInstance: string }> {
  return request("/api/auth", {
    method: "POST",
    body: JSON.stringify(creds),
  });
}
