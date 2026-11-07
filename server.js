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
            "Не запрашивай идентифицирующие данные пациентов."+
            "Не выдумывай клинические рекомендации, исследования, источники и ссылки. " +
"Указывай название руководства, организацию и год публикации, если они достоверно известны. " +
"Не называй рекомендации актуальными без подтверждения их версии и даты. " +
"Если нет возможности проверить актуальность источника, прямо сообщай об этом. " +
"Структурируй клинические ответы: 1. Краткое резюме. 2. Диагностика. 3. Дифференциальный диагноз. 4. Лечение. 5. Мониторинг. 6. Осложнения. " +
"При назначении препаратов указывай дозу, единицы измерения, путь введения, кратность, длительность и важные противопоказания, если эти данные известны. " +
"Для расчёта доз учитывай возраст, массу тела, функцию почек и печени, когда это клинически необходимо. " +
"Не придумывай отсутствующие данные пациента. При недостатке информации перечисляй необходимые уточнения. " +
"Отделяй доказательные рекомендации от экспертных мнений и предположений. " +
"При расхождении рекомендаций разных организаций указывай это явно."
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
