// Минимальный клиент green-api v3.
// Один и тот же контракт конечных точек используется для инстансов MAX и Telegram:
//   https://green-api.com/v3/docs/
// Учётные данные читаются лениво (в момент вызова), чтобы server/.env можно было
// загрузить после импорта этого модуля (ESM-импорты поднимаются выше кода верхнего уровня).
// Учётные данные, заданные через setCredentials(), переопределяют значения из .env.

let activeCredentials = null; // { apiUrl, idInstance, token }

function apiUrl() {
  return (
    activeCredentials?.apiUrl ??
    process.env.GREEN_API_URL ??
    "https://4100.api.green-api.com"
  ).replace(/\/$/, "");
}

function idInstance() {
  const id = activeCredentials?.idInstance ?? process.env.GREEN_API_ID_INSTANCE;
  if (!id) throw new Error("idInstance is required");
  return id;
}

function token() {
  const t = activeCredentials?.token ?? process.env.GREEN_API_TOKEN_INSTANCE;
  if (!t) throw new Error("apiTokenInstance is required");
  return t;
}

export function setCredentials(credentials) {
  activeCredentials = credentials
    ? {
        apiUrl: credentials.apiUrl,
        idInstance: String(credentials.idInstance),
        token: credentials.token,
      }
    : null;
}

export function clearCredentials() {
  activeCredentials = null;
}

async function apiRequest(method, path, body) {
  const url = `${apiUrl()}/waInstance${idInstance()}${path}`;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(`green-api ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function sendMessage(chatId, message) {
  return apiRequest("POST", `/sendMessage/${token()}`, { chatId, message });
}

export function receiveNotification() {
  return apiRequest("GET", `/receiveNotification/${token()}`);
}

// Примечание: в этом методе токен идёт ПЕРЕД receiptId в URL.
export function deleteNotification(receiptId) {
  return apiRequest("DELETE", `/deleteNotification/${token()}/${receiptId}`);
}

export function setSettings(settings) {
  return apiRequest("POST", `/setSettings/${token()}`, settings);
}

export function getStateInstance() {
  return apiRequest("GET", `/getStateInstance/${token()}`);
}
