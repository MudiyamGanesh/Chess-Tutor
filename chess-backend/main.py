from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chess
import chess.pgn
import chess.engine
import io
import os
import asyncio
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# Initialize Groq Client
try:
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
except Exception as e:
    groq_client = None
    print("Warning: Groq client failed to initialize:", e)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    pgn: str
    player_color: str  # Will receive 'w' or 'b'

STOCKFISH_PATH = "./stockfish/stockfish-windows-x86-64-avx2.exe"

@app.get("/")
def read_root():
    return {"message": "Chess Tutoring System Backend is running with Groq!"}

@app.post("/analyze")
async def analyze_game(req: AnalyzeRequest):
    pgn = req.pgn
    if not pgn:
        raise HTTPException(status_code=400, detail="Empty PGN provided")

    try:
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, 
            detail=f"Stockfish binary not found at '{STOCKFISH_PATH}'. Please check the path."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        engine.quit()
        raise HTTPException(status_code=400, detail="Invalid PGN string")

    board = game.board()
    user_blunders = []
    
    # We will categorize positive moves into these three lists
    best_candidates = []
    better_candidates = []
    good_candidates = []
    
    prev_infos = engine.analyse(board, chess.engine.Limit(time=0.1), multipv=3)
    prev_score = prev_infos[0]["score"].white()
    
    node = game
    move_number = 1
    
    while node.variations:
        next_node = node.variation(0)
        move = next_node.move
        san_move = board.san(move)
        is_white_turn = board.turn == chess.WHITE
        
        fen_before = board.fen()
        board.push(move)
        
        infos = engine.analyse(board, chess.engine.Limit(time=0.1), multipv=3)
        current_score = infos[0]["score"].white()
        
        if prev_score is not None and current_score is not None:
            p_val = prev_score.score(mate_score=10000)
            c_val = current_score.score(mate_score=10000)
            
            best_moves_uci = []
            for inf in prev_infos:
                if "pv" in inf and inf["pv"]:
                    best_moves_uci.append(inf["pv"][0].uci())
            
            # Determine the rank of the move played (0 = Best, 1 = Better, 2 = Good)
            move_rank = -1
            if move.uci() in best_moves_uci:
                move_rank = best_moves_uci.index(move.uci())
            
            is_user_turn = (is_white_turn and req.player_color == 'w') or (not is_white_turn and req.player_color == 'b')
            
            if is_white_turn:
                drop = p_val - c_val
                gain = c_val - p_val
            else:
                drop = c_val - p_val
                gain = p_val - c_val
                
            if is_user_turn:
                # 1. BLUNDER LOGIC (Evaluation dropped by 50+ points)
                if drop > 50:
                    user_blunders.append({
                        "move_number": move_number if is_white_turn else move_number - 1,
                        "color": "White" if is_white_turn else "Black",
                        "move": san_move,
                        "played_move_uci": move.uci(),
                        "best_moves_uci": best_moves_uci,
                        "before_eval": p_val / 100.0,
                        "after_eval": c_val / 100.0,
                        "drop": drop / 100.0,
                        "fen": fen_before
                    })
                
                # 2. STRATEGY LOGIC (Best, Better, Good)
                # Only capture if it didn't lose evaluation (drop < 20 centipawns)
                elif move_rank != -1 and drop < 20:
                    # Safely extract the 4-move strategy line for THIS specific move's rank
                    strategy_line = []
                    if move_rank < len(prev_infos) and "pv" in prev_infos[move_rank]:
                        strategy_line = [m.uci() for m in prev_infos[move_rank]["pv"][:4]]

                    category = "Best" if move_rank == 0 else "Better" if move_rank == 1 else "Good"

                    candidate = {
                        "move_number": move_number if is_white_turn else move_number - 1,
                        "color": "White" if is_white_turn else "Black",
                        "move": san_move,
                        "played_move_uci": move.uci(),
                        "strategy_line_uci": strategy_line,
                        "before_eval": p_val / 100.0,
                        "after_eval": c_val / 100.0,
                        "gain": gain / 100.0,
                        "fen": fen_before,
                        "category": category  # Store the category to feed to Groq!
                    }

                    if move_rank == 0:
                        best_candidates.append(candidate)
                    elif move_rank == 1:
                        better_candidates.append(candidate)
                    elif move_rank == 2:
                        good_candidates.append(candidate)
        
        prev_score = current_score
        prev_infos = infos
        node = next_node
        if not is_white_turn:
            move_number += 1
            
    engine.quit()

    # --- CASCADING WATERFALL SELECTION ---
    # Sort all candidates so the moves with the highest evaluation gains are at the top
    best_candidates.sort(key=lambda x: x['gain'], reverse=True)
    better_candidates.sort(key=lambda x: x['gain'], reverse=True)
    good_candidates.sort(key=lambda x: x['gain'], reverse=True)

    # Pick up to 3 strategy moves, falling back to lower tiers if the higher ones are empty
    user_strategy_moves = []
    if len(best_candidates) > 0:
        user_strategy_moves = best_candidates[:3]
    elif len(better_candidates) > 0:
        user_strategy_moves = better_candidates[:3]
    elif len(good_candidates) > 0:
        user_strategy_moves = good_candidates[:3]

    # --- GROQ AI INTEGRATION FOR BLUNDERS ---
    if groq_client and user_blunders:
        for b in user_blunders:
            prompt = (
                f"I am playing chess. I made a blunder. The board FEN is {b['fen']}. "
                f"I played the move {b['move']}, which dropped my evaluation by {b['drop']} pawns. "
                "Briefly explain why this move is a mistake, and how to overcome or avoid this mistake. "
                "Format your response EXACTLY as two plain text lines separated by a newline: \n"
                "Line 1: (Explanation of why it's a mistake)\n"
                "Line 2: (How to overcome it)"
            )
            try:
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are a concise, expert chess coach."},
                        {"role": "user", "content": prompt}
                    ],
                    model="llama3-8b-8192",
                    temperature=0.5,
                    max_tokens=150,
                )
                text = chat_completion.choices[0].message.content.strip()
                lines = [line.strip() for line in text.split('\n') if line.strip()]
                b["explanation"] = lines[0] if len(lines) > 0 else text.replace('\n', ' ')
                b["solution"] = lines[1] if len(lines) > 1 else "Focus on board vision and controlling the center."
                await asyncio.sleep(1) 
            except Exception as e:
                b["explanation"] = f"Stockfish identified this as a massive blunder (Lost {b['drop']} points)."
                b["solution"] = "Review the green arrows on the board for the engine's recommended better moves."
                print("Groq API Error on Blunder:", e)

    # --- GROQ AI INTEGRATION FOR STRATEGY MOVES ---
    if groq_client and user_strategy_moves:
        for b in user_strategy_moves:
            prompt = (
                f"I am playing chess. I made a '{b['category']}' tier move. The board FEN is {b['fen']}. "
                f"I played the move {b['move']}. "
                f"Briefly explain why this is a {b['category']} move and the strategy behind it. "
                "Format your response as a single, short, exciting sentence."
            )
            try:
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": "You are an enthusiastic, expert chess coach."},
                        {"role": "user", "content": prompt}
                    ],
                    model="llama3-8b-8192",
                    temperature=0.7,
                    max_tokens=100,
                )
                b["explanation"] = chat_completion.choices[0].message.content.strip()
                await asyncio.sleep(1) 
            except Exception as e:
                b["explanation"] = f"A solid {b['category']} move advancing your board position!"
                print("Groq API Error on Strategy Move:", e)

    # Fallback if Groq is disconnected
    if not groq_client:
        for b in user_blunders:
            b["explanation"] = "AI Configuration error: Groq client not initialized."
            b["solution"] = "Check the green arrows for alternative moves."
        for b in user_strategy_moves:
            b["explanation"] = "AI Configuration error: Groq client not initialized."

    return {
        "total_moves_played": move_number - 1,
        "blunders_found": len(user_blunders),
        "brilliant_found": len(user_strategy_moves),
        "blunders": user_blunders,
        "brilliant_moves": user_strategy_moves
    }