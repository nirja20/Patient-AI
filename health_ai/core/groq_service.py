from groq import Groq
import os

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))


def generate_response(context, question):
    completion = client.chat.completions.create(
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
