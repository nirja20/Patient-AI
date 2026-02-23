import json
import os
import re
from django.conf import settings

FAQ_FILE = os.path.join(settings.BASE_DIR, "core", "faqs.json")

HINDI_TOKEN_MAP = {
    "वजन": "weight",
    "वज़न": "weight",
    "वज़न": "weight",
    "weight": "weight",
    "badal": "change",
    "बदल": "change",
    "बदल रहा": "change",
    "बाल": "hair",
    "baal": "hair",
    "झड़": "fall",
    "झड़": "fall",
    "जड़": "fall",
    "jhad": "fall",
    "बुखार": "fever",
    "bukhar": "fever",
    "खांसी": "cough",
    "सूखी": "dry",
    "सूखा": "dry",
    "सूखी खांसी": "dry cough",
    "सूंघने": "smell",
    "सूँघने": "smell",
    "सूंघ": "smell",
    "सूँघ": "smell",
    "गंध": "smell",
    "खुशबू": "smell",
    "महक": "smell",
    "कमी": "loss",
    "कम": "loss",
    "क्षमता में कमी": "loss",
    "क्षमता कम": "loss",
    "कम हो गई": "loss",
    "कम हो गया": "loss",
    "कम हो गयी": "loss",
    "सूंघने की क्षमता में कमी": "loss smell",
    "सूँघने की क्षमता में कमी": "loss smell",
    "गंध की क्षमता में कमी": "loss smell",
    "महक की क्षमता में कमी": "loss smell",
    "khansi": "cough",
    "sukhi": "dry",
    "sukha": "dry",
    "soonghne": "smell",
    "sungne": "smell",
    "kami": "loss",
    "छींक": "sneezing",
    "छींकें": "sneezing",
    "छींके": "sneezing",
    "नाक": "nose",
    "बह रही": "runny",
    "बहता": "runny",
    "बहती": "runny",
    "बहना": "runny",
    "नाक बह": "runny",
    "गला": "throat",
    "खराश": "sore",
    "गले में खराश": "sore",
    "सर्दी": "cold",
    "jukam": "cold",
    "जुकाम": "cold",
    "सरदर्द": "headache",
    "सिरदर्द": "headache",
    "दर्द": "pain",
    "पेट": "stomach",
    "उल्टी": "vomiting",
    "दस्त": "diarrhea",
    "कमजोरी": "fatigue",

    # Gujarati support
    "વજન": "weight",
    "વઝન": "weight",
    "બદલ": "change",
    "બદલાય": "change",
    "બદલાઈ": "change",
    "બદલી": "change",
    "ફેરફાર": "change",
    "વાળ": "hair",
    "વલ": "hair",
    "ખર": "fall",
    "ખરે": "fall",
    "ખરવા": "fall",
    "ખરી": "fall",
    "ઉતરે": "fall",
    "ઉતર": "fall",
    "તાવ": "fever",
    "ખાંસી": "cough",
    "સૂકી": "dry",
    "સૂકો": "dry",
    "સુગંધ": "smell",
    "વાસ": "smell",
    "ઘ્રાણ": "smell",
    "કમી": "loss",
    "ઓછી": "loss",
    "ઓછી થઈ": "loss",
    "ઘટે": "loss",
    "ઘટી": "loss",
    "ઘટી ગઈ": "loss",
    "ઘટેલી": "loss",
    "સુગંધની ક્ષમતા ઓછી": "loss smell",
    "છીંક": "sneezing",
    "છીંકો": "sneezing",
    "નાક": "nose",
    "વહે": "runny",
    "નાક વહે": "runny",
    "ગળું": "throat",
    "ખરાશ": "sore",
    "શરદી": "cold",
    "ઠંડી": "cold",
    "માથાનો દુખાવો": "headache",
    "દુખાવો": "pain",
    "પેટ": "stomach",
    "ઉલ્ટી": "vomiting",
    "ઝાડા": "diarrhea",
    "થાક": "fatigue",
}

EN_STOPWORDS = {"a", "an", "and", "for", "in", "of", "on", "the", "to", "with"}

CONCEPT_PATTERNS = [
    # Hindi smell-loss patterns
    (r"(सूंघ|सूँघ|गंध|महक|खुशबू).{0,18}(कमी|कम|घट|नहीं)", ("loss", "smell")),
    (r"(कमी|कम|घट|नहीं).{0,18}(सूंघ|सूँघ|गंध|महक|खुशबू)", ("loss", "smell")),
    # Gujarati smell-loss patterns
    (r"(સુગંધ|વાસ|ઘ્રાણ).{0,18}(કમી|ઓછી|ઘટ)", ("loss", "smell")),
    (r"(કમી|ઓછી|ઘટ).{0,18}(સુગંધ|વાસ|ઘ્રાણ)", ("loss", "smell")),
    # Romanized smell-loss drift from speech text
    (r"(soongh|sung|smell).{0,18}(kam|loss|less|gone|reduc)", ("loss", "smell")),
    (r"(kam|loss|less|gone|reduc).{0,18}(soongh|sung|smell)", ("loss", "smell")),
    # Dry cough patterns
    (r"(सूख|dry).{0,10}(खांसी|कासी|khansi|cough)", ("dry", "cough")),
    (r"(ખાંસી|cough).{0,10}(સૂકી|dry)", ("dry", "cough")),
]


def load_faqs():
    with open(FAQ_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _stem_token(token):
    t = token.strip().lower()
    for suffix in ("ing", "edly", "edly", "ed", "ly", "es", "s"):
        if t.endswith(suffix) and len(t) > len(suffix) + 2:
            t = t[: -len(suffix)]
            break
    return t


def _tokenize(text):
    text = (text or "").lower()

    # Add Hindi/Hinglish mapped tokens so matching still works if translation is weak.
    mapped_tokens = []
    for source, target in HINDI_TOKEN_MAP.items():
        if source in text:
            mapped_tokens.append(target)

    # Concept-level matching catches common ASR/translation wording variants.
    for pattern, concept_tokens in CONCEPT_PATTERNS:
        if re.search(pattern, text):
            mapped_tokens.extend(concept_tokens)

    raw_tokens = re.findall(r"[a-z0-9]+", text)
    english_tokens = [
        _stem_token(token)
        for token in raw_tokens
        if token and token not in EN_STOPWORDS
    ]

    mapped_english_tokens = []
    for mapped in mapped_tokens:
        mapped_english_tokens.extend(
            _stem_token(token)
            for token in re.findall(r"[a-z0-9]+", mapped.lower())
            if token and token not in EN_STOPWORDS
        )

    return english_tokens + mapped_english_tokens


def _token_set(text):
    return set(_tokenize(text))


def _overlap_score(phrase, query_tokens):
    phrase_tokens = _token_set(phrase)
    if not phrase_tokens:
        return 0

    overlap = len(phrase_tokens.intersection(query_tokens))
    if overlap == 0:
        return 0

    if overlap == len(phrase_tokens):
        return 4

    return overlap


def search_faq_json(query):
    query_text = (query or "").lower().strip()
    if not query_text:
        return None

    query_tokens = _token_set(query_text)
    faqs = load_faqs()

    best_match = None
    best_score = 0
    best_full_symptom_matches = 0

    for faq in faqs:
        score = 0
        full_symptom_matches = 0
        keyword = (faq.get("keyword") or "").lower()

        # Strong signal: full keyword phrase present.
        if keyword and keyword in query_text:
            score += 6

        # Medium signal: keyword token overlap.
        keyword_tokens = _token_set(keyword)
        if keyword_tokens:
            kw_overlap = len(keyword_tokens.intersection(query_tokens))
            if kw_overlap == len(keyword_tokens):
                score += 4
            else:
                score += kw_overlap * 2

        # Symptom signal: full symptom token coverage is strong.
        for symptom in faq.get("symptoms", []):
            symptom_score = _overlap_score(symptom, query_tokens)
            score += symptom_score
            if symptom_score == 4:
                full_symptom_matches += 1

        # Prefer FAQs that explain multiple full symptoms together.
        # This prevents single-keyword conditions from beating better multi-symptom matches.
        if full_symptom_matches >= 2:
            score += full_symptom_matches * 3

        if (
            full_symptom_matches > best_full_symptom_matches
            or (
                full_symptom_matches == best_full_symptom_matches
                and score > best_score
            )
        ):
            best_full_symptom_matches = full_symptom_matches
            best_score = score
            best_match = faq

    # 3+ means at least meaningful overlap (for translated/variant wording).
    if best_score >= 3:
        return best_match

    return None
