from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from pathlib import Path
from ai import ask_openai

app = FastAPI()

sessions = {}

BASE_DIR = Path(__file__).parent

@app.get("/", response_class=HTMLResponse)
async def home():
    return (BASE_DIR / "index.html").read_text(encoding="utf-8")

class ChatRequest(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
def chat(req: ChatRequest):
    history = sessions.get(req.session_id, [])

    reply = ask_openai(req.message, history)

    history.append({"role": "user", "content": req.message})
    history.append({"role": "assistant", "content": reply})

    sessions[req.session_id] = history

    return {
        "reply": reply,
        "history": history
    }
