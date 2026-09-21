import { request } from "../../../shared/api";
import type { ChatState } from "../model";

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
