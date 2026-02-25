# Patient Chatbot Mobile (React Native + Expo)

## Run

```bash
cd mobile
npm install
npm start
```

## API URL

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_BASE_URL`.
3. Set API base URL and run.

Examples:

- Android emulator: `http://10.0.2.2:8000/api/`
- Real Android device (same WiFi): `http://YOUR_PC_LAN_IP:8000/api/`

## Notes

- This app uses the existing Django API and JWT flow from the web app.
- Current screens/features: Login, Signup, Chat, Conversation list, Delete conversation, Edit/Resend message, Upload report (PDF/image), Profile update, Logout.
