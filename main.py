from fastapi import FastAPI
from pydantic import BaseModel
from ai import ask_openai

app = FastAPI()

# lưu lịch sử trong RAM (đủ cho bản đầu)
sessions = {}

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

    return {"reply": reply}
