const messages = document.getElementById("messages");
const textarea = document.getElementById("input");

function add(text) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerText = text || "";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

async function send() {
    const text = textarea.value.trim();
    if (!text) return;

    add("👤 " + text);
    textarea.value = "";

    const aiDiv = document.createElement("div");
    aiDiv.className = "msg";
    messages.appendChild(aiDiv);

    const fd = new FormData();
    fd.append("message", text);

    const res = await fetch("/chat_stream", {
        method: "POST",
        body: fd
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let full = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (let line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;

            const parsed = JSON.parse(data);
            full += parsed.content;
            aiDiv.innerText = "🤖 " + full;
        }
    }
}
