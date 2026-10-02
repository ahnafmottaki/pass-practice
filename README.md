# PassPractice 🔐⚡

A minimalist, distraction-free web application designed to help you build muscle memory and mental recall for your passwords.

- **Zero authentication**: No signup, no email, no cloud dependencies.
- **Strictly anonymous**: Stores only the password string itself and optional memory notes (no service/account tags like Google, Facebook).
- **Duplicate prevention**: Cannot save duplicate passwords (enforced in both SQLite and real-time frontend UI).
- **Local SQLite database**: Saved directly to a local `passwords.db` file on your machine.
- **Practice variations**:
  1. **Time-based + All passwords**: 30-second countdown timer per password.
  2. **Time-based + Selected passwords**: 30-second countdown timer for specific selected passwords.
  3. **Count-based**: Train repetitions (e.g. 3x, 5x, 10x, or custom) for all or selected passwords.
- **Notes & Hints**: Attach mnemonic notes/hints to any password and peek at them during drills.
- **In-depth results & feedback**: Detailed accuracy %, CPM/WPM typing speed, character-by-character diff (showing exact typos), and personalized feedback.
- **Telemetry & Stats**: SQLite logs your practice history, streaks, and personal best speeds.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run in Development Mode
Runs both the SQLite Express backend (port 3001) and Vite React frontend (port 5173):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build & Run
```bash
npm run build
npm start
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## Practice Variations

- **Time-Based (All Passwords)**: Iterates through each saved password with a strict 30.0s timer, audio ticks for the final 5 seconds, and immediate feedback.
- **Time-Based (Selected Passwords)**: Multi-select challenging passwords from your vault and test them under the 30-second countdown.
- **Count-Based**: Drill repetitions without timer stress. Set how many times you want to type each password consecutively (e.g., 3x, 5x, or custom) to build finger muscle memory.
- **Blind Recall vs Muscle Memory**:
  - *Blind Recall*: Password is masked (`••••••••`), testing pure cognitive recall. Press <kbd>Tab</kbd> to peek if stuck.
  - *Muscle Memory*: Password is visible on screen, training fast typing cadence and finger coordination.
