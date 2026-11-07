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
      return res.status(503).json({ error: "AI is not configured." });
    }

    const { message, specialty = "Общая медицина" } = req.body || {};

    if (typeof message !== "string" || !message.trim() || message.length > 12000) {
      return res.status(400).json({ error: "Введите вопрос (до 12 000 символов)." });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });

    const model = process.env.OPENAI_MODEL || "openrouter/free";

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Ты — медицинский справочный AI-помощник MedPilot AI. Отвечай на русском языке, структурированно и осторожно. " +
            "Учитывай специальность: " + String(specialty).slice(0, 100) + ". " +
            "Не выдавай предположения за факты. Учитывай актуальные рекомендации, клинические протоколы и состояние пациента. " +
            "При неотложных состояниях указывай необходимость немедленной медицинской помощи. " +
            "Не запрашивай идентифицирующие данные пациентов."
        },
        {
          role: "user",
          content: message.trim()
        }
      ]
    });

    res.json({
      answer: response.choices?.[0]?.message?.content || "Нет ответа от модели."
    });

  } catch (err) {
    console.error("Chat request failed:", err.message);
    res.status(500).json({
      error: "Не удалось обработать запрос. Проверьте настройки сервера."
    });
  }
});

app.listen(PORT, () => console.log(`MedPilot AI listening on ${PORT}`));
