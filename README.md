# BharatTranslate

A production-ready AI Translation App supporting 30 Indian + 20 International languages, built with React Native CLI, Node.js, LibreTranslate, and OpenAI GPT-4o-mini.

---

## Prerequisites

- Node.js >= 18
- Java JDK 17
- Android Studio + Android SDK (API 33+)
- MongoDB (local or Atlas)
- Docker (for LibreTranslate)
- A physical Android device or emulator

---

## 1. Start LibreTranslate (Self-hosted, Free)

```bash
docker run -ti --rm -p 5001:5000 libretranslate/libretranslate
```

Wait until you see `Running on http://0.0.0.0:5000`. LibreTranslate will be available at `http://localhost:5001`.

To pre-load Indian language models (recommended):

```bash
docker run -ti --rm -p 5001:5000 \
  -e LT_LOAD_ONLY=en,hi,bn,ta,te,mr,gu,kn,ml,pa,ur,or,ne,si,ar,fr,de,es,zh,ja,ru,pt,it,ko,tr \
  libretranslate/libretranslate
```

---

## 2. Backend Setup

```bash
cd BharatTranslate/backend
npm install
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bharattranslate
OPENAI_API_KEY=sk-your-openai-api-key-here
LIBRETRANSLATE_URL=http://localhost:5001
LIBRETRANSLATE_API_KEY=
```

Start the backend:

```bash
npm run dev
# or for production:
npm start
```

Backend runs on `http://localhost:5000`. Verify: `curl http://localhost:5000/health`

---

## 3. Frontend Setup

```bash
cd BharatTranslate/frontend
npm install
```

### Physical Device IP Setup

If testing on a physical Android device (not emulator), update `src/api.js`:

```js
// Change this line:
const BASE_URL = 'http://10.0.2.2:5000';

// To your machine's local IP (find with: ipconfig on Windows / ifconfig on Mac/Linux):
const BASE_URL = 'http://192.168.1.XXX:5000';
```

Both your phone and computer must be on the same Wi-Fi network.

---

## 4. Android Native Setup

### Install native dependencies

```bash
cd frontend
npx react-native-asset  # links vector icons fonts
```

### Clean build

```bash
cd android
./gradlew clean
cd ..
```

### Run on device/emulator

```bash
# Start Metro bundler first (in a separate terminal):
npx react-native start

# Then run Android:
npx react-native run-android
```

---

## 5. Required AndroidManifest.xml Permissions

Add these to `frontend/android/app/src/main/AndroidManifest.xml` inside `<manifest>`:

```xml
<!-- Internet -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Microphone (Voice Input) -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Camera (OCR) -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

<!-- Storage (Camera photo temp files) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
```

Also add inside `<application>`:

```xml
<uses-library android:name="org.apache.http.legacy" android:required="false" />
```

---

## 6. react-native-vision-camera Setup

In `frontend/android/app/build.gradle`, add inside `android {}`:

```gradle
defaultConfig {
    ...
    missingDimensionStrategy 'react-native-camera', 'general'
}
```

In `frontend/android/gradle.properties`:

```properties
VisionCamera_enableCodeScanner=false
```

---

## 7. react-native-voice Setup

In `frontend/android/app/src/main/AndroidManifest.xml` inside `<application>`:

```xml
<queries>
  <intent>
    <action android:name="android.speech.RecognitionService" />
  </intent>
</queries>
```

---

## 8. Vector Icons Setup

In `frontend/android/app/build.gradle`, add to `apply from`:

```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

---

## Project Structure

```
BharatTranslate/
├── backend/
│   ├── middleware/errorHandler.js
│   ├── models/History.js
│   ├── routes/translate.js
│   ├── routes/emotion.js
│   ├── routes/history.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EmotionSelector.js
│   │   │   ├── LanguagePicker.js
│   │   │   └── TTSButton.js
│   │   ├── screens/
│   │   │   ├── CameraScreen.js
│   │   │   ├── HistoryScreen.js
│   │   │   └── HomeScreen.js
│   │   ├── api.js
│   │   ├── languages.js
│   │   ├── theme.js
│   │   └── ThemeContext.js
│   ├── App.js
│   └── package.json
└── README.md
```
---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/translate` | Translate text |
| POST | `/api/translate/detect` | Detect language |
| POST | `/api/emotion/rephrase` | Rephrase with emotion |
| GET | `/api/history?page=1&limit=20` | Get paginated history |
| DELETE | `/api/history/:id` | Delete one item |
| DELETE | `/api/history` | Clear all history |
| GET | `/health` | Health check |

---

## Features

- Real-time debounced translation (900ms)
- Voice input with speech-to-text
- Camera OCR with ML Kit text recognition
- Text-to-Speech with BCP-47 locale support
- Emotion rephrasing (Love / Sad / Angry / Happy) via GPT-4o-mini
- Paginated translation history with MongoDB
- Dark/Light mode (system-aware + manual toggle)
- Copy and Share output
- Auto language detection
- 30 Indian + 20 International languages

---

## Troubleshooting

**Metro bundler port conflict:**
```bash
npx react-native start --port 8082
```

**Gradle build fails:**
```bash
cd android && ./gradlew clean && cd .. && npx react-native run-android
```

**LibreTranslate connection refused:**
Make sure Docker container is running: `docker ps`

**Voice not working on emulator:**
Voice recognition requires a real device with Google app installed.

**Camera black screen on emulator:**
Use a physical device for camera features.
