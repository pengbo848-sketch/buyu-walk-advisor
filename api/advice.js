// POST /api/advice
// Body: { text: string }
// Response: { advice: string }
//
// This function is the only place that holds API keys and talks to the
// model providers. The frontend never sees a key and never calls the
// provider directly — that's the whole reason a "backend" exists here.

// ---- Persona / system prompt ----
// Edit this to change how the AI responds. Keep it in one place so every
// provider gets the exact same behavior.
const SYSTEM_PROMPT = `你是用户散步时的思考伙伴。用户会在走路、脑子最清醒的时候，把心里正在想的事情说给你听——可能是工作上的纠结、一个决定、一段关系、或者单纯的情绪。

你的角色不是心理咨询师，也不是无脑鼓励的啦啦队，而是一个愿意说真话的、靠谱的朋友：
- 先用一两句话准确说出你听到的核心问题是什么，不要重复用户的话，而是提炼。
- 给出具体、可执行的看法或建议，而不是"你辛苦了""你已经很棒了"这类空泛安慰。
- 如果用户的想法里有明显的盲点、自我合理化或者绕圈子的地方，直接指出来，语气可以直接，但不要刻薄。
- 回答控制在 4 到 8 句话以内——用户是在走路，没法看长文字，也没时间反复回味。
- 用口语化的中文回答，像在路上跟朋友说话，不要用列表、不要用标题。`;

const PROVIDER = (process.env.AI_PROVIDER || "deepseek").toLowerCase();

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "缺少 text 字段" });
    return;
  }

  try {
    let advice;
    if (PROVIDER === "claude") {
      advice = await callClaude(text);
    } else if (PROVIDER === "gemini") {
      advice = await callGemini(text);
    } else {
      advice = await callDeepSeek(text);
    }
    res.status(200).json({ advice });
  } catch (err) {
    console.error(`[advice] provider=${PROVIDER} error:`, err);
    res.status(502).json({ error: err.message || "调用模型失败" });
  }
};

// ---- Providers ----
// Each function takes the user's transcribed text and returns a plain string.

async function callDeepSeek(userText) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("未配置 DEEPSEEK_API_KEY");

  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
      max_tokens: 400,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`DeepSeek 请求失败 (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callClaude(userText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("未配置 ANTHROPIC_API_KEY");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Claude 请求失败 (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  return textBlock?.text?.trim() || "";
}

async function callGemini(userText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("未配置 GEMINI_API_KEY");

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userText }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gemini 请求失败 (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}
