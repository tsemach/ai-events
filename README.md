# Culture Events Agent (Central Israel → Telegram)

A tiny agent that wakes up once a day, asks Claude to search the web for
music concerts, dance shows, theater, and festivals in central Israel,
and sends you a Telegram digest. Zero dependencies, runs free on GitHub Actions.

## How it works

```
GitHub Actions cron (daily)
   → node agent.js
       → Claude API + web_search tool   (finds & formats events)
       → Telegram sendMessage           (delivers the digest)
```

## One-time setup (~10 minutes)

### 1. Create a Telegram bot
1. In Telegram, message **@BotFather**.
2. Send `/newbot`, follow the prompts, and copy the **bot token** it gives you
   (looks like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxx`).

### 2. Get your chat ID
1. Open a chat with your new bot and send it any message (e.g. "hi").
2. In a browser, visit:
   `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `"chat":{"id":...}` in the JSON — that number is your **chat ID**.

### 3. Get an Anthropic API key
From https://console.anthropic.com → API Keys.

### 4. Put it in a GitHub repo
1. Create a new repo and add `agent.js` and `.github/workflows/daily-events.yml`.
2. Go to **Settings → Secrets and variables → Actions → New repository secret**
   and add three secrets:
   - `ANTHROPIC_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

### 5. Test it
Go to the **Actions** tab → *Daily Culture Events Digest* → **Run workflow**.
Within a minute you should get a Telegram message. After that it runs on its
own every morning.

## Run it locally (optional)

```bash
ANTHROPIC_API_KEY=... TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... node agent.js
```

## Tuning

- **Time of day:** edit the `cron` line in the workflow. It's in UTC.
  `0 5 * * *` ≈ 8 AM Israel in summer / 7 AM in winter. Israel observes DST, so
  if you want exactly 8 AM year-round you'd need two cron lines (or just accept
  the one-hour seasonal drift — most people don't care for a morning digest).
- **Look-ahead window:** set `EVENT_WINDOW_DAYS` (default 14).
- **Cheaper runs:** set `CLAUDE_MODEL: claude-haiku-4-5-20251001` in the workflow
  env. Web search adds a small per-search cost on top of tokens; a daily run is
  cents/month either way.
- **Cities / categories / sources:** edit the `PROMPT` string in `agent.js`.
  That's where you'd narrow to specific genres or add favorite venues.

## Possible upgrades

- **Only show *new* events.** Commit a small `seen.json` of event signatures
  back to the repo each run and ask the model to exclude anything already seen,
  so you don't get repeats day to day.
- **Clickable links.** Switch Telegram to HTML parse mode and have the prompt
  wrap titles in `<a href>` tags (remember to escape `&`, `<`, `>`).
- **Multiple recipients.** Loop `sendTelegram` over several chat IDs, or post to
  a Telegram channel instead of a DM.
