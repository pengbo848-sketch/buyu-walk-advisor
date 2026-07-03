# 步语 · 走路时的思考伙伴

一个手机端 PWA：走路的时候点一下按钮，把心里正在想的事情说出来，语音会被转成文字发给后端，后端调用大模型（默认 DeepSeek，可切换 Claude / Gemini）生成一段简短的建议，显示在手机上。

不做语音播报（TTS）——建议以文字形式展示，自己看。

## 架构

```
手机浏览器 (PWA)
  ├─ 浏览器自带语音识别 (Web Speech API) 把语音转成文字
  ├─ 或者：语音识别不可用时，手动打字（内置了这个兜底）
  ↓ fetch POST /api/advice { text }
后端 (Vercel Serverless Function)
  ├─ 持有 API Key，拼接固定的人设 system prompt
  ├─ 调用 DeepSeek / Claude / Gemini 中的一个（AI_PROVIDER 环境变量决定）
  ↓ { advice }
手机浏览器显示建议文字
```

### 为什么要分前端和后端？

- **前端** = 手机浏览器里跑的那部分：界面、麦克风按钮、语音识别、把结果显示出来。这部分谁都能看到、能看到源代码。
- **后端** = 一段跑在服务器上的代码，专门负责调用 DeepSeek/Claude/Gemini。

**必须要有后端的原因**：调用大模型需要 API Key，而 API Key 绝对不能写在前端代码里——前端代码是发到用户手机上运行的，任何人打开浏览器"查看网页源代码"都能把 Key 抄走拿去用，账单算在你头上。所以要有一层后端代码，Key 只存在服务器的环境变量里，手机只跟你自己的后端说话，后端再拿着 Key 去跟 DeepSeek/Claude/Gemini 说话。

这个项目里后端是 Vercel 的 Serverless Function（`api/advice.js`），部署的时候和前端算作同一个项目、同一个域名，不需要你额外去买服务器。

### 顺便解决了翻墙问题

Vercel 的服务器本身就在境外（不在中国大陆），所以由它去请求 Claude/Gemini 完全不需要代理。你手机端全程只是在跟"自己的域名"打交道，不用开 VPN。DeepSeek 服务器在国内，直连更快。

## 目录结构

```
.
├── index.html          前端页面
├── app.js               前端逻辑：录音识别、调用后端、渲染建议
├── manifest.json         PWA 配置（让它能"添加到主屏幕"）
├── service-worker.js     离线缓存（只缓存静态文件，/api 不缓存）
├── icons/                应用图标
├── api/
│   └── advice.js         后端：接收文字，调用 LLM，返回建议
├── package.json
└── .env.example          环境变量模板
```

## 本地开发

需要先装 [Vercel CLI](https://vercel.com/docs/cli)（用来在本地同时跑前端静态文件和 `/api` 函数）：

```bash
npm install -g vercel
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY（或你选的其他提供商的 key）
vercel dev
```

打开终端提示的本地地址（一般是 `http://localhost:3000`），手机和电脑在同一个 WiFi 下，也可以用电脑的局域网 IP 在手机浏览器里打开测试。

> 语音识别（`getUserMedia` / 麦克风权限）在大多数浏览器里**只有 HTTPS 或 localhost 才能用**，`vercel dev` 的 localhost 满足条件，正式使用要走 HTTPS 部署（见下面）。

## 部署到 Vercel（推荐，免费）

1. 把这个项目推到 GitHub（见下一节）
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录，选择 "Import Project"，选中这个仓库
3. 在 Vercel 项目的 Settings → Environment Variables 里添加：
   - `AI_PROVIDER` = `deepseek`（或 `claude` / `gemini`）
   - 对应的 API Key，比如 `DEEPSEEK_API_KEY`
4. 点 Deploy，几十秒后会拿到一个 `https://你的项目名.vercel.app` 的地址
5. 手机浏览器打开这个地址 → 浏览器菜单里选"添加到主屏幕" → 就有了一个图标，跟 App 差不多的体验

## 推送到 GitHub

这个项目已经在本地 `git init` 过了。推到 GitHub：

```bash
git add .
git commit -m "init: 步语 PWA 首个可用版本"
# 在 GitHub 网站上新建一个空仓库，拿到它的地址后：
git remote add origin <你的仓库地址>
git branch -M main
git push -u origin main
```

## 切换模型（DeepSeek / Claude / Gemini）

只需要改一个环境变量 `AI_PROVIDER`，不需要改代码：

- `AI_PROVIDER=deepseek`（默认）→ 需要 `DEEPSEEK_API_KEY`
- `AI_PROVIDER=claude` → 需要 `ANTHROPIC_API_KEY`
- `AI_PROVIDER=gemini` → 需要 `GEMINI_API_KEY`

## 修改人设 / 建议风格

打开 `api/advice.js`，改 `SYSTEM_PROMPT` 这个常量就行，三个模型共用同一段人设，改一处三个都会变。

## 已知限制

- **iPhone 的 Safari 不支持浏览器语音识别**（Web Speech API 在 iOS Safari 上没有实现），打开后会自动显示文字输入框作为替代。安卓手机的 Chrome 支持得比较好。
- **浏览器自带的语音识别本身要连网**（Chrome 用的是谷歌的识别服务），在国内网络环境下可能会遇到识别失败（报错会提示"网络问题"）。如果这个问题频繁出现，下一步可以把识别这部分换成讯飞 / 阿里云的语音听写 API（国内直连，更稳定），架构上只需要改前端调用识别的这部分，后端不用动。
- 目前建议只以文字展示，没有语音播报（按你的要求去掉了 TTS）。
- 离线缓存只覆盖静态页面外壳，生成建议必须联网。

## 后续可以加的东西

- 记忆：把每次的对话存下来（比如 SQLite 或飞书多维表格），让 LLM 在下一次对话时能带上下文，从"一次性问答"变成"持续陪伴"。
- 把 Web Speech API 换成讯飞/阿里云语音识别，解决国内网络识别不稳定的问题。
- 在设置里允许直接切换 AI_PROVIDER，而不用改环境变量重新部署。
