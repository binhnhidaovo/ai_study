from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import UploadFile, File, Form
import json
import uuid
import base64
import os

from openai import OpenAI

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Lưu session trong RAM
sessions = {}

# ===== PROMPT GIÁO VIÊN =====
SYSTEM_PROMPT = """
Bạn là giáo viên Toán.

Hãy làm theo đúng thứ tự:
- Đề bài:
- Phân tích:
- Lời giải:
  Bước 1:
  Bước 2:
- Kết luận:

Yêu cầu:
- Đọc chính xác chữ viết tay trong ảnh (nếu có)
- Giải từng bước rõ ràng
- Giải thích ngắn gọn, dễ hiểu cho học sinh
- Trình bày sạch sẽ
"""

# ===== MODELS =====
class ChatRequest(BaseModel):
    session_id: str
    message: str


# ===== ROUTES =====
@app.get("/", response_class=HTMLResponse)
def home():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()


# ===== CHAT (KHÔNG STREAM – dự phòng) =====
@app.post("/chat")
async def chat(
    session_id: str = Form(...),
    message: str = Form(""),
    image: UploadFile | None = File(None)
):
    history = sessions.get(session_id, [])

    content = [
        {
            "type": "input_text",
            "text": f"{SYSTEM_PROMPT}\n\nYêu cầu của học sinh: {message or 'Hãy giải bài toán trong ảnh'}"
        }
    ]

    if image:
        img_bytes = await image.read()
        image_b64 = base64.b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "input_image",
            "image_url": f"data:image/jpeg;base64,{image_b64}"
        })

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[{"role": "user", "content": content}]
    )

    reply = response.output_text

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    sessions[session_id] = history

    return {"reply": reply}


# ===== CHAT STREAM (CHÍNH) =====
@app.post("/chat_stream")
async def chat_stream(
    session_id: str = Form(...),
    message: str = Form(""),
    image: UploadFile | None = File(None)
):
    history = sessions.get(session_id, [])

    async def event_generator():
        try:
            reply = ""

            content = [
                {
                    "type": "input_text",
                    "text": f"{SYSTEM_PROMPT}\n\nYêu cầu của học sinh: {message or 'Hãy giải bài toán trong ảnh'}"
                }
            ]

            if image:
                img_bytes = await image.read()
                image_b64 = base64.b64encode(img_bytes).decode("utf-8")
                content.append({
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{image_b64}"
                })

            stream = client.responses.stream(
                model="gpt-4.1-mini",
                input=[{"role": "user", "content": content}]
            )

            for event in stream:
                if event.type == "response.output_text.delta":
                    reply += event.delta
                    yield f"data: {json.dumps({'content': event.delta})}\n\n"

                if event.type == "response.completed":
                    history.append({"role": "user", "content": message})
                    history.append({"role": "assistant", "content": reply})
                    sessions[session_id] = history
                    yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ===== NEW CHAT =====
@app.post("/new_chat")
def new_chat():
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    return {"session_id": session_id}
