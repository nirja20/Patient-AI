# Patient Chatbot - Implementation Guide

This file documents:
1. Where each logic is implemented (frontend/backend, exact file and part).
2. Current main-file content summary, including recent important updates.

## 1) Logic-Wise Mapping (What is implemented where)

### Quick Index (Exact file + part)

- Backend core request orchestration:
  - `health_ai/core/views.py`
    - `chat_view` (chat API pipeline)
    - `upload_report_view` (report upload + OCR + FAQ + translation response)
    - `_generate_chat_response` (language detect -> translate -> FAQ match -> translate back)
    - `_extract_text_from_file` (PDF/image text extraction entry)
    - `_ocr_image_text` + `_resolve_ocr_lang` + `_preferred_to_ocr_lang` (OCR language routing)
    - `_build_brief_file_summary` (brief summary block for uploaded file response)
- Backend language/AI/search helpers:
  - `health_ai/core/translation.py`
    - `detect_language`, `translate_to_en`, `translate_back`
  - `health_ai/core/json_search.py`
    - `search_faq_json` and token/concept matching utilities
  - `health_ai/core/groq_service.py`
    - `generate_response` (Groq model wrapper + medical assistant prompt)
- Backend routes/models:
  - `health_ai/core/urls.py` (all API routes)
  - `health_ai/core/models.py` (`User`, `Conversation`, `ChatHistory`, `UploadedReport`, `FAQ`)
- Frontend integration layer:
  - `frontend/src/api.js` (all HTTP calls, token handling, payload normalization)
  - `frontend/src/App.js` (auth gate, layout mode, profile/settings shell)
  - `frontend/src/components/ChatWindow.js` (send/edit/upload/history render)
  - `frontend/src/components/ChatInput.js` (text/voice/upload UI + preferred language controls)
  - `frontend/src/components/AuthPage.js` (login/signup + Google OAuth UI flow)
  - `frontend/src/components/Sidebar.js` (conversation list/new/delete UX)
  - `frontend/src/App.css` (all responsive/theme styles)

### A. Authentication Logic (Signup/Login/JWT session)

- Backend
  - `health_ai/core/views.py`
    - `signup_view`: creates user, returns JWT + user payload.
    - `login_view`: validates username/password, returns JWT + user payload.
    - `_build_auth_payload`: central payload structure (`access`, `refresh`, `user`).
  - `health_ai/core/urls.py`
    - Routes: `/api/auth/signup/`, `/api/auth/login/`.

- Frontend
  - `frontend/src/components/AuthPage.js`
    - Login/signup form UI, mode switch, submit handling.
  - `frontend/src/api.js`
    - `signup`, `login`, token storage helpers (`ACCESS_KEY`, `REFRESH_KEY`).
  - `frontend/src/App.js`
    - `bootstrapAuth` checks existing session via `getCurrentUser`.
    - Redirect logic: if not logged in -> auth screen, else -> chat app.

### B. Google OAuth Logic (real Google sign-in)

- Backend
  - `health_ai/core/views.py`
    - `google_login_view`: validates `id_token` using Google libs, creates/gets user, returns JWT.
  - `health_ai/health_ai/settings.py`
    - `GOOGLE_CLIENT_ID` from env.
  - `health_ai/core/urls.py`
    - Route: `/api/auth/google-login/`.

- Frontend
  - `frontend/src/components/AuthPage.js`
    - Loads Google Identity Services script.
    - Initializes Google sign-in with `REACT_APP_GOOGLE_CLIENT_ID`.
    - Sends `response.credential` (`id_token`) to backend.
  - `frontend/src/api.js`
    - `googleLogin(idToken)`.

### C. User Profile Logic (view + editable fields)

- Backend
  - `health_ai/core/models.py`
    - `User` fields: `dob`, `gender`, plus existing `username`, `email`.
  - `health_ai/core/views.py`
    - `current_user_view`:
      - `GET`: returns profile data.
      - `PUT`: updates username/email/dob/gender with validation.
  - `health_ai/core/migrations/0006_user_dob_gender.py`
    - DB migration for `dob` and `gender`.
  - `health_ai/core/urls.py`
    - Route: `/api/auth/me/`.

- Frontend
  - `frontend/src/App.js`
    - Profile dropdown (`Settings` for admin/admin-username, `Profile`, `Logout`).
    - Profile dropdown closes on outside click.
    - Profile modal form with username/email/dob/gender.
    - Save via `updateCurrentUser`.
    - Success toast after profile update.
  - `frontend/src/api.js`
    - `getCurrentUser`, `updateCurrentUser`.
  - `frontend/src/App.css`
    - `profile-*`, `profile-modal-*`, `profile-form-*` styling.
    - `settings-*`, `theme-card-*` styling.

### D. Header/Logo/Profile UI Logic

- `frontend/src/App.js`
  - Brand/logo block in header (`brand-logo`, `brand-title`, `brand-subtitle`).
  - Compact-layout hamburger trigger for sidebar drawer on smaller widths.
  - Profile trigger button with tooltip (`title={user.email || user.username}`).
  - Dropdown behavior (`isProfileOpen`) and modal toggles (`Profile`, `Settings`).
- `frontend/src/App.css`
  - Header gradient, brand typography/colors, profile dropdown styles.
  - Theme-specific brand color behavior (light vs default/dark).
  - Responsive header behavior for narrow screens.
  - Tooltip behavior is native browser `title`.
- `frontend/public/index.html`
  - Browser tab title set to `MediAssist AI`.
  - Favicon switched to `%PUBLIC_URL%/logo192.png`.
- `frontend/public/manifest.json`
  - App identity updated (`short_name`, `name`) for install/PWA metadata.

### E. Chat Core Logic (send message, conversation state, persistence)

- Backend
  - `health_ai/core/views.py`
    - `chat_view`: handles message, creates/uses conversation, stores `ChatHistory`, optional audio response.
    - `conversation_list`, `get_conversation_history`, `delete_conversation`.
    - `edit_chat_message`: replaces edited message and deletes later branch messages.
  - `health_ai/core/models.py`
    - `Conversation`, `ChatHistory`.
  - `health_ai/core/urls.py`
    - Routes: `/api/chat/`, `/api/conversations/`, `/api/conversation/<id>/`, edit/delete paths.

- Frontend
  - `frontend/src/components/ChatWindow.js`
    - Message list rendering, send, edit-resend, uploaded report display, audio playback.
    - Empty-chat helper shown when messages are zero (initial + new chat).
    - 4 suggestion cards (2x2 desktop) shown in empty state from most frequent similar questions.
    - Clicking a card sends that question directly as user input.
    - Cards/hello hide when user starts typing or speaking.
    - Similar-question clustering (Jaccard + stopword removal + light stemming) for dynamic top questions.
    - Loading skeleton while opening an existing conversation.
  - `frontend/src/components/Sidebar.js`
    - Conversation list + delete confirmation flow.
    - In compact mode, supports close-after-navigation callback (`onNavigate`).
  - `frontend/src/components/ChatInput.js`
    - Emits compose-start callback on typing/speaking/sending to hide empty-state suggestions immediately.
  - `frontend/src/api.js`
    - `sendMessage`, `getConversations`, `getConversation`, `editChatMessage`, `deleteConversation`.

### F. Responsive Layout Logic (Desktop + Compact)

- Frontend
  - `frontend/src/App.js`
    - Detects compact layout via window width (`< 900px`).
    - Toggles between desktop sidebar mode and compact drawer mode.
  - `frontend/src/App.css`
    - Flexible sizing for sidebar/chat/input areas.
    - Breakpoints for tablet/mobile (`1200px`, `700px`).
    - Suggestion cards and empty-state text adapt to narrower widths.
    - Input row wraps and reorders controls on very small widths.

### G. Hamburger Sidebar Drawer Logic

- Frontend
  - `frontend/src/App.js`
    - Shows hamburger icon in header only in compact layout.
    - Opens/closes sidebar drawer with overlay.
    - Closes drawer on:
      - overlay click,
      - resize back to desktop,
      - sidebar navigation action.
  - `frontend/src/components/Sidebar.js`
    - Calls optional `onNavigate` callback after:
      - selecting a conversation,
      - creating new chat,
      - confirming delete.
  - `frontend/src/App.css`
    - `sidebar-overlay` + `sidebar-drawer` fixed-position sliding styles.
    - Smooth open/close transitions and z-index layering.

### H. FAQ Matching Logic

- Backend
  - `health_ai/core/json_search.py`
    - Loads `faqs.json`.
    - Tokenization + stemming.
    - Hindi + Gujarati token map for weak translation fallback.
    - Multi-symptom scoring boost (`full_symptom_matches`) to prefer combined diagnosis (e.g., thyroid vs hair fall only).
  - `health_ai/core/faqs.json`
    - FAQ disease records (`keyword`, `symptoms`, `possible_causes`, `home_care`, `when_to_visit`).

### I. Multilingual Logic (Hindi/Gujarati/English + transliterated input)

- Backend
  - `health_ai/core/translation.py`
    - `detect_language`:
      - Script hint (Devanagari/Gujarati),
      - Romanized hint (Hinglish/roman Gujarati markers),
      - LLM fallback.
    - `translate_to_en`, `translate_back`.
    - Graceful fallback if Groq client fails import/init.
  - `health_ai/core/views.py`
    - `_normalize_preferred_language` maps frontend toggle values to normalized backend values (`en`, `hi`, `gu`, or empty for auto).
    - `_generate_chat_response` pipeline:
      - detect input language,
      - translate input to English for FAQ search,
      - fallback search on original text,
      - build response,
      - translate back to `preferred_language` if sent, else detected language.
    - Devanagari safety override (`_contains_devanagari`) to avoid mis-detection when Hindi text is typed directly.

### J. Voice Input/Output Logic

- Frontend (voice input)
  - `frontend/src/components/ChatInput.js`
    - Browser speech recognition.
    - Language selector: `Auto`, `English`, `Hindi`, `Gujarati`.
    - If toggle is `Auto`, recognition uses browser locale fallback (`en-US`/`hi-IN`/`gu-IN`).
    - Voice transcript is sent immediately as a message.

- Backend (voice output)
  - `health_ai/core/views.py`
    - `_text_to_speech_base64` with `gTTS`.
    - `_tts_lang` supports `en`, `hi`, `gu`, `fr`, `es`.
    - Audio returned in chat payload as `audio_base64` when `is_voice` is true.

### K. Report Upload Logic (PDF/Image OCR)

- Backend
  - `health_ai/core/views.py`
    - `upload_report_view`:
      - file validation,
      - PDF extraction (`pdfplumber`) / image OCR (`pytesseract`),
      - detect text language,
      - translate extracted text to English for FAQ match,
      - fallback search on original extracted text,
      - translate final answer to `preferred_language` if provided from toggle (otherwise detected language),
      - save `UploadedReport` and `ChatHistory`.
    - `_extract_text_from_file`:
      - extension/content-type validation and extraction strategy selection.
    - `_ocr_image_text`:
      - image preprocessing variants + OCR attempt loop + fallback config.
    - `_build_brief_file_summary`:
      - builds the "Brief Summary from file" section shown in upload response.
      - recent change: improved Gujarati-PNG OCR summary cleanup by preferring structured fields (`Disease`/`Symptoms`) and filtering OCR gibberish tokens before rendering.
  - `health_ai/core/models.py`
    - `UploadedReport`.

- Frontend
  - `frontend/src/components/ChatInput.js`
    - file picker + upload trigger.
    - sends selected language as `preferredLanguage` with upload.
  - `frontend/src/components/ChatWindow.js`
    - upload request + result message insertion.
  - `frontend/src/api.js`
    - `uploadReport(file, conversationId, preferredLanguage)`.

### L. API/Error Handling + Request Payload Normalization

- `frontend/src/api.js`
  - Central `request` wrapper:
    - auth header injection,
    - JSON/non-JSON response parsing,
    - clearer error for backend HTML error pages.
  - Language-toggle payload normalization:
    - `sendMessage` sends `preferred_language` except when toggle is `auto`.
    - `uploadReport` appends `preferred_language` form field except when `auto`.
- `health_ai/core/views.py`
  - `_normalize_preferred_language` normalizes client values (`en-US`, `hi-IN`, `gu-IN`, words) before response translation logic.


## 2) Main Files - Current Content/Responsibility Summary

### Recent Important Updates (Current)

- `health_ai/core/views.py`
  - `_build_brief_file_summary` was refined for Gujarati PNG uploads:
    - prefers structured extraction (`Disease`, `Symptoms`) when present,
    - removes frequent OCR noise patterns (short uppercase token garbage / artifact tokens),
    - falls back to safe readable text when the summary appears noisy.
  - This change is limited to the brief summary section; FAQ matching and final disease advice logic remain unchanged.
- Upload flow now consistently uses English-normalized extraction for FAQ matching in Gujarati/Hindi paths, then translates final response to requested language.
- Gujarati/Hindi specialized output formatting remains line-by-line for readability in localized script output.

## Backend Main Files

### `health_ai/core/views.py`

- Main API controller file.
- Auth endpoints: signup/login/google-login/me.
- Chat endpoints: send/edit/list/history/delete.
- Upload endpoint with OCR/PDF processing.
- TTS generation and language-aware response pipeline.
- Preferred-language override support for typed chat/voice chat and report uploads.
- Includes upload-response brief summary builder (`_build_brief_file_summary`) with OCR-noise hardening for Gujarati image inputs.

### `health_ai/core/translation.py`

- Language detection and translation helper layer.
- Handles native script + romanized language hints.
- Uses Groq when available; safe fallback if client cannot initialize.

### `health_ai/core/groq_service.py`

- Dedicated Groq chat completion helper (`generate_response`).
- Defines medical assistant system prompt and returns model response content.
- Separate helper from main FAQ retrieval flow in `views.py`.

### `health_ai/core/json_search.py`

- Core FAQ retrieval/scoring engine.
- Token overlap scoring + keyword boost + multi-symptom boost.
- Hindi/Gujarati mapping tokens for fallback matching.

### `health_ai/core/models.py`

- Data models:
  - `User` (role, language, dob, gender),
  - `Conversation`,
  - `ChatHistory`,
  - `UploadedReport`,
  - `FAQ`.

### `health_ai/core/urls.py`

- Routes for all auth/chat/upload endpoints.

### `health_ai/health_ai/settings.py`

- Django config (DB, DRF JWT, CORS, custom user model).
- Google OAuth server config: `GOOGLE_CLIENT_ID` env.

### `health_ai/core/faqs.json`

- FAQ dataset consumed by `json_search.py`.


## Frontend Main Files

### `frontend/src/App.js`

- Main app shell and auth gate.
- Chat screen render after login.
- Profile dropdown/modal state.
- Admin settings modal + theme selection persistence.
- Responsive compact layout detection.
- Hamburger-driven sidebar drawer state and behavior.
- Outside-click close for profile menu.
- Success toast feedback on profile save.
- User profile save flow.
- Logout flow.

### `frontend/src/App.css`

- Entire UI styling:
  - auth page,
  - top header and logo,
  - sidebar/chat area,
  - message bubbles,
  - input controls,
  - profile dropdown + editable modal,
  - settings modal + theme cards (`Default`, `Light`, `Dark`),
  - theme-specific overrides (including icon/button contrast and brand text colors),
  - chat input row centered with glass-style appearance,
  - responsive behavior for desktop/tablet/mobile,
  - compact-mode overlay and slide-in sidebar drawer styles.

### `frontend/src/api.js`

- All API calls and auth token handling.
- Shared request wrapper + robust error handling.
- Sends normalized `preferred_language` for chat and report upload.

### `frontend/src/components/AuthPage.js`

- Login/signup UI and real Google sign-in integration (GIS).

### `frontend/src/components/ChatWindow.js`

- Message rendering, sending, edit-branch behavior, audio playback, file upload result rendering.
- Empty-state welcome text for blank conversations.
- Dynamic suggestion cards generated from frequent similar history questions.
- Compose-start state that hides greeting/cards once user starts typing/speaking.

### `frontend/src/components/ChatInput.js`

- Text send, voice input, voice language selection, upload trigger.
- Sends selected language as preferred response language context.
- Triggers compose-start callback to hide empty-state cards before first send.

### `frontend/src/components/MessageBubble.js`

- Reusable chat bubble renderer for user and bot messages.
- Used by `ChatWindow.js` to display each chat turn consistently.

### `frontend/src/components/Sidebar.js`

- Conversations list and delete-confirm UX.
- Supports compact-mode close callback (`onNavigate`) so drawer auto-closes after actions.

### `frontend/public/index.html`

- Browser tab title and favicon configuration.
- Updated to show MediAssist branding in tab.

### `frontend/public/manifest.json`

- PWA app display identity (`name`, `short_name`, icons metadata).
- Updated to MediAssist app identity.


## Newly Important Files Added Recently

- `frontend/src/components/AuthPage.js`
  - New auth screen component with Google OAuth button integration.

- `health_ai/core/migrations/0006_user_dob_gender.py`
  - Adds `dob` and `gender` fields to `User`.

## Changed Recently (No New File, Important Logic Update)

- `health_ai/core/views.py`
  - Updated `_build_brief_file_summary` logic to improve Gujarati image-to-any-language brief summary quality and suppress OCR artifact text.


## Notes for Running Current Version

- Google OAuth env:
  - Backend env: `GOOGLE_CLIENT_ID`
  - Frontend env (`frontend/.env`): `REACT_APP_GOOGLE_CLIENT_ID`

- New profile fields require migration:
  - `python manage.py migrate`

- Backend run command:
  - `cd health_ai`
  - `python manage.py runserver`

- Frontend run command:
  - `cd frontend`
  - `npm install`
  - `npm start`


## 3) Detailed Logic: Dynamic Frequent Similar Question Cards

- Location:
  - `frontend/src/components/ChatWindow.js`
  - Related styles: `frontend/src/App.css`

- When cards are shown:
  - Only in empty chat state (`messages.length === 0`) and when user has not started composing in the current fresh/new chat.
  - Appears under "Hello, how can I help you today?" as 4 rectangular cards.
  - Desktop/tablet can show 2x2; smaller widths collapse to one-column cards.

- Data source:
  - Uses conversation history APIs:
    - `getConversations()` to fetch user conversations.
    - `getConversation(id)` for message lists.
  - Uses a bounded recent set (currently first 40 conversations) for efficiency.

- How “similar question” frequency is computed:
  1. Each candidate question is normalized (`lowercase`, trimmed spaces).
  2. Token set is built from `[a-z0-9]+` tokens.
  3. Stop words are removed (`i`, `have`, `and`, `the`, etc.).
  4. Light stemming is applied (removes common suffixes like `ing`, `ed`, `s`).
  5. Similarity between two questions is computed using Jaccard similarity:
     - `intersection(tokensA, tokensB) / union(tokensA, tokensB)`.
  6. Questions are clustered into groups if similarity >= `0.55`.
  7. Group frequency count is incremented for each matched question.
  8. Top 4 highest-frequency groups are chosen for cards.

- Representative text chosen for each group:
  - For display, the logic keeps a clearer/longer phrasing when similar variants merge.

- Why this solves future growth:
  - Exact-text matching alone fails when users phrase the same intent differently.
  - Similarity grouping merges variants like:
    - `i have fever and body pain`
    - `have high temperature and body pain`
  - So as history grows, cards adapt by intent frequency, not just identical strings.

- Card behavior:
  - Clicking a card sends that question via normal send flow.
  - On send/upload/edit, suggestions are recomputed from latest history.
  - On typing or voice start, cards hide immediately (same UX pattern as hello block).


## 4) Detailed Logic: Responsive Layout Strategy

- Goal:
  - Prevent horizontal clipping/hidden controls when viewport width or height is reduced.
  - Keep chat input, suggestions, and messages usable across desktop/tablet/mobile.

- Core responsive decisions:
  1. Use flexible widths (`clamp`, `%`, `minmax(0, 1fr)`) instead of fixed large widths.
  2. Add `min-width: 0` on flex children (`.app`, `.chat-window`, `.messages`, empty-state container) to allow shrinking.
  3. Breakpoints:
     - `<= 1200px`: suggestion grid collapses to single column, heading scales down.
     - `<= 700px`: tighter paddings, smaller heading, input row wraps, sidebar narrows.
  4. Input bar adaptation:
     - Input field uses flexible basis instead of fixed pixel width.
     - Controls can wrap/reorder so send/input remain visible on small widths.

- Result:
  - Reduced overflow risk.
  - Empty-state cards remain readable.
  - Bottom controls remain functional in constrained width.


## 5) Detailed Logic: Hamburger Sidebar Drawer (Compact Mode)

- Trigger condition:
  - Compact mode is enabled when viewport width is below `900px`.

- Behavior:
  1. Desktop (`>= 900px`):
     - Sidebar is always visible.
  2. Compact (`< 900px`):
     - Sidebar is hidden by default.
     - Header shows hamburger button.
     - Clicking hamburger opens sidebar drawer from left.
     - Semi-transparent overlay appears behind drawer.
     - Clicking overlay closes drawer.

- Auto-close behavior in compact mode:
  - Drawer closes after sidebar navigation actions:
    - selecting conversation,
    - creating new chat,
    - confirm delete.
  - Drawer also closes when resizing back to desktop width.

- UI layers:
  - Overlay and drawer are fixed-position elements with controlled z-index so chat remains behind and input area stays usable when drawer is closed.


## 6) Detailed Logic: Language Toggle End-to-End (Typed + Voice + Upload)

- Frontend source of truth:
  - `frontend/src/components/ChatInput.js`
    - Dropdown values: `auto`, `en-US`, `hi-IN`, `gu-IN`.
    - Selected value is passed as `preferredLanguage` to:
      - `onSend` for normal typed/voice chat,
      - `onUpload` for report upload.
  - `frontend/src/api.js`
    - `sendMessage(...)` sends `preferred_language` only when not `auto`.
    - `uploadReport(...)` appends `preferred_language` only when not `auto`.

- Backend normalization:
  - `health_ai/core/views.py`
    - `_normalize_preferred_language` converts:
      - `en-US` -> `en`
      - `hi-IN` -> `hi`
      - `gu-IN` -> `gu`
      - `auto`/empty -> `` (no forced override)

- Typed/voice message response language flow:
  1. Input comes to `chat_view` with optional `preferred_language`.
  2. `_generate_chat_response(message, preferred_language)`:
     - detects input language,
     - translates input to English for FAQ matching,
     - tries fallback search on original text,
     - builds English response text from FAQ,
     - final response language = `preferred_language` if provided, else detected input language.
  3. If `is_voice` is true, TTS is generated in that same final response language.

- Report upload response language flow:
  1. `upload_report_view` extracts report text (PDF/OCR).
  2. Detects report text language and translates to English for FAQ search.
  3. Builds English response from matched FAQ.
  4. Final response language = `preferred_language` if provided, else detected report language.
  5. Saves translated response in `ChatHistory` and returns it.

- Practical behavior:
  - Toggle = Hindi, user types English -> response in Hindi.
  - Toggle = Gujarati, user uploads English report -> response in Gujarati.
  - Toggle = Auto, user types Hindi/Gujarati script -> response should follow detected script language.
  - Toggle = Auto, user types English -> response in English.

- Important current note:
  - `edit_chat_message` currently regenerates response without preferred-language override (uses detection path).
  - If needed, same override can be added there later for perfect consistency with initial send.
