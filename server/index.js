import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import {
  clearCredentials,
  deleteNotification,
  getStateInstance,
  receiveNotification,
  sendMessage,
  setCredentials,
  setSettings,
} from "./greenApi.js";

// Загружаем server/.env при его наличии (встроенный загрузчик Node 20.12+ — без доп. зависимостей).
const envPath = fileURLToPath(new URL(".env", import.meta.url));
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const app = express();

// Разбираем JSON-тела запросов (нужно для POST-нагрузок вебхука).
app.use(express.json({ limit: "1mb" }));

// CORS: разрешаем только настроенные источники, чтобы фронтенд мог обращаться к API.
// Установите CORS_ORIGIN=*, чтобы открыть доступ (например, для быстрого локального тестирования).
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAll = allowedOrigins.includes("*");

const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      
      if (
        allowAll ||
        !origin ||
        allowedOrigins.includes(origin) ||
        localOriginPattern.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(
        Object.assign(new Error("Not allowed by CORS"), { status: 403 }),
      );
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);


const chats = new Map(); 
const messages = new Map(); 
let seqCounter = 0; 
let instanceState = "unknown";
let currentInstanceKey = null; 

function touchChat(chatId, name, text, timestamp, seq) {
  const chat = chats.get(chatId) ?? {
    chatId,
    name: name || chatId,
    lastMessage: "",
    lastTimestamp: 0,
  };
  if (name && chat.name === chat.chatId) chat.name = name;
  // Обновляем последнее сообщение чата только если оно действительно новее (по времени, при равенстве — по seq).
  const newer = timestamp > chat.lastTimestamp || (timestamp === chat.lastTimestamp && (seq ?? 0) >= (chat.lastSeq ?? 0));
  if (!newer) return;
  chat.lastMessage = text;
  chat.lastTimestamp = timestamp;
  chat.lastSeq = seq ?? 0;
  chats.set(chatId, chat);
}

// green-api отдаёт timestamp в секундах, но в некоторых версиях API — уже в
// миллисекундах. Нормализуем к миллисекундам, чтобы сортировка по времени была верной.
function normalizeTimestamp(ts) {
  const now = Date.now();
  const value = Number(ts);
  if (!Number.isFinite(value)) return now;
  if (value > 1e12) return value; // уже миллисекунды
  if (value > 1e9) return value * 1000; // секунды
  return now; // значение вне ожидаемого диапазона — используем текущее время
}

// green-api (Telegram) возвращает idMessage в виде миллисекундной метки времени.
// Берём время из него, чтобы исходящие и входящие сообщения сортировались по одной
// шкале часов (часы локального сервера могут расходиться с часами green-api).
function timestampFromIdMessage(idMessage, fallback) {
  const ms = Number(idMessage);
  return Number.isFinite(ms) && ms > 1e9 ? ms : fallback;
}

function pushMessage({ id, chatId, text, direction, name, timestamp }) {
  const list = messages.get(chatId) ?? [];
  // Дедупликация: green-api может повторно доставить уведомление; не храним один и тот же id дважды.
  if (list.some((m) => m.id === id)) return;
  const msgSeq = seqCounter++;
  list.push({ id, chatId, text, direction, timestamp, seq: msgSeq });
  messages.set(chatId, list);
  touchChat(chatId, name, text, timestamp, msgSeq);
}

function handleNotification(body) {
  const hook = body?.typeWebhook;
  if (
    hook !== "incomingMessageReceived" &&
    hook !== "outgoingMessageReceived"
  ) {
    return;
  }
  if (body.messageData?.typeMessage !== "textMessage") return;

  const text = body.messageData.textMessageData?.textMessage;
  const chatId = body.senderData?.chatId;
  if (!text || !chatId) return;

  pushMessage({
    id: body.idMessage ?? `${chatId}-${body.timestamp}-${Math.random()}`,
    chatId,
    text,
    direction: hook === "incomingMessageReceived" ? "in" : "out",
    name: body.senderData.chatName || body.senderData.senderName || chatId,
    timestamp: normalizeTimestamp(body.timestamp),
  });
}

// --- Цикл опроса: ReceiveNotification -> handle -> DeleteNotification ---
let pollInFlight = false;

async function pollOnce() {
  if (pollInFlight) return; // выполняем один цикл receive/delete/handle за раз
  pollInFlight = true;
  try {
    const notification = await receiveNotification();
    if (notification && notification.receiptId != null) {
      // Подтверждаем каждое уведомление, чтобы оно не возвращалось в очередь.
      try {
        await deleteNotification(notification.receiptId);
      } catch (err) {
        console.error("[poll] deleteNotification failed:", err.message);
      }
      if (notification.body) handleNotification(notification.body);
    }
  } catch (err) {
    console.error("[poll] receiveNotification failed:", err.message);
  } finally {
    pollInFlight = false;
  }
}

function startPolling() {
  const interval = Number(process.env.GREEN_API_POLL_INTERVAL) || 2000;
  pollOnce();
  setInterval(pollOnce, interval);
}

async function refreshInstanceState() {
  try {
    const state = await getStateInstance();
    instanceState = state?.stateInstance ?? "unknown";
  } catch {
    instanceState = "unknown";
  }
}

async function init() {
  try {
    // Технология HTTP API требует пустой webhookUrl + включённые вебхуки.
    await setSettings({
      webhookUrl: "",
      incomingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      outgoingAPIMessageWebhook: "yes",
      stateWebhook: "yes",
    });
    console.log("[init] instance settings applied");
  } catch (err) {
    console.error("[init] setSettings failed:", err.message);
  }

  await refreshInstanceState();
  startPolling();
  setInterval(refreshInstanceState, 30000);
}

// --- Маршруты ---
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), instanceState });
});

app.get("/api/instance-state", (_req, res) => {
  res.json({ stateInstance: instanceState });
});

// Устанавливаем / проверяем учётные данные инстанса (используется окном авторизации).
app.post("/api/auth", async (req, res, next) => {
  try {
    const { apiUrl, idInstance, apiTokenInstance } = req.body ?? {};
    if (!idInstance || !apiTokenInstance) {
      return res.status(400).json({
        status: "error",
        message: "idInstance and apiTokenInstance are required",
      });
    }

    const newKey = `${apiUrl ?? ""}:${idInstance}`;
    const isNewInstance = currentInstanceKey !== newKey;

    setCredentials({ apiUrl, idInstance, token: apiTokenInstance });

    let state;
    try {
      state = await getStateInstance();
    } catch (err) {
      clearCredentials();
      return res.status(Number(err?.status) || 400).json({
        status: "error",
        message: err.message,
      });
    }

    if (isNewInstance) {
      // Другой инстанс означает другой аккаунт: сбрасываем хранилище чатов
      // и включаем для него вебхуки HTTP API.
      chats.clear();
      messages.clear();
      currentInstanceKey = newKey;
      try {
        await setSettings({
          webhookUrl: "",
          incomingWebhook: "yes",
          outgoingMessageWebhook: "yes",
          outgoingAPIMessageWebhook: "yes",
          stateWebhook: "yes",
        });
      } catch (err) {
        console.error("[auth] setSettings failed:", err.message);
      }
    }

    instanceState = state?.stateInstance ?? "unknown";
    res.json({ status: "ok", stateInstance: instanceState });
  } catch (err) {
    next(err);
  }
});

// Отправляем текстовое сообщение через green-api.
app.post("/api/send", async (req, res, next) => {
  try {
    const { chatId, message } = req.body ?? {};
    if (!chatId || !message) {
      return res
        .status(400)
        .json({ status: "error", message: "chatId and message are required" });
    }

    const result = await sendMessage(String(chatId), String(message));
    const id = result?.idMessage ?? `out-${Date.now()}`;
    // Используем idMessage от green-api (миллисекундная метка) как время сообщения,
    // чтобы исходящие и входящие сообщения были на одной шкале часов.
    const timestamp = timestampFromIdMessage(result?.idMessage, Date.now()); // green-api clock: idMessage = ms timestamp

    pushMessage({
      id,
      chatId: String(chatId),
      text: String(message),
      direction: "out",
      name: String(chatId),
      timestamp,
    });

    res.json({
      status: "ok",
      idMessage: result?.idMessage ?? null,
      message: {
        id,
        chatId: String(chatId),
        text: String(message),
        direction: "out",
        timestamp,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Полное состояние в памяти (чаты + сообщения) для фронтенда.
app.get("/api/messages", (_req, res) => {
  const chatList = [...chats.values()].sort(
    (a, b) => b.lastTimestamp - a.lastTimestamp || b.lastSeq - a.lastSeq,
  );

  const messagesByChat = {};
  for (const [chatId, list] of messages.entries()) {
    messagesByChat[chatId] = [...list].sort(
      (a, b) => a.timestamp - b.timestamp || a.seq - b.seq,
    );
  }

  res.json({ chats: chatList, messages: messagesByChat, instanceState });
});

// Конечная точка вебхука: принимает POST-запросы от сервера
app.post("/api/webhook", (req, res) => {
  const payload = req.body ?? {};
  console.log(`[webhook] ${new Date().toISOString()} received:`, payload);
  res.status(200).json({
    status: "ok",
    message: "Webhook received",
    received: payload,
  });
});

// Обработчик ошибок: ошибки разбора JSON → 400, запрещённые CORS-источники → 403, всё остальное → 500.
app.use((err, _req, res, _next) => {
  const status = Number(err?.status) || 500;
  const message =
    status === 400 && err?.type === "entity.parse.failed"
      ? "Invalid JSON body"
      : status < 500
        ? err.message
        : "Internal server error";

  if (status >= 500) {
    console.error("[error]", err);
  }
  res.status(status).json({ status: "error", message });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(
    `CORS: ${allowedOrigins.join(", ") || "(none)"} + any localhost/127.0.0.1 port`,
  );
  init();
});
