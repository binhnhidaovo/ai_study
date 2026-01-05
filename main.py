from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import os, json
from openai import OpenAI

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app.mount("/static", StaticFiles(directory="static"), name="static")

SYSTEM_PROMPT = """
Bạn là giáo viên Toán người Việt.
Giải thích chậm rãi, rõ ràng, dễ hiểu.
Luôn trả lời bằng tiếng Việt tự nhiên.
"""

@app.get("/", response_class=HTMLResponse)
def home():
    with open("templates/index.html", "r", encoding="utf-8") as f:
        return f.read()

# ================== CHAT HISTORY ==================
@app.get("/history/{session_id}")
def get_history(session_id: str):
    return sessions.get(session_id, [])


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

            stream.close()

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
