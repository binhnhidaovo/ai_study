let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
localStorage.setItem("session_id", session_id);

let autoSpeak = true;

function toggleSpeak() {
    autoSpeak = !autoSpeak;
    alert(autoSpeak ? "Voice ON" : "Voice OFF");
}

function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function detectLang(text) {
    const vietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vietnamese.test(text) ? "vi-VN" : "en-US";
}

function speak(text) {
    if (!autoSpeak) return;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = detectLang(text);
    utter.rate = 1;
    utter.pitch = 1;
    speechSynthesis.speak(utter);
}

async function send() {
    const input = document.getElementById("input");
    const text = input.value.trim();
    if (!text) return;

    add("user", text);
    input.value = "";

    const res = await fetch("/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ session_id, message: text })
    });

    const data = await res.json();
    add("ai", data.reply);
    speak(data.reply);
}

function startVoice() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Browser không hỗ trợ voice");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.lang = "vi-VN"; // nói Việt hoặc Anh đều OK
    recognition.continuous = false;

    recognition.onresult = (e) => {
        document.getElementById("input").value =
            e.results[0][0].transcript;
        send();
    };

    recognition.start();
}
