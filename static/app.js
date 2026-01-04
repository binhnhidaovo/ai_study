let session_id = localStorage.getItem("session_id") || crypto.randomUUID();
localStorage.setItem("session_id", session_id);

function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerText = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
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
        body: JSON.stringify({session_id, message: text})
    });

    const data = await res.json();
    add("ai", data.reply);
}

function newChat() {
    localStorage.removeItem("session_id");
    location.reload();
}
