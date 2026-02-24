# Patient Chatbot (MediAssist AI)

AI-powered multilingual healthcare assistant that lets users chat by text/voice and upload medical reports (PDF/images) to get brief summaries, matched FAQ guidance, home-care advice, and when-to-visit-doctor recommendations.

## Tech Stack

### Frontend
React (react, react-dom, react-scripts)
JavaScript (CRA structure)
Axios / Fetch for API integration
Tailwind/PostCSS support (configured)
Responsive UI with chat window, sidebar, auth, profile/settings

### Backend
Django 6 + Django REST Framework
JWT Authentication (djangorestframework-simplejwt)
Google OAuth login (Google Identity Services token verification)
OCR and report text extraction:
pytesseract for images
pdfplumber for PDFs
Multilingual pipeline (English, Hindi, Gujarati):
language detection
translation in/out
FAQ matching

### Database
PostgreSQL
DB name: healthdb
Used for users, chat history, conversations, uploaded reports, FAQ-related entities

## Run Locally

1. Backend
cd health_ai
python -m venv venv
venv\Scripts\activate    # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

2. Frontend
cd frontend
npm install
npm start

