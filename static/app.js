// ===== SESSION & SIDEBAR =====
let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
let sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

speechSynthesis.onvoiceschanged = () => {};


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


function speak(text) {
    if (!autoSpeak || !text.trim()) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;   // chậm hơn cho tự nhiên
    utter.pitch = 1;

    const voices = speechSynthesis.getVoices();
    const lang = detectLang(text);

    let selectedVoice = null;

    if (lang === "vi-VN") {
        selectedVoice = voices.find(v =>
            v.lang.startsWith("vi") &&
            (v.name.includes("Microsoft") || v.name.includes("Google"))
        );
        utter.lang = "vi-VN";
    } else {
        selectedVoice = voices.find(v =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") || v.name.includes("Microsoft"))
        );
        utter.lang = "en-US";
    }

    if (selectedVoice) {
        utter.voice = selectedVoice;
    }

    speechSynthesis.speak(utter);
}


async function send() {
    const input = document.getElementById("input");
    const messages = document.getElementById("messages");

    const text = input.value.trim();
    if (!text) return;

    add("user", text);
    input.value = "";
    input.disabled = true;

    const aiDiv = document.createElement("div");
    aiDiv.className = "msg ai";
    aiDiv.innerText = "";
    messages.appendChild(aiDiv);
    messages.scrollTop = messages.scrollHeight;

    let fullText = "";

    try {
        const res = await fetch("/chat_stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                session_id: session_id,
                message: text
            })
        });

        if (!res.ok || !res.body) {
            aiDiv.innerText = "❌ Lỗi kết nối server";
            input.disabled = false;
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (let line of lines) {
                if (!line.startsWith("data: ")) continue;

                const data = line.slice(6);

                if (data === "[DONE]") {
                    speak(fullText); // đọc sau khi stream xong
                    input.disabled = false;
                    return;
                }

                fullText += data;
                aiDiv.innerText = fullText;
                messages.scrollTop = messages.scrollHeight;
            }
        }
    } catch (err) {
        aiDiv.innerText = "❌ Có lỗi xảy ra";
        console.error(err);
        input.disabled = false;
    }
}



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
