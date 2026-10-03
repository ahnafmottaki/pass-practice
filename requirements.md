# Password Practice Web App - Requirements & Implementation Plan

## Overview
A minimalist, distraction-free local web application designed to help users train and build muscle memory / mental recall for their passwords. 
No authentication required. All data is saved locally using SQLite.

---

## 1. Functional Requirements

### 1.1 Password Management (Strictly Anonymous / Minimal)
- [x] Users can add, view, edit, and delete passwords.
- [x] **No service/account tagging**: Store only the password string itself and an optional note/mnemonic (no "Google", "Facebook", "Work email", etc.).
- [x] Mask/unmask toggle for sensitive viewing.
- [x] Copy to clipboard and character length / complexity inspector.

### 1.2 Duplicate Prevention
- [x] Enforce strict uniqueness on saved passwords.
- [x] SQLite schema `UNIQUE` constraint on password value.
- [x] Frontend real-time duplicate check with immediate visual warning.
- [x] Graceful error message if duplicate submission is attempted.

### 1.3 Notes on Each Password
- [x] Users can attach an optional note / memory hook / hint to each password.
- [x] Notes can be created during password addition or edited anytime.
- [x] Optional "Hint / Peek Note" feature during practice sessions if user gets stuck.

### 1.4 Practice Modes & Variations
- [x] **Practice Mode A: Time-based + All Passwords**
  - Iterates through all saved passwords.
  - Strict 30-second countdown timer per password.
  - Real-time countdown visualizer, progress bar, audio/visual urgency indicators.
- [x] **Practice Mode B: Time-based + Selected Passwords**
  - Allows user to multi-select specific passwords they want to train.
  - 30-second countdown timer per selected password.
- [x] **Practice Mode C: Count-based (Selected or All Passwords)**
  - User chooses repetitions per password (e.g., 3x, 5x, 10x, or custom).
  - Works with either "All Passwords" or "Selected Passwords".
  - Tracks repetition completion (e.g. "Rep 2 of 5").
- [x] **Typing & Recall Experience**:
  - Masked mode (type blindly / recall from memory) vs Revealed mode (speed typing / muscle memory).
  - Real-time keystroke feedback (character match, error highlighting, backspace handling).
  - Keyboard shortcuts (`Enter` to submit, `Esc` to skip/cancel, `Tab` to peek hint).

### 1.5 Results & Feedback System
- [x] Comprehensive result summary displayed after each practice session (and per password).
- [x] Metrics calculated and visualized:
  - Success / Fail status (e.g. matched within 30s vs timed out).
  - Time elapsed (seconds, milliseconds).
  - Typing speed: Characters Per Minute (CPM) and Words Per Minute (WPM).
  - Accuracy percentage (% keystrokes correct without error).
  - Error analysis: character-level diff highlighting where typos occurred.
- [x] Practice history stored in SQLite (timestamp, mode, accuracy, time taken, success).
- [x] Stats dashboard (total practices, average accuracy, personal best speeds).

### 1.6 Local Persistence with SQLite
- [x] SQLite database file stored locally.
- [x] Node.js Express backend using native `node:sqlite` DatabaseSync to manage database tables:
  - `passwords` (id, password, note, created_at, updated_at)
  - `practice_sessions` (id, mode_type, started_at, completed_at, total_passwords, success_count)
  - `practice_logs` (id, session_id, password_id, duration_ms, timed_out, accuracy, attempts, created_at)
- [x] Zero cloud dependencies, zero external login.

---

## 2. Technology Stack & Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React (icons), Canvas Confetti (celebration).
- **Backend / Database**: Node.js + Express, native `node:sqlite` (built into Node 22) for zero-dependency native SQLite file persistence (`passwords.db`).
- **Tooling**: Concurrently / NPM scripts for unified single-command development (`npm run dev`) and production build (`npm run build` / `npm start`).

---

## 3. Implementation Steps Checklist

- [x] **Step 1**: Document requirements and technical plan in `requirements.md`.
- [x] **Step 2**: Initialize project structure (Vite + React + Tailwind CSS + Node Express + SQLite backend).
- [x] **Step 3**: Implement SQLite database schema, migrations, and CRUD API endpoints (`/api/passwords`, `/api/practice`).
- [x] **Step 4**: Implement Password Management UI (Add, List, Edit, Delete, Uniqueness validation, Note editing).
- [x] **Step 5**: Implement Practice Configuration UI (Select Mode: Time-based All, Time-based Selected, Count-based All/Selected, repetitions, visibility toggle).
- [x] **Step 6**: Implement Practice Engine (Interactive typing interface, 30s countdown timer, character-by-character feedback, count tracker, audio/visual states).
- [x] **Step 7**: Implement Post-Practice Results & Feedback Screen (Accuracy, CPM/WPM, error diff, retry button, history overview).
- [x] **Step 8**: Implement Practice History & Statistics tab (historical performance, streaks, mastery level).
- [x] **Step 9**: Testing, validation, responsive polish, and documentation.
- [x] **Step 10**: Mobile layout refinement (flow-based celebration banner) & Starting Clue (first 2-3 letters) indicator for multiple password drills.

---

---

## 4. Security Architecture & Roadmap

### Zero-Knowledge Master Password + Client-Side AES-256-GCM Encryption
- **Decision Confirmed**: Zero-Knowledge client-side encryption with a 6-digit PIN and user authentication.

---

## 5. Phase 2: User Authentication & Zero-Knowledge PIN Implementation Tasks

- [x] **Task 1: User Authentication & Registration**
  - [x] Registration with Name, Email, Password, Confirm Password.
  - [x] Password validation and secure hashing with salt (`scrypt`) in SQLite `users` table.
  - [x] Login authentication with email and password verification.
  - [x] Auth sessions/tokens management and persistent user state in React frontend.
  - [x] User logout and session protection for APIs and vault.
  - [x] Associate passwords, practice sessions, and logs with `user_id`.

- [x] **Task 2: 6-Digit Encryption PIN Setup & Unlock Prompt**
  - [x] After successful login, detect if user has configured an encryption PIN.
  - [x] Prompt new users to set up a 6-digit encryption PIN with confirmation.
  - [x] Whenever user logs in, prompt them to enter their 6-digit PIN before they can access their passwords.

- [x] **Task 3: Zero-Knowledge Encryption, Decryption & Security Lockout**
  - [x] Hash 6-digit PIN and use it as the AES-256 encryption key.
  - [x] Client-side encryption of passwords before sending/storing in SQLite.
  - [x] Client-side decryption of passwords upon retrieval with the unlocked PIN.
  - [x] PIN verification against stored PIN hash.
  - [x] Lockout rule: track failed PIN attempts; if user enters wrong PIN twice, automatically log out of the account.

---

## 6. Phase 3: Production Security Hardening

- [x] **Task 1: Key Derivation Strengthening (PBKDF2-HMAC-SHA256)**
  - [x] Upgraded client key derivation in Web Crypto API to PBKDF2 with 600,000 iterations and user salt.
  - [x] Upgraded duplicate prevention blind indexing to PBKDF2 with 100,000 iterations.
- [x] **Task 2: Rate Limiting on Authentication & PIN Endpoints**
  - [x] Configured `express-rate-limit` on `/api/auth/register` and `/api/auth/login` (max 20 attempts per 15 min per IP).
  - [x] Configured rate limiting on `/api/auth/pin/*` (max 15 attempts per 15 min per IP).
- [x] **Task 3: Security Headers & CORS Lockdown**
  - [x] Integrated `helmet` with custom Content Security Policy (CSP).
  - [x] Restricted CORS to domain origin and verified local hosts with `credentials: true`.
- [x] **Task 4: HttpOnly Cookies with SameSite=Strict**
  - [x] Session tokens delivered via `Set-Cookie` with `HttpOnly`, `SameSite=Strict`, and environment-adaptive `secure` flag.
  - [x] Seamless dual-fallback for cookie and `Authorization: Bearer` headers.
  - [x] Client `api.js` configured with `credentials: 'include'` for all requests.

