# Test React

Minimal React + TypeScript + Vite starter.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Backend

Node.js/Express server in `server/` that:

- exposes the chat API for the frontend;
- talks to green-api v3 (Telegram instance) via `SendMessage` / `ReceiveNotification` / `DeleteNotification`;
- runs a background polling loop that pulls incoming messages and stores them in memory.

- `cd server && npm install` — install backend dependencies
- `npm run dev` (in `server/`) — start with nodemon (auto-reload)
- `npm start` (in `server/`) — start in production mode

### Endpoints

- `GET /api/health` — health check + instance state
- `GET /api/instance-state` — green-api instance authorization state
- `GET /api/messages` — full in-memory state: `{ chats, messages, instanceState }`
- `POST /api/send` — send a text message; body `{ "chatId": "...", "message": "..." }`
- `POST /api/webhook` — kept for the Webhook Endpoint technology (not used by the HTTP API polling flow)

### Environment variables (`server/.env`)

- `PORT` — server port (default `3001`)
- `CORS_ORIGIN` — comma-separated allowed origins (default `http://localhost:5173`); use `*` to allow any origin
- `GREEN_API_URL` — green-api API host (e.g. `https://4100.api.green-api.com`)
- `GREEN_API_ID_INSTANCE` — instance id
- `GREEN_API_TOKEN_INSTANCE` — instance API token
- `GREEN_API_POLL_INTERVAL` — polling interval in ms (default `2000`)

On startup the server enables incoming/outgoing webhooks via `SetSettings` (keeping `webhookUrl` empty, as required by the HTTP API technology).

## Running & testing the chat

1. `cd server && npm run dev` — start the backend (port `3001`)
2. `npm run dev` (repo root) — start the frontend (port `5173`, proxies `/api` → `:3001`)
3. Open http://localhost:5173
4. Send any message to the linked Telegram account from another account — it appears in the chat within ~2s
5. Reply from the UI, or start a chat via «+» by entering a `chatId` (number, `phone@c.us`, or `@username`)
