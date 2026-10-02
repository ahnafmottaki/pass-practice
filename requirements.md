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
