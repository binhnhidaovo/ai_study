// ===== SESSION & SIDEBAR =====
let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

if (!sessions.includes(session_id)) {
    sessions.push(session_id);
    localStorage.setItem("sessions", JSON.stringify(sessions));
}
localStorage.setItem("session_id", session_id);

let autoSpeak = true;

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

    previewImage(file);

    // reset để chọn lại cùng file vẫn trigger
    imageInput.value = "";
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

// ===== TYPING INDICATOR =====
function createTypingIndicator() {
    const div = document.createElement("div");
    div.className = "msg ai typing";
    div.innerHTML = "AI đang gõ<span class='dot'>.</span><span class='dot'>.</span><span class='dot'>.</span>";
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

// ===== SPEAK =====
function speak(text) {
    if (!autoSpeak || !text.trim()) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1;

    const voices = speechSynthesis.getVoices();
    const lang = detectLang(text);
    utter.lang = lang;

    const voice = voices.find(v =>
    v.lang === "vi-VN" &&
    v.name.toLowerCase().includes("google")
    );

    if (voice) utter.voice = voice;
    speechSynthesis.speak(utter);
}

async function send() {
    const text = textarea.value.trim();
    if (!text) return;

    add("user", text);
    textarea.value = "";
    textarea.style.height = "auto";
    textarea.readOnly = true;

    const typingDiv = createTypingIndicator();
    let fullText = "";

    try {
        const res = await fetch("/chat_stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id, message: text })
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

                if (line.startsWith("data: ")) {
                    line = line.slice(6);
                }

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

                const token =
                    parsed.content ||
                    parsed.delta?.content ||
                    "";

                fullText += token;
                typingDiv.innerText = fullText;
                messages.scrollTop = messages.scrollHeight;
            }
        }
    } catch (e) {
        typingDiv.innerText = "❌ Lỗi kết nối";
        console.error(e);
        textarea.readOnly = false;
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
        div.innerText = "Chat " + id.slice(0, 6);
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
