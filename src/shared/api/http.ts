export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
