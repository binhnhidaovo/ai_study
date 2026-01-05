// ===== SESSION & SIDEBAR =====
let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

if (!sessions.includes(session_id)) {
    sessions.push(session_id);
    localStorage.setItem("sessions", JSON.stringify(sessions));
}

localStorage.setItem("session_id", session_id);

let autoSpeak = true;

// ===== VOICE ON / OFF =====
function toggleSpeak() {
    autoSpeak = !autoSpeak;
    alert(autoSpeak ? "Voice ON" : "Voice OFF");
}

// ===== ADD MESSAGE =====
function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

// ===== DETECT LANGUAGE =====
function detectLang(text) {
    const vietnamese =
        /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vietnamese.test(text) ? "vi-VN" : "en-US";
}

// ===== TEXT TO SPEECH =====
function speak(text) {
    if (!autoSpeak) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = detectLang(text);
    utter.rate = 1;
    utter.pitch = 1;
    speechSynthesis.speak(utter);
}

// ===== SEND MESSAGE =====
async function send() {
    const input = document.getElementById("input");
    const text = input.value.trim();
    if (!text) return;

    add("user", text);
    input.value = "";

    const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id, message: text })
    });

    const data = await res.json();
    add("ai", data.reply);
    speak(data.reply);
}

// ===== VOICE INPUT =====
function startVoice() {
    if (!("webkitSpeechRecognition" in window)) {
        alert("Browser không hỗ trợ voice");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = "vi-VN"; // nói Anh vẫn nhận
    recognition.continuous = false;

    recognition.onresult = (e) => {
        document.getElementById("input").value =
            e.results[0][0].transcript;
        send();
    };

    recognition.start();
}

// ===== SIDEBAR FUNCTIONS =====
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

    history.forEach(m => {
        add(m.role === "user" ? "user" : "ai", m.content);
    });
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
