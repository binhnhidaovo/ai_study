// ===== SESSION & SIDEBAR =====
let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
let chatTitles = JSON.parse(localStorage.getItem("chat_titles") || "{}");

if (!sessions.includes(session_id)) {
    sessions.push(session_id);
    localStorage.setItem("sessions", JSON.stringify(sessions));
}
localStorage.setItem("session_id", session_id);

let autoSpeak = true;
let selectedImage = null;

// ===== DOM =====
const messages = document.getElementById("messages");
const textarea = document.getElementById("input");
const imageInput = document.getElementById("imageInput");

// ===== AUTO GROW TEXTAREA =====
textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
});

// ===== ENTER TO SEND =====
textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

// ===== IMAGE UPLOAD PREVIEW =====
imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    selectedImage = file;
    previewImage(file);
});

// ===== ADD MESSAGE =====
function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function previewImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const wrapper = document.createElement("div");
        wrapper.className = "msg user";

        const img = document.createElement("img");
        img.src = reader.result;
        img.className = "chat-image";

        wrapper.appendChild(img);
        messages.appendChild(wrapper);
        messages.scrollTop = messages.scrollHeight;
    };
    reader.readAsDataURL(file);
}

// ===== TYPING INDICATOR (FIX) =====
function createTypingIndicator() {
    const div = document.createElement("div");
    div.className = "msg ai";
    div.innerText = "AI đang gõ...";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
}

// ===== DETECT LANGUAGE =====
function detectLang(text) {
    const vi =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vi.test(text) ? "vi-VN" : "en-US";
}

function cleanTextForSpeech(text) {
    return text
        .replace(/\$\$[\s\S]*?\$\$/g, '')   // remove block LaTeX
        .replace(/\$.*?\$/g, '')             // remove inline LaTeX
        .replace(/\\/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function speak(text) {
    if (!autoSpeak) return;

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) return;

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = "vi-VN";
    utter.rate = 0.85;   // chậm hơn → giống giáo viên
    utter.pitch = 1.0;

    const voices = speechSynthesis.getVoices();

    // Ưu tiên voice Việt xịn
    const voice =
        voices.find(v => v.lang === "vi-VN" && v.name.includes("Google")) ||
        voices.find(v => v.lang === "vi-VN" && v.name.includes("Microsoft")) ||
        voices.find(v => v.lang === "vi-VN");

    if (voice) utter.voice = voice;

    speechSynthesis.cancel(); // tránh chồng tiếng
    speechSynthesis.speak(utter);
}


// ===== SEND =====
async function send() {
    const text = textarea.value.trim();
    if (!text && !selectedImage) return;

    if (text) add("user", text);

    textarea.value = "";
    textarea.style.height = "auto";
    textarea.readOnly = true;

    // set title lần đầu
    if (!chatTitles[session_id] && text) {
        chatTitles[session_id] = text.slice(0, 30);
        localStorage.setItem("chat_titles", JSON.stringify(chatTitles));
        renderChatList();
    }

    const typingDiv = createTypingIndicator();
    let fullText = "";
    let isFirstToken = true;

    try {
        const fd = new FormData();
        fd.append("session_id", session_id);
        fd.append("message", text || "");

        if (selectedImage) {
            fd.append("image", selectedImage);
            selectedImage = null;
        }

        const res = await fetch("/chat_stream", {
            method: "POST",
            body: fd
        });

        if (!res.ok || !res.body) {
            typingDiv.innerText = "❌ Lỗi server";
            textarea.readOnly = false;
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (let line of lines) {
                if (!line.trim()) continue;
                if (line.startsWith("data: ")) line = line.slice(6);
                if (line === "[DONE]") {
                    speak(fullText);
                    textarea.readOnly = false;
                    return;
                }

                let parsed;
                try {
                    parsed = JSON.parse(line);
                } catch {
                    parsed = { content: line };
                }

                const token = parsed.content || parsed.delta?.content || "";
                if (!token) continue;

                if (isFirstToken) {
                    typingDiv.innerText = "";
                    isFirstToken = false;
                }

                fullText += token;
                typingDiv.innerText = fullText;
                messages.scrollTop = messages.scrollHeight;
            }
        }
    } catch (e) {
        typingDiv.innerText = "❌ Lỗi kết nối";
        textarea.readOnly = false;
        console.error(e);
    }
}

// ===== VOICE INPUT =====
function startVoice() {
    if (!("webkitSpeechRecognition" in window)) {
        alert("Browser không hỗ trợ voice");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = false;

    recognition.onresult = (e) => {
        textarea.value = e.results[0][0].transcript;
        send();
    };

    recognition.start();
}

// ===== SIDEBAR =====
function renderChatList() {
    const list = document.getElementById("chat-list");
    if (!list) return;

    list.innerHTML = "";
    sessions.forEach(id => {
        const div = document.createElement("div");
        div.className = "chat-item";
        div.innerText = chatTitles[id] || "New chat";
        div.onclick = () => loadChat(id);
        list.appendChild(div);
    });
}

async function loadChat(id) {
    session_id = id;
    localStorage.setItem("session_id", id);
    messages.innerHTML = "";

    const res = await fetch("/history/" + id);
    const history = await res.json();
    history.forEach(m => add(m.role, m.content));
}

function newChat() {
    session_id = crypto.randomUUID();
    sessions.push(session_id);
    localStorage.setItem("sessions", JSON.stringify(sessions));
    localStorage.setItem("session_id", session_id);
    messages.innerHTML = "";
    renderChatList();
}

// ===== INIT =====
renderChatList();
