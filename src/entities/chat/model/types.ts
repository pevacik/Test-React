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
