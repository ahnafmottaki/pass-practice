# PassPractice 🔐⚡

A minimalist, distraction-free web application designed to help you build muscle memory and mental recall for your passwords.

- **Zero-Knowledge Security**: Passwords and notes are encrypted on the client side with AES-256-GCM using your 6-digit PIN before saving to the database.
- **Strictly Anonymous**: Stores only the encrypted ciphertext and optional memory notes (no service/account tags like Google, Facebook).
- **Duplicate Prevention**: Blind indexing prevents saving duplicate passwords without exposing them.
- **Persistent Database**: Powered by **MongoDB Atlas** for persistence both locally and in serverless environments (Vercel).
- **Practice Variations**:
  1. **Time-based + All passwords**: 30-second countdown timer per password.
  2. **Time-based + Selected passwords**: 30-second countdown timer for specific selected passwords.
  3. **Count-based**: Train repetitions (e.g. 3x, 5x, 10x, or custom) for all or selected passwords.
- **Notes & Hints**: Attach mnemonic notes/hints to any password and peek at them during drills.
- **In-depth Results & Feedback**: Detailed accuracy %, CPM/WPM typing speed, character-by-character diff (showing exact typos), and personalized feedback.
- **Telemetry & Stats**: Database logs your practice history, streaks, and personal best speeds.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
DATABASE_URL=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/passpractice?retryWrites=true&w=majority
```

> **Note for Vercel Deployments**: Add the `DATABASE_URL` key with your connection string under **Project Settings > Environment Variables** on Vercel.

### 3. Run in Development Mode
Runs both the Express backend (port 3001) and Vite React frontend (port 5173):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Production Build & Run
```bash
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.
