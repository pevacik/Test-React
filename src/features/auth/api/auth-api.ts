import { request } from "../../../shared/api";
import type { Credentials } from "../model";

export function authorize(
  creds: Credentials,
): Promise<{ status: string; stateInstance: string }> {
  return request("/api/auth", {
    method: "POST",
    body: JSON.stringify(creds),
  });
}
