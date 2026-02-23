import re
import os
try:
    from groq import Groq
except Exception:
    Groq = None

client = None


def _get_client():
    global client
    if client is not None:
        return client
    if Groq is None:
        return None
    try:
        client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    except Exception:
        return None
    return client


def _script_lang_hint(text):
    value = text or ""
    if any("\u0900" <= ch <= "\u097f" for ch in value):
        return "hi"
    if any("\u0a80" <= ch <= "\u0aff" for ch in value):
        return "gu"
    return None


def _has_devanagari(text):
    value = text or ""
    return any("\u0900" <= ch <= "\u097f" for ch in value)


def _has_gujarati(text):
    value = text or ""
    return any("\u0a80" <= ch <= "\u0aff" for ch in value)


def _romanized_lang_hint(text):
    value = (text or "").lower()
    tokens = set(re.findall(r"[a-z]+", value))
    if not tokens:
        return None

    hindi_markers = {
        "mera", "meri", "mere", "mujhe", "hai", "hain", "aur", "nahi",
        "kyu", "kya", "vajan", "baal", "jhad", "bukhar", "khansi",
        "dard", "pet", "ulti", "dast", "kamzori",
    }
    gujarati_markers = {
        "maru", "maro", "mari", "mane", "che", "ane", "vajan", "vaal",
        "khar", "khare", "taav", "khansi", "shardi", "dard", "pet",
        "ulti", "zhada", "thak",
    }

    hindi_score = sum(1 for token in tokens if token in hindi_markers)
    gujarati_score = sum(1 for token in tokens if token in gujarati_markers)

    if gujarati_score >= 2 and gujarati_score > hindi_score:
        return "gu"
    if hindi_score >= 2 and hindi_score >= gujarati_score:
        return "hi"
    return None


def _normalize_lang_code(raw_lang):
    value = (raw_lang or "").strip().lower()
    if not value:
        return "en"

    first_token = value.split()[0].strip(".,:;!?()[]{}\"'")
    language_aliases = {
        "english": "en",
        "eng": "en",
        "hindi": "hi",
        "hin": "hi",
        "hi-in": "hi",
        "gujarati": "gu",
        "guj": "gu",
        "gu-in": "gu",
        "french": "fr",
        "spanish": "es",
    }
    return language_aliases.get(first_token, first_token)


def _target_language_instruction(lang_code):
    if lang_code == "hi":
        return "Hindi in Devanagari script. Do not use Gujarati script."
    if lang_code == "gu":
        return "Gujarati in Gujarati script."
    if lang_code == "en":
        return "English."
    if lang_code == "fr":
        return "French."
    if lang_code == "es":
        return "Spanish."
    return lang_code


# 🔍 Detect Language
def detect_language(text):
    script_hint = _script_lang_hint(text)
    if script_hint:
        return script_hint
    romanized_hint = _romanized_lang_hint(text)
    if romanized_hint:
        return romanized_hint
    active_client = _get_client()
    if active_client is None:
        return "en"

    response = active_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "Detect the language of the following text. Only return language code like en, hi, fr, etc."},
            {"role": "user", "content": text}
        ],
        temperature=0
    )

    raw = response.choices[0].message.content
    return _normalize_lang_code(raw)


def _translate_with_prompt(system_prompt, text, model="llama-3.1-8b-instant"):
    active_client = _get_client()
    if active_client is None:
        return text

    response = active_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    return (response.choices[0].message.content or "").strip()


# 🔁 Translate to English
def translate_to_en(text, detected_lang=None):
    lang = _normalize_lang_code(detected_lang)
    if lang == "en":
        return text
    translated = _translate_with_prompt(
        "Translate the following text to English. Only return translated English text.",
        text,
        model="llama-3.1-8b-instant",
    )

    # If the model returns a meta reply instead of a translation, keep original text.
    meta_markers = [
        "already in english",
        "text is already in english",
    ]
    lowered = translated.lower()
    if any(marker in lowered for marker in meta_markers):
        return text

    # Retry with stronger instruction if Indic script still dominates.
    if _has_devanagari(translated) or _has_gujarati(translated):
        translated_retry = _translate_with_prompt(
            "Strictly translate the input to natural English. "
            "Do not keep Gujarati/Hindi words unless they are proper nouns. "
            "Return only English text.",
            text,
            model="llama-3.3-70b-versatile",
        )
        if translated_retry and not (_has_devanagari(translated_retry) or _has_gujarati(translated_retry)):
            translated = translated_retry

    return translated


# 🔁 Translate back to original language
def translate_back(text, lang):
    normalized_lang = _normalize_lang_code(lang)
    if normalized_lang == "en":
        # If caller asked English but text still contains Indic scripts, force cleanup translation.
        if _has_devanagari(text) or _has_gujarati(text):
            cleaned = _translate_with_prompt(
                "Translate the following text to clear English only. "
                "Do not keep Gujarati/Hindi script in output. Return only English text.",
                text,
                model="llama-3.3-70b-versatile",
            )
            return cleaned or text
        return text

    target_instruction = _target_language_instruction(normalized_lang)
    translated = _translate_with_prompt(
        (
            f"Translate the following text to {target_instruction} "
            "Only return translated text with no extra notes."
        ),
        text,
        model="llama-3.1-8b-instant",
    )

    # Enforce script direction for Hindi/Gujarati with one strong retry.
    if normalized_lang == "hi":
        if _has_gujarati(translated) and not _has_devanagari(translated):
            retry = _translate_with_prompt(
                "Translate to Hindi using only Devanagari script. "
                "Do not output Gujarati script.",
                text,
                model="llama-3.3-70b-versatile",
            )
            if retry:
                translated = retry
    elif normalized_lang == "gu":
        if _has_devanagari(translated) and not _has_gujarati(translated):
            retry = _translate_with_prompt(
                "Translate to Gujarati using only Gujarati script. "
                "Do not output Devanagari script.",
                text,
                model="llama-3.3-70b-versatile",
            )
            if retry:
                translated = retry

    return translated
