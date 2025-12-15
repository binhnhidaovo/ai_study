from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from pathlib import Path
from ai import ask_openai

app = FastAPI()
BASE_DIR = Path(__file__).parent

sessions = {}

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "Bạn là một trợ lý AI giống ChatGPT. "
        "Ưu tiên trả lời bằng tiếng Việt tự nhiên, rõ ràng, dễ hiểu. "
        "Chỉ dùng tiếng Anh khi người dùng yêu cầu."
    )
}

@app.get("/", response_class=HTMLResponse)
async def home():
    return (BASE_DIR / "index.html").read_text(encoding="utf-8")

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    history = sessions.get(req.session_id)

    if not history:
        history = [SYSTEM_PROMPT]

    history.append({
        "role": "user",
        "content": req.message
    })

    reply = ask_openai(req.message, history)

    history.append({
        "role": "assistant",
        "content": reply
    })

    sessions[req.session_id] = history

    return {
        "reply": reply
    }
