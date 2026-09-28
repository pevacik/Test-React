# Test React

Чат с Telegram через green-api. Фронтенд — React + TypeScript + Vite, бэкенд — Node.js/Express.

## Что нужно для запуска

- **Node.js** 20.12 или новее и **npm**
- **Аккаунт green-api** с активным инстансом — понадобятся `idInstance` и `apiTokenInstance` (личный кабинет console.green-api.com)

## Как запустить

### 1. Бэкенд

В отдельном терминале:

```bash
cd server
npm install
npm run dev
```

### 2. Фронтенд

В другом терминале (из корня репозитория):

```bash
npm install
npm run dev
```

### 3. Вход

1. Откройте http://localhost:5173
2. Укажите `idInstance` и `apiTokenInstance` в форме входа — либо заранее пропишите их в файле `server/.env` (пример — `server/.env.example`)

> Подробная документация (эндпоинты, переменные окружения, порты) — в [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).