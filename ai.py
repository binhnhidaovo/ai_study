from datetime import datetime
from openai import OpenAI
import os

MODEL_NAME = "gpt-4o-mini"

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a helpful study assistant AI. "
        "You explain concepts clearly and naturally in English. "
        "You help students with Math, Physics, Chemistry, Biology, History, and more. "
        "Give step-by-step explanations and simple examples."
    )
}

def get_current_datetime():
    now = datetime.now()
    return now.strftime("%A, %B %d, %Y"), now.strftime("%H:%M:%S")


def ask_openai(user_input, history):
    lowered = user_input.lower()

    if "time" in lowered:
        _, time_str = get_current_datetime()
        return "The current time is " + time_str + "."

    if "date" in lowered or "day" in lowered:
        date_str, _ = get_current_datetime()
        return "Today is " + date_str + "."

    messages = [SYSTEM_PROMPT] + history
    messages.append({"role": "user", "content": user_input})

    response = client.responses.create(
        model=MODEL_NAME,
        input=messages
    )

    return response.output_text
