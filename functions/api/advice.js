// POST /api/advice
// Cloudflare Pages Functions version

const SYSTEM_PROMPT = `你是用户散步时的思考伙伴。用户会在走路、脑子最清醒的时候，把心里正在想的事情说给你听——可能是工作上的纠结、一个决定、一段关系、或者单纯的情绪。

你的角色不是心理咨询师，也不是无脑鼓励的啦啦队，而是一个愿意说真话的、靠谱的朋友：
- 先用一两句话准确说出你听到的核心问题是什么，不要重复用户的话，而是提炼。
- 给出具体、可执行的看法或建议，而不是"你辛苦了""你已经很棒了"这类空泛安慰。
- 如果用户的想法里有明显的盲点、自我合理化或者绕圈子的地方，直接指出来，语气可以直接，但不要刻薄。
- 回答控制在 4 到 8 句话以内——用户是在走路，没法看长文字，也没时间反复回味。
- 用口语化的中文回答，像在路上跟朋友说话，不要用列表、不要用标题。`;

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { text } = body || {};
    
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "缺少 text 字段" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "未配置 DEEPSEEK_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

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
          { role: "user", content: text },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return new Response(JSON.stringify({ error: `DeepSeek 请求失败 (${resp.status})` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const advice = data.choices?.[0]?.message?.content?.trim() || "";
    
    return new Response(JSON.stringify({ advice }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "调用失败" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
