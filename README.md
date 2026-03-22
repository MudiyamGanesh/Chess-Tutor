# ♟️ Chess Tutor

> Train like a serious player. Play, analyze, and improve with AI that actually explains *why*.

Chess Tutor is an AI-powered chess arena built for improvement—not just gameplay. You can play against a fast in-browser engine and receive deep, human-like feedback after every game. Instead of raw numbers, you get clear explanations of your mistakes, ideas behind strong moves, and guidance on how to think better.

---

## 🧠 What Makes It Different?

Most chess apps tell you *what* went wrong.

**Chess Tutor tells you why.**

It combines:

* ⚙️ Engine-level precision (Stockfish)
* 🧩 Pattern understanding (LLMs)
* 🎯 Simple human explanations

So you don’t just play more—you **improve faster**.

---

## ✨ Core Features

### ♟️ Play Against AI

* Lightweight Minimax engine with Alpha-Beta pruning
* Runs entirely in the browser → instant moves, no lag
* Adjustable difficulty (extendable)

### 🔍 Post-Game Analysis

* Full game evaluation using Stockfish
* Move-by-move centipawn scoring
* Detects inaccuracies, mistakes, and blunders

### 🚨 Blunder Tutor

* Identifies *critical mistakes*
* Explains:

  * What went wrong
  * What you missed
  * What you should look for next time

### 🌟 Strategy Masterclass

* Highlights your **best moves**
* Explains positional ideas like:

  * Piece activity
  * King safety
  * Pawn structure

### 📈 Progress Tracking

* Elo rating system
* Peak rating tracking
* Win / Loss / Draw statistics
* Firebase-backed persistence

### 🎨 Minimal UI

* Clean, distraction-free design
* Dark / Light mode
* Built for focus, not noise

---

## 🏗️ Architecture Overview

```
Frontend (React)
   ↓
Game Logic (Chess.js + Minimax)
   ↓
PGN Export
   ↓
Backend (FastAPI)
   ↓
Stockfish Evaluation
   ↓
LLM Explanation (Groq / LLaMA3)
   ↓
Human-readable Insights
```

---

## 🛠️ Tech Stack

### Frontend

* React.js (Vite)
* Tailwind CSS
* Chess.js
* Firebase (Auth + Firestore)

### Backend

* FastAPI (Python)
* Stockfish (local engine)
* python-chess
* Groq API (LLaMA3)

---

## 🚀 Getting Started

### 📌 Prerequisites

* Node.js & npm
* Python 3.8+
* Groq API Key → [https://console.groq.com/](https://console.groq.com/)
* Firebase Project

---

## ⚙️ Backend Setup

```bash
cd chess-backend
pip install -r requirements.txt
```

Create `.env` file:

```env
GROQ_API_KEY=your_api_key_here
```

Run server:

```bash
uvicorn main:app --reload
```

📍 Place Stockfish at:

```
./stockfish/stockfish-windows-x86-64-avx2.exe
```

---

## 💻 Frontend Setup

```bash
cd chess-frontend
npm install
npm run dev
```

Configure Firebase inside:

```
src/firebase.js
```

---

## 🔄 How It Works (Flow)

### 1. Play

Moves are calculated instantly in-browser using Minimax.

### 2. Submit Game

Game PGN is sent to backend after completion.

### 3. Evaluate

Stockfish analyzes every move with centipawn scores.

### 4. Explain

Important moments are sent to LLaMA3 via Groq.

### 5. Learn

You receive clear, actionable insights.

---

## 🧩 Example Insight

> "You moved your knight to the edge, reducing its influence. Instead, centralizing it would have increased control over key squares and improved your position."

---

## 🎯 Vision

To build a system where:

* Beginners learn faster
* Intermediate players break plateaus
* Every game becomes a lesson

Not just a chess app—
**a personal AI coach.**

---

## 🔮 Future Improvements

* Opening database integration
* Real-time move suggestions
* Multiplayer mode
* Puzzle training system
* Personalized learning paths

---

## 🤝 Contributing

Contributions are welcome. If you have ideas to improve analysis, UI, or learning experience—feel free to fork and build.

---

## 📜 License

MIT License

---

## ⚡ Final Thought

Play less randomly.

Learn deliberately.

Win consistently.
