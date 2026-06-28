// agent.js — Daily culture-events digest for central Israel.
// Zero dependencies. Runs on Node 18+ (uses global fetch).
//
// Required env vars:
//   ANTHROPIC_API_KEY   - from console.anthropic.com
//   TELEGRAM_BOT_TOKEN  - from @BotFather
//   TELEGRAM_CHAT_ID    - your personal chat id (see README)
// Optional:
//   CLAUDE_MODEL        - defaults to claude-sonnet-4-6
//   EVENT_WINDOW_DAYS   - how far ahead to look, defaults to 14

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const WINDOW_DAYS = parseInt(process.env.EVENT_WINDOW_DAYS || "14", 10);

if (!ANTHROPIC_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error(
    "Missing env vars. Need ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID."
  );
  process.exit(1);
}

// Today's date in Israel time, regardless of where the runner lives.
const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Asia/Jerusalem",
}); // YYYY-MM-DD

const PROMPT = `You are a local culture scout for someone living in the center of Israel (Gush Dan: Tel Aviv, Ramat Gan, Givatayim, Herzliya, Petah Tikva, Rishon LeZion, Holon, Bat Yam, and nearby).

Today is ${today}. Search the web for cultural events happening in the next ${WINDOW_DAYS} days in central Israel.

Include these categories:
- Live music concerts (any genre)
- Dance and ballet performances
- Theater and performance art
- Festivals and notable cultural happenings

Good Hebrew/Israeli sources to check (search these in addition to general queries):
- eventim.co.il
- leaan.co.il (לאן)
- Zappa clubs, Barby, Reading 3, Gagarin (live music venues)
- Suzanne Dellal Center / סוזן דלל (dance)
- Habima, Cameri, Tmuna theaters
- Time Out Tel Aviv, secrettlv event listings

Then write a SHORT, scannable digest as a Telegram message. Rules for the output:
- Plain text only. No Markdown symbols like *, _, #, or backticks (they break in Telegram).
- Group by category with a simple emoji header, e.g. "🎵 Music", "💃 Dance", "🎭 Theater", "🎉 Festivals".
- One line per event: name — venue, city — date — price/ticket link if known.
- Keep it to the most interesting 12–20 events. Skip filler.
- If a category has nothing notable, omit it.
- Start with one line: "Culture in the center, next ${WINDOW_DAYS} days (as of ${today})".
- End with nothing extra — no sign-off, no "let me know".
If you genuinely find nothing, say so in one line.`;

async function findEvents() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: PROMPT }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  // Final answer is in the text blocks; ignore web_search tool-use/result blocks.
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return text;
}

async function sendTelegram(text) {
  // Telegram caps messages at 4096 chars; chunk on a safe boundary.
  const chunks = [];
  for (let i = 0; i < text.length; i += 3800) {
    chunks.push(text.slice(i, i + 3800));
  }

  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: chunk,
          disable_web_page_preview: true,
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
    }
  }
}

(async () => {
  try {
    const summary = await findEvents();
    await sendTelegram(summary || "No events found today.");
    console.log("✓ Digest sent to Telegram.");
  } catch (err) {
    console.error("Agent failed:", err);
    // Best-effort failure ping so silent breakage is visible.
    try {
      await sendTelegram(`⚠️ Culture agent failed: ${err.message}`);
    } catch {}
    process.exit(1);
  }
})();
