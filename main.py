from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File, Form
import json, uuid, base64, os
from openai import OpenAI

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app.mount("/static", StaticFiles(directory="static"), name="static")

sessions: dict[str, list] = {}

SYSTEM_PROMPT = """
Bạn là giáo viên Toán người Việt Nam, đang dạy học sinh Việt Nam.

QUY TẮC:
- Chỉ dùng tiếng Việt tự nhiên
- Giải thích như nói trực tiếp trên lớp

TRÌNH BÀY:
Đề bài:
Phân tích:
Lời giải:
Bước 1:
Bước 2:
Kết luận:

NẾU CÓ ẢNH:
- Đọc chính xác chữ viết tay
"""

@app.get("/", response_class=HTMLResponse)
def home():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/chat_stream")
async def chat_stream(
    session_id: str = Form(...),
    message: str = Form(""),
    image: UploadFile | None = File(None)
):
    history = sessions.get(session_id, [])

    async def event_generator():
        reply = ""

        try:
            content = [
                {
                    "type": "input_text",
                    "text": f"{SYSTEM_PROMPT}\n\nStudent request: {message or 'Solve the problem in the image'}"
                }
            ]

            if image:
                image_bytes = await image.read()
                image_b64 = base64.b64encode(image_bytes).decode("utf-8")
                content.append({
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{image_b64}"
                })

            stream = client.responses.stream(
                model="gpt-4o-mini",
                input=[{"role": "user", "content": content}]
            )

            for event in stream:
                if event.type == "response.output_text.delta":
                    reply += event.delta
                    yield f"data: {json.dumps({'content': event.delta}, ensure_ascii=False)}\n\n"

                if event.type == "response.completed":
                    history.append({"role": "user", "content": message})
                    history.append({"role": "assistant", "content": reply})
                    sessions[session_id] = history
                    yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ========= HISTORY =========
@app.get("/history/{session_id}")
def get_history(session_id: str):
    return sessions.get(session_id, [])

@app.post("/new_chat")
def new_chat():
    sid = str(uuid.uuid4())
    sessions[sid] = []
    return {"session_id": sid}
