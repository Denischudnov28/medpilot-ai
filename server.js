const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "30kb" }));
app.use("/api/", rateLimit({ windowMs: 60 * 1000, limit: 20 }));
app.use(express.static("public"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "AI is not configured. Add OPENAI_API_KEY on the server." });
    }
    const { message, specialty = "Общая медицина" } = req.body || {};
    if (typeof message !== "string" || !message.trim() || message.length > 12000) {
      return res.status(400).json({ error: "Введите вопрос (до 12 000 символов)." });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-5.5";
    const response = await client.responses.create({
      model,
      instructions:
        "Ты — медицинский справочный AI-помощник MedPilot AI. Отвечай на русском языке, структурированно и осторожно. " +
        "Учитывай выбранную специальность: " + String(specialty).slice(0, 100) + ". " +
        "Не выдавай предположения за факты. При клинических вопросах указывай, что ответ требует проверки врачом, " +
        "учёта состояния пациента, локальных протоколов и актуальных рекомендаций. " +
        "При неотложных состояниях сначала обозначай необходимость немедленной очной помощи. " +
        "Не запрашивай идентифицирующие данные пациентов.",
      input: message.trim()
    });
    res.json({ answer: response.output_text || "Не удалось получить текстовый ответ." });
  } catch (err) {
    console.error("Chat request failed:", err.message);
    res.status(500).json({ error: "Не удалось обработать запрос. Проверьте настройки сервера и повторите попытку." });
  }
});

app.listen(PORT, () => console.log(`MedPilot AI listening on ${PORT}`));
