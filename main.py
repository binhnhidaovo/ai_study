from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi import UploadFile, File, Form
import json
import uuid
import base64
import os

from openai import OpenAI

# ================== APP SETUP ==================
app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# In-memory chat sessions
sessions: dict[str, list] = {}

# ================== SYSTEM PROMPT ==================
SYSTEM_PROMPT = """
Bạn là giáo viên Toán người Việt Nam, đang dạy học sinh Việt Nam.

QUY TẮC BẮT BUỘC:
- Chỉ sử dụng tiếng Việt thuần, tự nhiên như giáo viên trên lớp
- Không dùng văn phong dịch từ tiếng Anh
- Không dùng từ ngữ máy móc, học thuật
- Câu văn ngắn, rõ ý, dễ hiểu
- Giải thích như đang nói trực tiếp với học sinh

CÁCH TRÌNH BÀY BẮT BUỘC:
Đề bài:
(viết lại đề bằng lời dễ hiểu)

Phân tích:
(nói rõ bài toán đang hỏi gì)

Lời giải:
Bước 1: giải thích vì sao làm bước này
Bước 2: trình bày phép tính rõ ràng

Kết luận:
(nêu đáp án bằng lời)

NẾU CÓ ẢNH:
- Đọc chính xác chữ viết tay trong ảnh
- Nếu chữ mờ, suy luận theo ngữ cảnh bài toán
- Không được nói “tôi đoán”, “có thể là”

GIỌNG VĂN:
- Giống thầy cô dạy thêm ở Việt Nam
- Rõ ràng, chậm rãi, dễ theo dõi
"""

# ================== DATA MODELS ==================
class ChatRequest(BaseModel):
    session_id: str
    message: str


# ================== ROUTES ==================
@app.get("/", response_class=HTMLResponse)
def home():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()


# ================== NON-STREAM CHAT (FALLBACK) ==================
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
            "text": (
                f"{SYSTEM_PROMPT}\n\n"
                f"Bài toán của học sinh:\n"
                f"{message or 'Hãy giải bài toán trong ảnh'}"
            )
        }
    ]

    if image:
        image_bytes = await image.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        content.append({
            "type": "input_image",
            "image_url": f"data:image/jpeg;base64,{image_b64}"
        })

    response = client.responses.create(
        model="gpt-4o-mini",
        input=[{"role": "user", "content": content}]
    )

    reply = response.output_text or ""

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    sessions[session_id] = history

    return JSONResponse({"reply": reply})


# ================== STREAMING CHAT (MAIN) ==================
@app.post("/chat_stream")
def chat_stream(req: ChatRequest):
    history = sessions.get(req.session_id, [])

    def event_generator():
        reply = ""

        try:
            content = [
                {
                    "type": "input_text",
                    "text": (
                        f"{SYSTEM_PROMPT}\n\n"
                        f"Bài toán của học sinh:\n"
                        f"{req.message or 'Hãy giải bài toán trong ảnh'}"
                    )
                }
            ]

            stream = client.responses.stream(
                model="gpt-4o-mini",
                input=[{"role": "user", "content": content}]
            )

            for event in stream:
                if event.type == "response.output_text.delta":
                    reply += event.delta
                    yield f"data: {json.dumps({'content': event.delta}, ensure_ascii=False)}\n\n"

                if event.type == "response.completed":
                    history.append({"role": "user", "content": req.message})
                    history.append({"role": "assistant", "content": reply})
                    sessions[req.session_id] = history
                    yield "data: [DONE]\n\n"

            stream.close()

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


# ================== NEW CHAT ==================
@app.post("/new_chat")
def new_chat():
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    return {"session_id": session_id}
