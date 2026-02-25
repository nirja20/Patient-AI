# 🏥 Patient Chatbot (MediAssist AI)

AI-powered multilingual healthcare assistant that enables users to chat via text/voice and upload medical reports (PDF/images) to receive concise summaries, matched FAQ guidance, home-care advice, and doctor-visit recommendations.

---

## 🚀 Tech Stack

**Frontend:** React (CRA) + JavaScript + Tailwind CSS + Axios  
**Mobile:** React Native (Expo)  
**Backend:** Django 6 + Django REST Framework + JWT Auth + Google OAuth  
**OCR & Processing:** pytesseract (images) + pdfplumber (PDFs) + multilingual pipeline (EN/HI/GU)  
**Database:** PostgreSQL (healthdb)

---

## 🛠 Features

- Multilingual chat (English, Hindi, Gujarati)
- Medical report upload (PDF & images)
- OCR-based report text extraction
- AI-generated report summaries
- FAQ matching & guidance
- Home-care suggestions
- Doctor visit recommendations
- JWT Authentication
- Google OAuth Login
- Chat history storage
- Responsive UI with sidebar & profile settings

---

## ⚙️ Run Locally

### 1️⃣ Backend

```bash
cd health_ai
python -m venv venv
venv\Scripts\activate     # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

---

### 2️⃣ Frontend

```bash
cd frontend
npm install
npm start
```

---

### 3️⃣ Mobile (Android via Expo)

```bash
cd mobile
npm install
copy .env.example .env
npm start
```

Use API base URL in `mobile/.env`:
- Android emulator: `http://10.0.2.2:8000/api/`
- Physical Android device: `http://<YOUR_PC_LAN_IP>:8000/api/`

If using a physical device, set Django hosts first:

```bash
set DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,10.0.2.2,<YOUR_PC_LAN_IP>
```

---
