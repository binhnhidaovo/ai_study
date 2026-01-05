from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import UploadFile, File, Form
from ai import ask_openai
import json
import time
import uuid
import base64

app = FastAPI()

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Lưu session trong RAM
sessions = {}

# ===== MODELS =====
class ChatRequest(BaseModel):
    session_id: str
    message: str

class NewChatResponse(BaseModel):
    session_id: str


# ===== ROUTES =====
@app.get("/", response_class=HTMLResponse)
def home():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/chat")
async def chat(
    session_id: str = Form(...),
    message: str = Form(""),
    image: UploadFile | None = File(None)
):
    history = sessions.get(session_id, [])

    image_base64 = None
    if image:
        img_bytes = await image.read()
        image_base64 = base64.b64encode(img_bytes).decode("utf-8")

    reply = ask_openai(message, history, image_base64)

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    sessions[session_id] = history

    return {"reply": reply}


@app.post("/new_chat")
def new_chat():
    # Tạo session mới
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    return {"session_id": session_id}


@app.post("/chat_stream")
def chat_stream(req: ChatRequest):
    history = sessions.get(req.session_id, [])

    def event_generator():
        reply = ""

        # ask_openai_stream là hàm streaming (bên dưới)
        for chunk in ask_openai_stream(req.message, history):
            reply += chunk
            yield f"data: {chunk}\n\n"

        history.append({"role": "user", "content": req.message})
        history.append({"role": "assistant", "content": reply})
        sessions[req.session_id] = history

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
