try:
    from groq import Groq
except Exception:
    Groq = None
import os

client = None


def _get_client():
    global client
    if client is not None:
        return client
    if Groq is None:
        return None
    api_key = (os.getenv("GROQ_API_KEY", "") or "").strip()
    if not api_key:
        return None
    try:
        client = Groq(api_key=api_key)
    except Exception:
        return None
    return client


def generate_response(context, question):
    active_client = _get_client()
    if active_client is None:
        return "AI model is not configured. Please set GROQ_API_KEY."
    try:
        completion = active_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": f"""
You are a professional medical assistant AI.

Use the provided FAQ context if relevant.
Do NOT repeat the user's question.
Do NOT rephrase the symptoms.

Directly provide:
1. Possible causes
2. Basic home care advice
3. When to see a doctor

Keep the response clear, short, and medically helpful.

Context:
{context}
"""
                },
                {"role": "user", "content": question}
            ],
        )
        return completion.choices[0].message.content
    except Exception:
        return "AI model request failed. Please check GROQ_API_KEY and network access."
