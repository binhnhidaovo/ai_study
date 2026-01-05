from datetime import datetime
from openai import OpenAI
import os
import re

MODEL_NAME = "gpt-4o-mini"

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful study assistant AI.\n"
        "If the user speaks Vietnamese, reply in Vietnamese.\n"
        "If the user speaks English, reply in English.\n"
        "Explain clearly, step by step, with simple examples.\n"
        "Help with Math, Physics, Chemistry, Biology, History, and studying."
    )
}

def get_current_datetime():
    now = datetime.now()
    return now.strftime("%A, %B %d, %Y"), now.strftime("%H:%M:%S")

def is_vietnamese(text: str) -> bool:
    return bool(re.search(
        r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩ"
        r"òóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
        text.lower()
    ))

def ask_openai(user_input, history):
    lowered = user_input.lower()

    if "time" in lowered:
        _, time_str = get_current_datetime()
        return "The current time is " + time_str + "."

    if "date" in lowered or "day" in lowered:
        date_str, _ = get_current_datetime()
        return "Today is " + date_str + "."

    messages = [SYSTEM_PROMPT] + history

    if is_vietnamese(user_input):
        messages.append({
            "role": "user",
            "content": "Trả lời bằng tiếng Việt: " + user_input
        })
    else:
        messages.append({
            "role": "user",
            "content": user_input
        })

    response = client.responses.create(
        model=MODEL_NAME,
        input=messages
    )

    return response.output_text
