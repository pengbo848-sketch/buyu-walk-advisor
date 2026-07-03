// ---- Config ----
// Same-origin deployment (Vercel serves both the static site and /api/*).
// If you ever host the frontend somewhere else, point this at your backend's full URL.
const ADVICE_ENDPOINT = "/api/advice";

// ---- Elements ----
const micBtn = document.getElementById("micBtn");
const micGlow = document.getElementById("micGlow");
const statusText = document.getElementById("statusText");
const errorBanner = document.getElementById("errorBanner");
const transcriptCard = document.getElementById("transcriptCard");
const transcriptText = document.getElementById("transcriptText");
const adviceCard = document.getElementById("adviceCard");
const adviceText = document.getElementById("adviceText");
const fallbackWrap = document.getElementById("fallbackWrap");
const fallbackInput = document.getElementById("fallbackInput");
const fallbackSend = document.getElementById("fallbackSend");

let recognition = null;
let listening = false;

// ---- Speech recognition setup ----
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

function initRecognition() {
  if (!SpeechRecognitionCtor) return null;
  const r = new SpeechRecognitionCtor();
  r.lang = "zh-CN";
  r.continuous = false;
  r.interimResults = true;

  r.onstart = () => {
    listening = true;
    micBtn.classList.add("listening");
    micGlow.classList.add("active");
    statusText.textContent = "在听……说完稍停一下就会自动发送";
    hideError();
  };

  r.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += chunk;
      else interim += chunk;
    }
    if (final || interim) {
      showTranscript(final || interim);
    }
    if (final) {
      sendToBackend(final.trim());
    }
  };

  r.onerror = (event) => {
    stopListeningUI();
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      showError("没有拿到麦克风权限。请在手机浏览器设置里允许这个网页使用麦克风，然后重试。");
    } else if (event.error === "network") {
      showError(
        "语音识别请求失败，很可能是网络问题——浏览器自带的语音识别需要连到谷歌的服务器，在国内网络下经常不通。可以先用下面的文字输入代替。"
      );
    } else if (event.error === "no-speech") {
      statusText.textContent = "没有听到声音，再试一次吧";
    } else {
      showError("语音识别出了点问题（" + event.error + "），可以用下面的文字输入试试。");
    }
  };

  r.onend = () => {
    stopListeningUI();
  };

  return r;
}

function stopListeningUI() {
  listening = false;
  micBtn.classList.remove("listening");
  micGlow.classList.remove("active");
  if (statusText.textContent.startsWith("在听")) {
    statusText.textContent = "点一下，开始说话";
  }
}

// ---- Mic button: request permission first, then start recognition ----
micBtn.addEventListener("click", async () => {
  if (!SpeechRecognitionCtor) {
    showError("这个浏览器不支持语音识别（iPhone 的 Safari 目前不支持）。用下面的文字输入吧，或者换安卓手机的 Chrome 打开试试。");
    return;
  }
  if (listening) {
    recognition.stop();
    return;
  }

  // Step 1: Request microphone permission via getUserMedia.
  // This triggers the browser's native permission dialog, which is clearer
  // than relying on SpeechRecognition to ask on first use.
  try {
    statusText.textContent = "正在申请麦克风权限……";
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted — stop the stream immediately, we don't need it.
    // SpeechRecognition uses its own audio capture internally.
    stream.getTracks().forEach((t) => t.stop());
  } catch (permErr) {
    if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
      showError("麦克风权限被拒绝。请在浏览器设置中允许本网页使用麦克风，然后重试。");
      statusText.textContent = "需要麦克风权限才能语音输入";
    } else if (permErr.name === "NotFoundError") {
      showError("没有检测到麦克风设备，请检查设备连接。");
    } else {
      showError("获取麦克风权限失败：" + permErr.message);
    }
    return;
  }

  // Step 2: Permission granted, start speech recognition.
  recognition = initRecognition();
  try {
    recognition.start();
  } catch (e) {
    showError("启动语音识别失败，请重试一次。");
  }
});

// On page load, show fallback always and set output placeholder.
window.addEventListener("DOMContentLoaded", () => {
  // Input box is always visible.
  fallbackWrap.style.display = "block";

  if (!SpeechRecognitionCtor) {
    statusText.textContent = "这台设备不支持语音识别，请使用文字输入";
  }

  // Show both output cards with placeholder text so the user knows
  // where results will appear.
  transcriptCard.classList.add("show");
  transcriptText.textContent = "（你说的话会出现在这里）";
  transcriptText.style.color = "var(--ink-dim)";

  adviceCard.classList.add("show");
  adviceText.textContent = "（建议会出现在这里）";
  adviceText.style.color = "var(--ink-dim)";
});

// ---- Fallback text input ----
fallbackSend.addEventListener("click", () => {
  const text = fallbackInput.value.trim();
  if (!text) return;
  showTranscript(text);
  fallbackInput.value = "";
  sendToBackend(text);
});

fallbackInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    fallbackSend.click();
  }
});

// ---- UI helpers ----
function showTranscript(text) {
  transcriptText.textContent = text;
  transcriptText.style.color = "";
  transcriptCard.classList.add("show");
}

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.classList.add("show");
}

function hideError() {
  errorBanner.classList.remove("show");
  errorBanner.textContent = "";
}

function showAdviceLoading() {
  adviceCard.classList.add("show");
  adviceText.style.color = "";
  adviceText.innerHTML = '正在想 <span class="dots"><span></span><span></span><span></span></span>';
}

function showAdvice(text) {
  adviceCard.classList.add("show");
  adviceText.style.color = "";
  adviceText.textContent = text;
}

// ---- Backend call ----
async function sendToBackend(text) {
  if (!text) return;
  hideError();
  showAdviceLoading();
  statusText.textContent = "";

  try {
    const res = await fetch(ADVICE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `请求失败（状态码 ${res.status}）`);
    }

    const data = await res.json();
    showAdvice(data.advice || "（没有收到内容，再说一次试试）");
  } catch (err) {
    adviceCard.classList.remove("show");
    showError("请求建议失败：" + err.message + "。检查一下后端是否已经部署、API Key 是否配置好。");
  } finally {
    statusText.textContent = "点一下，开始说话";
  }
}

// ---- PWA: register service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* offline shell is a nice-to-have, not critical */
    });
  });
}
