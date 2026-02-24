from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import ChatHistory, Conversation, UploadedReport, User
from .json_search import search_faq_json, load_faqs
from .translation import detect_language, translate_to_en, translate_back
import os
import base64
from io import BytesIO
from datetime import date
import secrets
import re
import shutil


def _contains_devanagari(text):
    value = text or ""
    return any("\u0900" <= ch <= "\u097f" for ch in value)


def _clean_extracted_text(text):
    value = text or ""
    value = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", " ", value)
    # Remove PDF font-encoding artifacts such as "cid:127" or "(cid:127)".
    value = re.sub(r"\(?\s*cid\s*:\s*\d+\s*\)?", " ", value, flags=re.IGNORECASE)
    # Collapse repeated whitespace after cleanup.
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _extract_report_field(text, labels):
    value = " ".join((text or "").split())
    if not value:
        return ""

    label_group = "|".join(re.escape(label) for label in labels)
    pattern = (
        rf"(?:{label_group})\s*[:\-]\s*(.+?)"
        r"(?=(?:\bDisease(?:\s*Name)?\b|\bSymptoms?\b|\bPossible\s*Causes?\b|"
        r"\bHome\s*Care(?:\s*Advice)?\b|\bHome\s*Management(?:\s*&\s*Support)?\b|"
        r"\bWhen\s*to\s*Visit(?:\s*a)?\s*Doctor\b|$))"
    )
    match = re.search(pattern, value, flags=re.IGNORECASE)
    return match.group(1).strip(" .;,\n\t") if match else ""


def _build_upload_file_section(extracted_text):
    disease = _extract_report_field(extracted_text, ["Disease Name", "Disease"])
    symptoms = _extract_report_field(extracted_text, ["Symptoms", "Symptom"])
    home_care = _extract_report_field(
        extracted_text,
        ["Home Care", "Home Care Advice", "Home Management", "Home Management & Support"],
    )

    if not disease and not symptoms and not home_care:
        snippet = " ".join((extracted_text or "").split())[:280]
        return (
            "Text found in file:\n"
            "Disease: Not clearly found\n"
            "Symptoms: Not clearly found\n"
            "Home Care: Not clearly found\n"
            f"Summary: {snippet}"
        )

    return (
        "Text found in file:\n"
        f"Disease: {disease or 'Not clearly found'}\n"
        f"Symptoms: {symptoms or 'Not clearly found'}\n"
        f"Home Care: {home_care or 'Not clearly found'}"
    )


def _build_brief_file_summary(extracted_text):
    value = " ".join((extracted_text or "").split())
    if not value:
        return "Brief Summary from file:\nNot clearly found."

    # Drop translator watermark/domain noise from uploaded text.
    value = re.sub(r"www\.onlinedoctranslator\.com", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\bonlinedoctranslator\.com\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\bTranslation\s+from\s+English\s+to\s+Hindi\b", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value).strip()

    disease = _extract_report_field(
        value,
        ["Disease Name", "Disease", "Name of the disease", "Illness", "Condition"],
    )
    symptoms = _extract_report_field(
        value,
        ["Symptoms", "Symptom", "Common symptoms"],
    )

    # Prefer structured fields when they are available.
    if disease or symptoms:
        parts = []
        if disease:
            parts.append(f"Disease: {disease}")
        if symptoms:
            parts.append(f"Symptoms: {symptoms}")
        summary = "\n".join(parts).strip()
    else:
        # Prefer first meaningful chunks over the full noisy body.
        chunks = [part.strip(" -:;,.") for part in re.split(r"[.!?]\s+|[\n\r]+", value) if part.strip()]
        summary = " ".join(chunks[:2]).strip()
        if not summary:
            summary = value

    # Remove frequent OCR uppercase token noise (e.g., "WRI WA SIS").
    summary = re.sub(r"\b[A-Z]{2,4}\b", " ", summary)
    summary = re.sub(r"\$+\d+\s*:?", " ", summary)
    summary = re.sub(r"\s+", " ", summary).strip()

    # Keep key report headings readable on separate lines.
    summary = re.sub(r"\s*(Disease\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)
    summary = re.sub(r"\s*(Symptoms?\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)
    summary = re.sub(r"\s*(Home\s*Care\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)
    summary = re.sub(
        r"\s*(Home\s+management\s+and\s+assistance\s*:)\s*",
        r"\n\1 ",
        summary,
        flags=re.IGNORECASE,
    )
    summary = re.sub(r"\s*(Medical\s+Report\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)
    summary = re.sub(r"\s*(Common\s+symptoms\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)
    summary = re.sub(r"\s*(Name\s+of\s+the\s+disease\s*:)\s*", r"\n\1 ", summary, flags=re.IGNORECASE)

    # If summary still looks noisy, keep output safe and readable.
    tokens = [token for token in re.split(r"\s+", summary) if token]
    short_tokens = sum(1 for token in tokens if len(token) <= 2)
    if tokens and (short_tokens / len(tokens)) > 0.35:
        summary = "Not clearly found from uploaded text."

    summary = summary[:260].rstrip(" ,;:.")
    return f"Brief Summary from file:\n{summary}"


def _strip_summary_prefix(text):
    value = (text or "").strip()
    for prefix in ("Brief Summary from file:\n", "Brief Summary from file:"):
        if value.startswith(prefix):
            return value[len(prefix):].strip()
    return value


def _find_faq_by_keyword(keyword):
    target = (keyword or "").strip().lower()
    if not target:
        return None
    for faq in load_faqs():
        if (faq.get("keyword") or "").strip().lower() == target:
            return faq
    return None


def _faq_keyword_to_gu(keyword):
    mapping = {
        "thyroid": "થાયરોઇડની તકલીફ",
        "covid": "કોરોના (કોવિડ-19)",
        "cough": "ખાંસી",
        "cold": "સર્દી",
        "fever": "તાવ",
        "asthma": "દમ",
        "diabetes": "મધુમેહ",
        "high blood pressure": "ઉચ્ચ રક્તચાપ",
        "low blood pressure": "નીચું રક્તચાપ",
        "anemia": "અનીમિયા",
        "dengue": "ડૅન્ગ્યૂ",
        "malaria": "મેલેરિયા",
        "pneumonia": "ન્યુમોનિયા",
    }
    key = (keyword or "").strip().lower()
    return mapping.get(key, translate_back((keyword or "").title(), "gu"))


def _has_meaningful_text(text):
    value = (text or "").strip()
    if len(value) < 24:
        return False
    alnum_count = sum(ch.isalnum() for ch in value)
    return alnum_count >= 16


def _preferred_to_ocr_lang(preferred_language):
    mapping = {
        "en": "eng",
        "hi": "hin",
        "gu": "guj",
    }
    return mapping.get((preferred_language or "").strip().lower(), "")


def _resolve_tessdata_dir():
    candidates = [
        os.getenv("TESSDATA_PREFIX", "").strip(),
        os.path.join(os.getenv("LOCALAPPDATA", ""), "TesseractData", "tessdata"),
        r"C:\Program Files\Tesseract-OCR\tessdata",
        r"C:\Program Files (x86)\Tesseract-OCR\tessdata",
    ]
    for raw in candidates:
        if not raw:
            continue
        path = raw.rstrip("\\/")
        if os.path.isdir(path):
            return path
    return ""


def _available_tesseract_languages():
    try:
        import pytesseract
        langs = pytesseract.get_languages(config="") or []
        return {str(lang).strip().lower() for lang in langs}
    except Exception:
        return set()


def _resolve_ocr_lang(preferred_language="", prefer_native=False):
    available = _available_tesseract_languages()
    preferred_ocr = _preferred_to_ocr_lang(preferred_language)

    if prefer_native and preferred_ocr == "guj":
        if "guj" in available and "eng" in available:
            return "guj+eng"
        if "guj" in available:
            return "guj"

    if prefer_native and preferred_ocr == "hin":
        if "hin" in available and "eng" in available:
            return "hin+eng"
        if "hin" in available:
            return "hin"

    if "eng" in available:
        return "eng"
    return preferred_ocr or "eng"


def _missing_required_ocr_lang(preferred_language=""):
    preferred_ocr = _preferred_to_ocr_lang(preferred_language)
    if preferred_ocr not in {"hin", "guj"}:
        return ""
    available = _available_tesseract_languages()
    return preferred_ocr if preferred_ocr and preferred_ocr not in available else ""


def _ocr_image_text(image, preferred_language="", prefer_native=False):
    from PIL import Image, ImageFilter, ImageOps
    import pytesseract

    if image.mode not in {"L", "RGB"}:
        image = image.convert("RGB")

    gray = image.convert("L")
    autocontrast = ImageOps.autocontrast(gray)
    sharpened = autocontrast.filter(ImageFilter.SHARPEN)

    if hasattr(Image, "Resampling"):
        upsample_filter = Image.Resampling.LANCZOS
    else:
        upsample_filter = Image.LANCZOS

    upscaled = sharpened.resize(
        (max(1, sharpened.width * 2), max(1, sharpened.height * 2)),
        upsample_filter,
    )
    thresholded = upscaled.point(lambda p: 255 if p > 165 else 0)

    variants = [gray, autocontrast, sharpened, upscaled, thresholded]
    configs = [
        "--oem 3 --psm 6",
        "--oem 3 --psm 11",
        "--oem 3 --psm 4",
    ]
    ocr_lang = _resolve_ocr_lang(preferred_language, prefer_native=prefer_native)

    best_text = ""
    for variant in variants:
        for config in configs:
            text = pytesseract.image_to_string(variant, lang=ocr_lang, config=config) or ""
            cleaned = _clean_extracted_text(text)
            if len(cleaned) > len(best_text):
                best_text = cleaned

    if best_text:
        return best_text

    fallback = pytesseract.image_to_string(image, lang=ocr_lang, config="--oem 3 --psm 3") or ""
    return _clean_extracted_text(fallback)


def _looks_like_medical_extract(text):
    value = (text or "").lower()
    if not value:
        return False
    markers = (
        "disease", "symptom", "home care", "possible causes", "when to visit",
        "रोग", "लक्षण", "घरेलू", "कारण",
        "રોગ", "લક્ષણ", "ઘરેલુ", "સંભવિત", "કારણ",
    )
    return any(marker in value for marker in markers)


def _unique_username(base):
    normalized = (base or "user").strip().lower().replace(" ", "_")
    candidate = normalized or "user"
    index = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{normalized}_{index}"
        index += 1
    return candidate


def _build_auth_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "language": user.language,
            "dob": user.dob.isoformat() if user.dob else None,
            "gender": user.gender or "",
        },
    }


ALLOWED_REPORT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}
ALLOWED_REPORT_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/tiff",
    "image/webp",
}


def _is_supported_upload(uploaded_file):
    name = (uploaded_file.name or "").lower()
    ext = os.path.splitext(name)[1]
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    return ext in ALLOWED_REPORT_EXTENSIONS or content_type in ALLOWED_REPORT_MIME_TYPES


def _extract_text_from_file(uploaded_file, preferred_language=""):
    name = (uploaded_file.name or "").lower()
    ext = os.path.splitext(name)[1]
    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()

    if ext == ".pdf" or content_type == "application/pdf":
        try:
            import pdfplumber
            text_parts = []
            tesseract_ready = _configure_tesseract_ocr()
            needs_ocr = False
            with pdfplumber.open(uploaded_file) as pdf:
                for page in pdf.pages:
                    page_text = _clean_extracted_text(page.extract_text() or "")
                    if _has_meaningful_text(page_text):
                        text_parts.append(page_text)
                        continue

                    needs_ocr = True
                    if not tesseract_ready:
                        continue
                    try:
                        page_image = page.to_image(resolution=300).original
                        ocr_text = _ocr_image_text(page_image, preferred_language)
                        if _has_meaningful_text(ocr_text):
                            text_parts.append(ocr_text)
                    except Exception:
                        continue

            if text_parts:
                return _clean_extracted_text("\n".join(text_parts).strip())
            if needs_ocr and not tesseract_ready:
                return "__TESSERACT_NOT_FOUND__"
            return _clean_extracted_text("\n".join(text_parts).strip())
        except Exception:
            return ""

    if ext in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"} or content_type.startswith("image/"):
        try:
            if not _configure_tesseract_ocr():
                return "__TESSERACT_NOT_FOUND__"
            try:
                uploaded_file.seek(0)
            except Exception:
                pass

            from PIL import Image
            image = Image.open(uploaded_file)
            text_primary = _ocr_image_text(image, preferred_language)
            if _has_meaningful_text(text_primary) and _looks_like_medical_extract(text_primary):
                return text_primary

            # Image-only Hindi fallback: improve Hindi source OCR even when
            # target response language is English/Gujarati.
            text_hi = _ocr_image_text(image, "hi", prefer_native=True)
            if _has_meaningful_text(text_hi) and _looks_like_medical_extract(text_hi):
                return text_hi

            # Image-only Gujarati fallback: improve Gujarati source OCR even when
            # target response language is English/Hindi.
            text_gu = _ocr_image_text(image, "gu", prefer_native=True)
            if _has_meaningful_text(text_gu) and _looks_like_medical_extract(text_gu):
                return text_gu

            return text_primary or text_hi or text_gu
        except Exception:
            return ""

    return ""


def _configure_tesseract_ocr():
    try:
        import pytesseract
    except Exception:
        return False

    if shutil.which("tesseract"):
        return True

    candidates = [
        os.getenv("TESSERACT_CMD", "").strip(),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]
    for path in candidates:
        if path and os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            return True

    return False


def _is_truthy(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_preferred_language(value):
    raw = (value or "").strip().lower()
    mapping = {
        "en": "en",
        "en-us": "en",
        "english": "en",
        "hi": "hi",
        "hi-in": "hi",
        "hindi": "hi",
        "gu": "gu",
        "gu-in": "gu",
        "gujarati": "gu",
        "auto": "",
    }
    return mapping.get(raw, "")


def _tts_lang(lang):
    value = (lang or "en").strip().lower()
    supported = {"en", "hi", "gu", "fr", "es"}
    return value if value in supported else "en"


def _text_to_speech_base64(text, lang):
    try:
        from gtts import gTTS
        buffer = BytesIO()
        gTTS(text=text, lang=_tts_lang(lang), slow=False).write_to_fp(buffer)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:
        return None


def _generate_chat_response(message, preferred_language=""):
    source_lang = detect_language(message)
    if _contains_devanagari(message):
        source_lang = "hi"

    message_en = translate_to_en(message, source_lang)

    faq = search_faq_json(message_en)
    if not faq and message_en.strip().lower() != message.strip().lower():
        faq = search_faq_json(message)

    if not faq:
        response_en = "Sorry, this information is not available in the FAQ data."
    else:
        response_en = (
            f"Disease: {faq['keyword'].title()}. "
            f"Possible Causes: {faq['possible_causes']}. "
            f"Home Care Advice: {faq['home_care']}. "
            f"When to Visit Doctor: {faq['when_to_visit']}."
        )

    response_lang = preferred_language or source_lang
    final_response = translate_back(response_en, response_lang)
    return final_response, response_lang


@api_view(["POST"])
@permission_classes([AllowAny])
def signup_view(request):
    username = (request.data.get("username") or "").strip()
    email = (request.data.get("email") or "").strip()
    password = request.data.get("password") or ""

    if not username or not email or not password:
        return Response(
            {"error": "username, email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        role="patient",
    )
    return Response(_build_auth_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    user = authenticate(username=username, password=password)
    if not user:
        return Response({"error": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)

    return Response(_build_auth_payload(user), status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def google_login_view(request):
    id_token_value = (request.data.get("id_token") or "").strip()

    if not id_token_value:
        return Response({"error": "id_token is required for Google sign-in."}, status=status.HTTP_400_BAD_REQUEST)

    if not settings.GOOGLE_CLIENT_ID:
        return Response(
            {"error": "Google OAuth is not configured on server."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
    except Exception:
        return Response(
            {"error": "google-auth package is missing on server."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        token_info = google_id_token.verify_oauth2_token(
            id_token_value,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        return Response({"error": "Invalid Google token."}, status=status.HTTP_401_UNAUTHORIZED)

    email = (token_info.get("email") or "").strip()
    full_name = (token_info.get("name") or "").strip()

    if not email:
        return Response({"error": "Google account email not found."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email=email).first()
    if not user:
        base = (full_name or email.split("@")[0]).strip()
        user = User.objects.create_user(
            username=_unique_username(base),
            email=email,
            password=secrets.token_urlsafe(32),
            role="patient",
        )
        if full_name:
            parts = full_name.split()
            user.first_name = parts[0]
            user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
            user.save(update_fields=["first_name", "last_name"])

    return Response(_build_auth_payload(user), status=status.HTTP_200_OK)


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    user = request.user
    if request.method == "GET":
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "language": user.language,
                "dob": user.dob.isoformat() if user.dob else None,
                "gender": user.gender or "",
            },
            status=status.HTTP_200_OK,
        )

    username = (request.data.get("username") or user.username).strip()
    email = (request.data.get("email") or user.email).strip()
    dob_value = request.data.get("dob", user.dob.isoformat() if user.dob else "")
    gender = (request.data.get("gender") or "").strip().lower()

    if not username:
        return Response({"error": "Username is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not email:
        return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.exclude(id=user.id).filter(username=username).exists():
        return Response({"error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.exclude(id=user.id).filter(email=email).exists():
        return Response({"error": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)

    allowed_genders = {"", "male", "female", "other", "prefer_not_to_say"}
    if gender not in allowed_genders:
        return Response({"error": "Invalid gender."}, status=status.HTTP_400_BAD_REQUEST)

    parsed_dob = None
    if dob_value:
        try:
            parsed_dob = date.fromisoformat(str(dob_value))
        except Exception:
            return Response({"error": "DOB must be in YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)

    user.username = username
    user.email = email
    user.gender = gender
    user.dob = parsed_dob
    user.save(update_fields=["username", "email", "gender", "dob"])

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "language": user.language,
            "dob": user.dob.isoformat() if user.dob else None,
            "gender": user.gender or "",
        },
        status=status.HTTP_200_OK,
    )


# ✅ CHAT VIEW (UNCHANGED JSON LOGIC)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_view(request):
    user = request.user
    message = request.data.get("message")
    conversation_id = request.data.get("conversation_id")
    is_voice = _is_truthy(request.data.get("is_voice", False))
    preferred_language = _normalize_preferred_language(request.data.get("preferred_language"))

    if not message:
        return Response({"response": "Please provide a valid message."})

    # 🧠 Get or Create Conversation
    if conversation_id:
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=user)
        except Conversation.DoesNotExist:
            conversation = Conversation.objects.create(user=user)
    else:
        conversation = Conversation.objects.create(user=user)

    final_response, detected_lang = _generate_chat_response(message, preferred_language)

    # 💾 Save chat
    chat_entry = ChatHistory.objects.create(
        user=user,
        conversation=conversation,
        message=message,
        response=final_response,
        language=detected_lang
    )

    payload = {
        "response": final_response,
        "conversation_id": conversation.id,
        "chat_id": chat_entry.id,
    }
    if is_voice:
        audio_base64 = _text_to_speech_base64(final_response, detected_lang)
        if audio_base64:
            payload["audio_base64"] = audio_base64

    return Response(payload)


# ✅ GET SINGLE CONVERSATION HISTORY
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation_history(request, conversation_id):
    user = request.user

    try:
        conversation = Conversation.objects.get(id=conversation_id, user=user)
    except Conversation.DoesNotExist:
        return Response({"error": "Conversation not found."}, status=404)

    messages = conversation.messages.order_by("created_at")

    data = []
    for msg in messages:
        data.append({
            "id": msg.id,
            "message": msg.message,
            "response": msg.response,
            "created_at": msg.created_at
        })

    return Response(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def edit_chat_message(request, chat_id):
    user = request.user
    new_message = request.data.get("message")
    is_voice = _is_truthy(request.data.get("is_voice", False))

    if not new_message or not str(new_message).strip():
        return Response({"error": "Please provide a valid edited message."}, status=400)

    try:
        chat_entry = ChatHistory.objects.get(id=chat_id, user=user)
    except ChatHistory.DoesNotExist:
        return Response({"error": "Chat message not found."}, status=404)

    later_messages = ChatHistory.objects.filter(
        conversation=chat_entry.conversation
    ).filter(
        Q(created_at__gt=chat_entry.created_at)
        | Q(created_at=chat_entry.created_at, id__gt=chat_entry.id)
    )
    deleted_count = later_messages.count()
    later_messages.delete()

    final_response, detected_lang = _generate_chat_response(new_message)
    chat_entry.message = new_message
    chat_entry.response = final_response
    chat_entry.language = detected_lang
    chat_entry.save(update_fields=["message", "response", "language"])

    payload = {
        "id": chat_entry.id,
        "message": chat_entry.message,
        "response": chat_entry.response,
        "deleted_messages_count": deleted_count,
    }
    if is_voice:
        audio_base64 = _text_to_speech_base64(final_response, detected_lang)
        if audio_base64:
            payload["audio_base64"] = audio_base64

    return Response(payload, status=200)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_conversation(request, conversation_id):
    user = request.user

    try:
        conversation = Conversation.objects.get(id=conversation_id, user=user)
    except Conversation.DoesNotExist:
        return Response({"error": "Conversation not found."}, status=404)

    conversation.delete()
    return Response({"message": "Conversation deleted successfully."}, status=200)


# ✅ GET ALL CONVERSATIONS (FOR SIDEBAR)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_list(request):
    conversations = Conversation.objects.filter(user=request.user).order_by('-created_at')

    # data = [
    #     {
    #         "id": conv.id,
    #         "created_at": conv.created_at
    #     }
    #     for conv in conversations
    # ]

    data = []

    for conv in conversations:
        first_msg = conv.messages.order_by("created_at").first()

        data.append({
            "id": conv.id,
            "created_at": conv.created_at,
            "first_message": first_msg.message if first_msg else None
        })



    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_report_view(request):
    user = request.user
    uploaded_file = request.FILES.get("file")
    conversation_id = request.data.get("conversation_id")
    preferred_language = _normalize_preferred_language(request.data.get("preferred_language"))

    if not uploaded_file:
        return Response({"response": "Please upload a PDF or image file."}, status=400)
    if not _is_supported_upload(uploaded_file):
        return Response(
            {"response": "Unsupported file type. Please upload PDF, PNG, JPG, JPEG, BMP, TIFF, or WEBP."},
            status=400,
        )

    if conversation_id:
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=user)
        except Conversation.DoesNotExist:
            conversation = Conversation.objects.create(user=user)
    else:
        conversation = Conversation.objects.create(user=user)

    extracted_text = _extract_text_from_file(uploaded_file, preferred_language)
    if extracted_text == "__TESSERACT_NOT_FOUND__":
        response_text = (
            "OCR engine not found for image reading. "
            "Install Tesseract OCR and set TESSERACT_CMD or add tesseract to PATH."
        )
        response_lang = preferred_language or "en"
        final_response = translate_back(response_text, response_lang)

        ChatHistory.objects.create(
            user=user,
            conversation=conversation,
            message=f"[Uploaded File] {uploaded_file.name}",
            response=final_response,
            language=response_lang,
        )

        return Response(
            {
                "response": final_response,
                "conversation_id": conversation.id,
            },
            status=200,
        )

    try:
        uploaded_file.seek(0)
    except Exception:
        pass
    if not extracted_text:
        response_text = "I could not read text from this file. Please upload a clear PDF/image."
        response_lang = preferred_language or "en"
        final_response = translate_back(response_text, response_lang)

        ChatHistory.objects.create(
            user=user,
            conversation=conversation,
            message=f"[Uploaded File] {uploaded_file.name}",
            response=final_response,
            language=response_lang,
        )

        return Response(
            {
                "response": final_response,
                "conversation_id": conversation.id,
            },
            status=200,
        )

    # Save uploaded report for record
    report = UploadedReport.objects.create(
        user=user,
        file=uploaded_file,
        extracted_text=extracted_text[:10000],
    )

    detected_lang = detect_language(extracted_text[:1200] or extracted_text)
    extracted_text_slice = extracted_text[:4000]
    if detected_lang in {"gu", "hi"}:
        # For Gujarati/Hindi uploads, normalize to English first so FAQ parsing/matching
        # stays consistent, then translate final response to requested language.
        extracted_text_en = translate_to_en(extracted_text_slice, detected_lang)
        if not extracted_text_en or extracted_text_en.strip().lower() == extracted_text_slice.strip().lower():
            extracted_text_en = extracted_text_slice
    else:
        extracted_text_en = extracted_text_slice

    faq = search_faq_json(extracted_text_en)
    if not faq and extracted_text_en.strip().lower() != extracted_text_slice.strip().lower():
        faq = search_faq_json(extracted_text_slice)

    if detected_lang == "gu":
        english_view = (extracted_text_en or "").lower()
        # Gujarati reports often mention hypothyroidism while FAQ keyword is "thyroid".
        # Force consistent mapping so Gujarati->Gujarati/Hindi stays aligned with English output.
        if "hypothyroidism" in english_view:
            thyroid_faq = _find_faq_by_keyword("thyroid")
            if thyroid_faq:
                faq = thyroid_faq
    if detected_lang == "hi":
        english_view = (extracted_text_en or "").lower()
        source_head = (extracted_text_slice or "")[:1200]
        if (
            "pyrexia" in english_view
            or "fever" in english_view
            or "बुखार" in source_head
            or "ज्वर" in source_head
        ):
            fever_faq = _find_faq_by_keyword("fever")
            if fever_faq:
                faq = fever_faq

    file_section_source = extracted_text_en if extracted_text_en.strip() else extracted_text
    file_section = _build_upload_file_section(file_section_source)
    suppress_file_section = detected_lang in {"gu", "hi"}

    if faq:
        faq_section = (
            "Matched FAQ:\n"
            f"Disease: {faq['keyword'].title()}\n"
            f"Possible Causes: {faq['possible_causes']}\n"
            f"Home Care Advice: {faq['home_care']}\n"
            f"When to Visit Doctor: {faq['when_to_visit']}"
        )
        if suppress_file_section:
            response_en = f"{_build_brief_file_summary(extracted_text_en)}\n\n{faq_section}"
        else:
            response_en = f"{file_section}\n\n{faq_section}"
    else:
        if suppress_file_section:
            response_en = (
                f"{_build_brief_file_summary(extracted_text_en)}\n\n"
                "Matched FAQ:\nNo exact disease match found in FAQ data."
            )
        else:
            response_en = (
                f"{file_section}\n\n"
                "Matched FAQ:\n"
                "No exact disease match found in FAQ data."
            )

    response_lang = preferred_language or detected_lang

    if detected_lang == "gu" and response_lang == "gu":
        # Use English summary as source to avoid OCR artifacts in Gujarati PDF extraction.
        summary_en = _strip_summary_prefix(_build_brief_file_summary(extracted_text_en))
        summary_gu = translate_back(summary_en or "Not clearly found", "gu")
        disease_key = (faq.get("keyword", "") if faq else "") or ""
        disease_en = disease_key.title() or "Not clearly found"
        symptoms_en = ", ".join(faq.get("symptoms", [])) if faq else ""
        possible_causes_en = (faq.get("possible_causes", "") if faq else "") or "Not clearly found"
        home_care_en = (faq.get("home_care", "") if faq else "") or "Not clearly found"
        when_to_visit_en = (faq.get("when_to_visit", "") if faq else "") or "Not clearly found"

        final_response = (
            f"રોગ: {_faq_keyword_to_gu(disease_key or disease_en)}\n"
            f"સમજૂતી: {summary_gu or 'સ્પષ્ટ રીતે મળ્યું નથી'}\n"
            f"લક્ષણો: {translate_back(symptoms_en or 'Not clearly found', 'gu')}\n"
            f"સંભવિત કારણો: {translate_back(possible_causes_en, 'gu')}\n"
            f"ઘરેલુ દેખભાળ સલાહ: {translate_back(home_care_en, 'gu')}\n"
            f"ડૉક્ટરને ક્યારે મળવું: {translate_back(when_to_visit_en, 'gu')}"
        )
    elif detected_lang == "gu" and response_lang == "hi":
        # Keep Gujarati-source uploads in the same readable line-by-line layout for Hindi output.
        summary_en = _strip_summary_prefix(_build_brief_file_summary(extracted_text_en))
        disease_key = (faq.get("keyword", "") if faq else "") or ""
        disease_en = disease_key.title() or "Not clearly found"
        symptoms_en = ", ".join(faq.get("symptoms", [])) if faq else ""
        possible_causes_en = (faq.get("possible_causes", "") if faq else "") or "Not clearly found"
        home_care_en = (faq.get("home_care", "") if faq else "") or "Not clearly found"
        when_to_visit_en = (faq.get("when_to_visit", "") if faq else "") or "Not clearly found"

        final_response = (
            f"रोग: {translate_back(disease_en, 'hi')}\n"
            f"समझाइश: {translate_back(summary_en or 'Not clearly found', 'hi')}\n"
            f"लक्षण: {translate_back(symptoms_en or 'Not clearly found', 'hi')}\n"
            f"संभावित कारण: {translate_back(possible_causes_en, 'hi')}\n"
            f"घरेलू देखभाल सलाह: {translate_back(home_care_en, 'hi')}\n"
            f"डॉक्टर से कब मिलें: {translate_back(when_to_visit_en, 'hi')}"
        )
    elif detected_lang == "hi" and response_lang == "hi":
        summary_en = _strip_summary_prefix(_build_brief_file_summary(extracted_text_en))
        disease_key = (faq.get("keyword", "") if faq else "") or ""
        disease_en = disease_key.title() or "Not clearly found"
        symptoms_en = ", ".join(faq.get("symptoms", [])) if faq else ""
        possible_causes_en = (faq.get("possible_causes", "") if faq else "") or "Not clearly found"
        home_care_en = (faq.get("home_care", "") if faq else "") or "Not clearly found"
        when_to_visit_en = (faq.get("when_to_visit", "") if faq else "") or "Not clearly found"

        final_response = (
            "फ़ाइल का संक्षिप्त सार:\n"
            f"{translate_back(summary_en or 'Not clearly found', 'hi')}\n\n"
            "मिलान किया गया FAQ:\n"
            f"रोग: {translate_back(disease_en, 'hi')}\n"
            f"लक्षण: {translate_back(symptoms_en or 'Not clearly found', 'hi')}\n"
            f"संभावित कारण: {translate_back(possible_causes_en, 'hi')}\n"
            f"घरेलू देखभाल सलाह: {translate_back(home_care_en, 'hi')}\n"
            f"डॉक्टर से कब मिलें: {translate_back(when_to_visit_en, 'hi')}"
        )
    elif detected_lang == "hi" and response_lang == "gu":
        summary_en = _strip_summary_prefix(_build_brief_file_summary(extracted_text_en))
        disease_key = (faq.get("keyword", "") if faq else "") or ""
        symptoms_en = ", ".join(faq.get("symptoms", [])) if faq else ""
        possible_causes_en = (faq.get("possible_causes", "") if faq else "") or "Not clearly found"
        home_care_en = (faq.get("home_care", "") if faq else "") or "Not clearly found"
        when_to_visit_en = (faq.get("when_to_visit", "") if faq else "") or "Not clearly found"

        final_response = (
            "ફાઇલનો સંક્ષિપ્ત સાર:\n"
            f"{translate_back(summary_en or 'Not clearly found', 'gu')}\n\n"
            "મેળવાયેલ FAQ:\n"
            f"રોગ: {_faq_keyword_to_gu(disease_key)}\n"
            f"લક્ષણો: {translate_back(symptoms_en or 'Not clearly found', 'gu')}\n"
            f"સંભવિત કારણો: {translate_back(possible_causes_en, 'gu')}\n"
            f"ઘરેલુ દેખભાળ સલાહ: {translate_back(home_care_en, 'gu')}\n"
            f"ડૉક્ટરને ક્યારે મળવું: {translate_back(when_to_visit_en, 'gu')}"
        )
    else:
        final_response = translate_back(response_en, response_lang)

    report.processed_output = final_response
    report.save(update_fields=["processed_output"])

    ChatHistory.objects.create(
        user=user,
        conversation=conversation,
        message=f"[Uploaded File] {uploaded_file.name}",
        response=final_response,
        language=response_lang,
    )

    return Response(
        {
            "response": final_response,
            "conversation_id": conversation.id,
        }
    )


