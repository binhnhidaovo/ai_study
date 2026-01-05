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
    message: str = Form(...)
):
    def event_generator():
        try:
            stream = client.responses.stream(
                model="gpt-4o-mini",
                input=[
                    {
                        "role": "user",
                        "content": f"{SYSTEM_PROMPT}\n\n{message}"
                    }
                ]
            )

            for event in stream:
                if event.type == "response.output_text.delta":
                    yield f"data: {json.dumps({'content': event.delta}, ensure_ascii=False)}\n\n"

                if event.type == "response.completed":
                    yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
