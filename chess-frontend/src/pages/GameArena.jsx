import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { ArrowLeft, RotateCcw, BrainCircuit, Flag, ChevronLeft, ChevronRight, Clock, Clock4, Settings, PartyPopper, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
const SURVIVAL_LIMIT = 20;

// --- AI EVALUATION CONSTANTS ---
const PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

const pawnEvalWhite = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

const pawnEvalBlack = [...pawnEvalWhite].reverse();

const centerBonus = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 10, 20, 20, 10, 0, -10],
  [-10, 0, 10, 20, 20, 10, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20]
];

// --- HELPER FUNCTIONS ---
const evaluateBoard = (chessObj) => {
  let totalEval = 0;
  const board = chessObj.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        let val = PIECE_VALUES[piece.type] || 0;
        let positionalVal = 0;
        if (piece.type === 'n' || piece.type === 'b') positionalVal = centerBonus[r][c];
        else if (piece.type === 'p') positionalVal = piece.color === 'w' ? pawnEvalWhite[r][c] : pawnEvalBlack[r][c];
        
        const score = val + positionalVal;
        totalEval += piece.color === 'w' ? score : -score;
      }
    }
  }
  return totalEval;
};

const minimax = (chessObj, depth, alpha, beta, isMaximizingPlayer) => {
  if (depth === 0 || chessObj.isGameOver()) return evaluateBoard(chessObj);
  const moves = chessObj.moves();

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      chessObj.move(moves[i]);
      const ev = minimax(chessObj, depth - 1, alpha, beta, false);
      chessObj.undo();
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < moves.length; i++) {
      chessObj.move(moves[i]);
      const ev = minimax(chessObj, depth - 1, alpha, beta, true);
      chessObj.undo();
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
    }
    return minEval;
  }
};

const formatTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const getCapturedPieces = (game) => {
  const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  const board = game.board();
  
  board.forEach(row => {
    row.forEach(piece => {
      if (piece && piece.type !== 'k') currentCounts[piece.color][piece.type]++;
    });
  });

  const capturedByWhite = []; 
  const capturedByBlack = []; 

  Object.keys(initialCounts).forEach(type => {
    const missingBlack = initialCounts[type] - currentCounts.b[type];
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push({ type, color: 'b' });
    
    const missingWhite = initialCounts[type] - currentCounts.w[type];
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push({ type, color: 'w' });
  });

  const sortOrder = { q: 5, r: 4, b: 3, n: 2, p: 1 };
  capturedByWhite.sort((a, b) => sortOrder[b.type] - sortOrder[a.type]);
  capturedByBlack.sort((a, b) => sortOrder[b.type] - sortOrder[a.type]);

  return { w: capturedByWhite, b: capturedByBlack };
};

// --- CUSTOM COMPONENTS ---
const CustomChessboard = ({ game, playerColor, onSquareClick, sourceSquare, validMoves, arrows = [], pendingPromotion, onPromote }) => {
  const renderRanks = playerColor === 'b' ? [...RANKS].reverse() : RANKS;
  const renderFiles = playerColor === 'b' ? [...FILES].reverse() : FILES;

  const getSquareCenter = (sq) => {
    let fileIdx = sq.charCodeAt(0) - 97;
    let rankIdx = 8 - parseInt(sq[1], 10);
    if (playerColor === 'b') {
      fileIdx = 7 - fileIdx;
      rankIdx = 7 - rankIdx;
    }
    return { x: (fileIdx + 0.5) * 12.5, y: (rankIdx + 0.5) * 12.5 };
  };

  const getPieceSymbol = (piece) => {
    if (!piece) return null;
    const { type, color } = piece;
    const isWhite = color === 'w';
    const symbols = { p: isWhite ? '♙\uFE0E' : '♟\uFE0E', n: isWhite ? '♘\uFE0E' : '♞\uFE0E', b: isWhite ? '♗\uFE0E' : '♝\uFE0E', r: isWhite ? '♖\uFE0E' : '♜\uFE0E', q: isWhite ? '♕\uFE0E' : '♛\uFE0E', k: isWhite ? '♔\uFE0E' : '♚\uFE0E' };
    return symbols[type];
  };

  const getSquareClass = (rank, file) => {
    const fileIndex = FILES.indexOf(file);
    const rankIndex = 8 - parseInt(rank, 10);
    const isDark = (fileIndex + rankIndex) % 2 !== 0;
    return isDark ? 'bg-slate-400 dark:bg-slate-700' : 'bg-slate-200 dark:bg-slate-500';
  };

  return (
    <div className="grid grid-cols-8 grid-rows-8 w-full aspect-square mx-auto border-4 border-slate-400 dark:border-slate-700 shadow-2xl touch-none select-none overflow-hidden rounded-md relative">
      <svg className="absolute inset-0 z-30 pointer-events-none w-full h-full drop-shadow-lg">
        <defs>
          <marker id="arrowhead-red" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><polygon points="0 0, 4 2, 0 4" fill="rgba(239, 68, 68, 0.9)" /></marker>
          <marker id="arrowhead-green" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><polygon points="0 0, 4 2, 0 4" fill="rgba(34, 197, 94, 0.9)" /></marker>
          <marker id="arrowhead-emerald" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><polygon points="0 0, 4 2, 0 4" fill="rgba(16, 185, 129, 0.8)" /></marker>
          <marker id="arrowhead-teal" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><polygon points="0 0, 4 2, 0 4" fill="rgba(20, 184, 166, 0.7)" /></marker>
        </defs>
        {arrows.map((arrow, i) => {
          if (!arrow.from || !arrow.to) return null;
          const start = getSquareCenter(arrow.from);
          const end = getSquareCenter(arrow.to);
          const strokeColors = { 'red': 'rgba(239, 68, 68, 0.8)', 'green': 'rgba(34, 197, 94, 0.8)', 'emerald': 'rgba(16, 185, 129, 0.8)', 'teal': 'rgba(20, 184, 166, 0.7)' };
          const strokeColor = strokeColors[arrow.color] || 'rgba(34, 197, 94, 0.8)';
          return (
            <line key={i} x1={`${start.x}%`} y1={`${start.y}%`} x2={`${end.x}%`} y2={`${end.y}%`} stroke={strokeColor} strokeWidth="2%" strokeLinecap="round" markerEnd={`url(#arrowhead-${arrow.color})`} />
          );
        })}
      </svg>
      
      {/* PROMOTION MODAL */}
      {pendingPromotion && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl flex space-x-4 border-2 border-blue-500 dark:border-blue-400">
            {['q', 'r', 'b', 'n'].map(pieceType => (
              <button 
                key={pieceType} 
                onClick={() => onPromote(pieceType)}
                className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-xl flex items-center justify-center text-4xl sm:text-5xl transition transform hover:scale-110"
                style={{
                  color: playerColor === 'w' ? '#ffffff' : '#000000',
                  textShadow: playerColor === 'w'
                    ? '0 2px 4px rgba(0,0,0,0.8), 0 0 6px #000, 0 0 2px #000'
                    : '0 2px 4px rgba(255,255,255,0.8), 0 0 6px #fff, 0 0 2px #fff',
                }}
              >
                {getPieceSymbol({ type: pieceType, color: playerColor })}
              </button>
            ))}
          </div>
        </div>
      )}

      {renderRanks.map((rank) =>
        renderFiles.map((file) => {
          const square = `${file}${rank}`;
          const isSelected = sourceSquare === square;
          const isValidMove = validMoves.some(m => m.to === square);
          const pieceObj = game.get(square);
          const pieceText = getPieceSymbol(pieceObj);

          return (
            <div
              key={square}
              className={`w-full h-full flex items-center justify-center relative cursor-pointer ${getSquareClass(rank, file)}`}
              onClick={() => onSquareClick(square)}
            >
              {isSelected && <div className="absolute inset-0 z-10 pointer-events-none transition-all duration-200" style={{ boxShadow: 'inset 0 0 15px rgba(0, 210, 255, 0.8), inset 0 0 0 2px rgba(0, 210, 255, 1)', backgroundColor: 'rgba(0, 210, 255, 0.15)' }} />}
              {isValidMove && !pieceObj && <div className="absolute z-10 pointer-events-none rounded-full" style={{ width: '30%', height: '30%', boxShadow: 'inset 0 0 10px rgba(0, 210, 255, 0.8), 0 0 8px rgba(0, 210, 255, 0.5)', backgroundColor: 'rgba(0, 210, 255, 0.4)' }} />}
              {isValidMove && pieceObj && <div className="absolute inset-0 z-10 pointer-events-none border-4 rounded-md" style={{ borderColor: 'rgba(0, 210, 255, 0.8)' }} />}
              {pieceObj && (
                <div
                  className="z-20 relative font-bold leading-none select-none flex items-center justify-center w-full h-full text-[8.5vw] sm:text-[45px] md:text-[55px] lg:text-[65px]"
                  style={{
                    color: pieceObj.color === 'w' ? '#ffffff' : '#000000',
                    textShadow: pieceObj.color === 'w' ? '0 2px 4px rgba(0,0,0,0.8), 0 0 6px #000, 0 0 2px #000' : '0 2px 4px rgba(255,255,255,0.8), 0 0 6px #fff, 0 0 2px #fff',
                  }}
                >
                  {pieceText}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

const CapturedPieces = ({ pieces }) => {
  const getSymbol = (p) => {
    const isWhite = p.color === 'w';
    const syms = { p: isWhite?'♙\uFE0E':'♟\uFE0E', n: isWhite?'♘\uFE0E':'♞\uFE0E', b: isWhite?'♗\uFE0E':'♝\uFE0E', r: isWhite?'♖\uFE0E':'♜\uFE0E', q: isWhite?'♕\uFE0E':'♛\uFE0E' };
    return syms[p.type];
  };

  if (pieces.length === 0) return <div className="h-6"></div>;

  return (
    <div className="flex flex-wrap gap-0.5 mt-2 ml-1 h-6 items-center">
      {pieces.map((p, i) => (
        <span 
          key={i} 
          className="text-xl font-bold leading-none select-none"
          style={{
            color: p.color === 'w' ? '#ffffff' : '#000000',
            textShadow: p.color === 'w' ? '0 1px 2px rgba(0,0,0,0.8), 0 0 3px #000' : '0 1px 2px rgba(255,255,255,0.8), 0 0 3px #fff'
          }}
        >
          {getSymbol(p)}
        </span>
      ))}
    </div>
  );
};

const GameArena = () => {
  const navigate = useNavigate();
  const [setupPhase, setSetupPhase] = useState('color'); 
  const [playerColor, setPlayerColor] = useState(null); 
  const [timeMode, setTimeMode] = useState(null); 
  const [playerTime, setPlayerTime] = useState(0);
  const [botTime, setBotTime] = useState(0);
  const [timeUp, setTimeUp] = useState(null); 
  const [customMinutes, setCustomMinutes] = useState(15);
  
  const [game, setGame] = useState(new Chess());
  const [sourceSquare, setSourceSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [botThinking, setBotThinking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loneKingMoves, setLoneKingMoves] = useState(0);
  const [isResigned, setIsResigned] = useState(false);
  
  // Analysis States
  const [analysisData, setAnalysisData] = useState(null);
  const [perfectGame, setPerfectGame] = useState(false);
  
  // UI States for Tutors
  const [reviewMode, setReviewMode] = useState('blunders'); // 'blunders' or 'brilliant'
  const [reviewIndex, setReviewIndex] = useState(-1);
  const [focusedAlternative, setFocusedAlternative] = useState(null);
  const [strategyStep, setStrategyStep] = useState(0); 
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const capturedPieces = getCapturedPieces(game);
  const isGameFinished = game.isGameOver() || game.isDraw() || loneKingMoves >= SURVIVAL_LIMIT || isResigned || timeUp !== null;
  const hasStarted = game.history().length > 0;

  // --- ADVANCED FIREBASE MATCH RECORDING ---
  useEffect(() => {
    if (isGameFinished && auth.currentUser && hasStarted && !perfectGame) {
      const updateMatchData = async () => {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        
        let eloChange = 0;
        let isWin = 0; let isLoss = 0; let isDraw = 0;

        if (isResigned || timeUp === playerColor || (game.isCheckmate() && game.turn() === playerColor) || loneKingMoves >= SURVIVAL_LIMIT) {
          eloChange = -15; 
          isLoss = 1;
        } else if (game.isDraw()) {
          eloChange = +2; 
          isDraw = 1;
        } else {
          eloChange = +15; 
          isWin = 1;
        }

        const userSnap = await getDoc(userRef);
        let newPeak = userSnap.data()?.peakElo || 1200;
        const currentElo = userSnap.data()?.elo || 1200;
        const finalElo = currentElo + eloChange;
        
        if (finalElo > newPeak) {
          newPeak = finalElo;
        }

        updateDoc(userRef, {
          elo: finalElo,
          peakElo: newPeak,
          gamesPlayed: increment(1),
          wins: increment(isWin),
          losses: increment(isLoss),
          draws: increment(isDraw),
          totalBlunders: increment(analysisData ? analysisData.blunders_found : 0)
        }).catch(e => console.error("Database update failed:", e));
      };

      updateMatchData();
    }
  }, [isGameFinished]); 

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (setupPhase !== 'playing' || timeMode !== 'timed' || isGameFinished || reviewIndex !== -1 || perfectGame) return;

    const timer = setInterval(() => {
      if (game.turn() === playerColor) {
        setPlayerTime(t => {
          if (t <= 1) { clearInterval(timer); setTimeUp(playerColor); return 0; }
          return t - 1;
        });
      } else {
        setBotTime(t => {
          if (t <= 1) { clearInterval(timer); setTimeUp(game.turn()); return 0; }
          return t - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [setupPhase, timeMode, game.turn(), playerColor, isGameFinished, reviewIndex, perfectGame]);

  // --- UPDATED DYNAMIC ARROWS (Handles Blunders & Strategies) ---
  let currentArrows = [];
  if (reviewIndex >= 0 && analysisData) {
    if (reviewMode === 'blunders' && analysisData.blunders[reviewIndex]) {
      const b = analysisData.blunders[reviewIndex];
      if (focusedAlternative) {
        currentArrows.push({ from: focusedAlternative.substring(0, 2), to: focusedAlternative.substring(2, 4), color: 'green' });
        if (b.played_move_uci) {
          currentArrows.push({ from: b.played_move_uci.substring(0, 2), to: b.played_move_uci.substring(2, 4), color: 'red' });
        }
      } else {
        if (b.best_moves_uci && b.best_moves_uci.length > 0) {
          let colorIdx = 0;
          b.best_moves_uci.forEach((moveUci) => {
            if (moveUci !== b.played_move_uci) {
              const color = colorIdx === 0 ? 'green' : (colorIdx === 1 ? 'emerald' : 'teal');
              currentArrows.push({ from: moveUci.substring(0, 2), to: moveUci.substring(2, 4), color: color });
              colorIdx++;
            }
          });
        }
        if (b.played_move_uci) {
          currentArrows.push({ from: b.played_move_uci.substring(0, 2), to: b.played_move_uci.substring(2, 4), color: 'red' });
        }
      }
    } 
    else if (reviewMode === 'brilliant' && analysisData.brilliant_moves[reviewIndex]) {
      const b = analysisData.brilliant_moves[reviewIndex];
      if (b.strategy_line_uci && strategyStep < b.strategy_line_uci.length) {
        const moveUci = b.strategy_line_uci[strategyStep];
        const isUserMove = strategyStep % 2 === 0;
        currentArrows.push({ 
          from: moveUci.substring(0, 2), 
          to: moveUci.substring(2, 4), 
          color: isUserMove ? 'emerald' : 'red' 
        });
      }
    }
  }

  // --- NAVIGATION HELPERS ---
  const toggleReviewMode = (mode) => {
    setReviewMode(mode);
    setReviewIndex(0);
    setStrategyStep(0);
    setFocusedAlternative(null);
    const list = mode === 'blunders' ? analysisData.blunders : analysisData.brilliant_moves;
    if (list && list.length > 0) {
       setGame(new Chess(list[0].fen));
    }
  };

  const handleReviewNav = (dir) => {
    const list = reviewMode === 'blunders' ? analysisData.blunders : analysisData.brilliant_moves;
    if (!list || list.length === 0) return;
    let newIdx = reviewIndex + dir;
    if (newIdx >= 0 && newIdx < list.length) {
      setFocusedAlternative(null); 
      setStrategyStep(0); 
      setReviewIndex(newIdx);
      setGame(new Chess(list[newIdx].fen));
    }
  };

  const handleStrategyStep = (dir) => {
    const b = analysisData.brilliant_moves[reviewIndex];
    const newStep = strategyStep + dir;
    if (newStep >= 0 && newStep <= b.strategy_line_uci.length) {
      const tempGame = new Chess(b.fen);
      for(let i=0; i<newStep; i++) {
        const mUci = b.strategy_line_uci[i];
        tempGame.move({from: mUci.substring(0,2), to: mUci.substring(2,4), promotion: mUci.length === 5 ? mUci[4] : undefined});
      }
      setGame(tempGame);
      setStrategyStep(newStep);
    }
  };

  useEffect(() => {
    const currentFen = game.fen();
    const whitePieceCount = (currentFen.split(' ')[0].match(/[A-Z]/g) || []).length;
    const blackPieceCount = (currentFen.split(' ')[0].match(/[a-z]/g) || []).length;
    const userPieceCount = playerColor === 'w' ? whitePieceCount : blackPieceCount;

    if (userPieceCount === 1 && !game.isGameOver()) {
      setLoneKingMoves(prev => prev + 1);
    } else {
      setLoneKingMoves(0);
    }
  }, [game.fen(), playerColor]);

  const makeAIMove = useCallback(() => {
    if (isGameFinished || reviewIndex !== -1 || perfectGame || setupPhase !== 'playing' || pendingPromotion) return;

    setBotThinking(true);
    const startTime = Date.now();

    setTimeout(() => {
      const possibleMoves = game.moves({ verbose: true });
      if (possibleMoves.length === 0) {
        setBotThinking(false);
        return;
      }

      let bestMove = possibleMoves[0];
      const isAIMaximizing = playerColor === 'b';
      let bestValue = isAIMaximizing ? -Infinity : Infinity;

      const evalGameCopy = new Chess(game.fen());

      for (let i = 0; i < possibleMoves.length; i++) {
        evalGameCopy.move(possibleMoves[i].san);
        const boardValue = minimax(evalGameCopy, 2, -Infinity, Infinity, !isAIMaximizing);
        evalGameCopy.undo();

        const randomNudge = Math.random() * 10 - 5;
        const nudgedValue = boardValue + randomNudge;

        if (isAIMaximizing) {
          if (nudgedValue > bestValue) {
            bestValue = nudgedValue;
            bestMove = possibleMoves[i];
          }
        } else {
          if (nudgedValue < bestValue) {
            bestValue = nudgedValue;
            bestMove = possibleMoves[i];
          }
        }
      }

      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 1000 - elapsed);

      setTimeout(() => {
        const finalGame = new Chess();
        finalGame.loadPgn(game.pgn());
        
        const moveObj = { from: bestMove.from, to: bestMove.to };
        if (bestMove.promotion || (bestMove.piece === 'p' && (bestMove.to[1] === '1' || bestMove.to[1] === '8'))) {
            moveObj.promotion = 'q';
        }

        finalGame.move(moveObj);
        setGame(finalGame);
        setBotThinking(false);
      }, remainingDelay);

    }, 50);
  }, [game, loneKingMoves, isGameFinished, reviewIndex, perfectGame, playerColor, setupPhase, pendingPromotion]);

  useEffect(() => {
    if (setupPhase === 'playing' && playerColor && game.turn() !== playerColor && reviewIndex === -1 && !perfectGame) {
      makeAIMove();
    }
  }, [game, makeAIMove, reviewIndex, perfectGame, playerColor, setupPhase]);

  const handleSquareClick = (square) => {
    if (setupPhase !== 'playing' || game.turn() !== playerColor || botThinking || isGameFinished || reviewIndex !== -1 || perfectGame || pendingPromotion) return;

    if (sourceSquare) {
      const moves = validMoves.filter(m => m.to === square);
      
      if (moves.length > 0) {
        if (moves[0].promotion) {
          setPendingPromotion({ from: sourceSquare, to: square });
          return;
        }

        const gameCopy = new Chess();
        gameCopy.loadPgn(game.pgn());
        try {
          gameCopy.move({ from: sourceSquare, to: square });
          setGame(gameCopy);
          setSourceSquare(null);
          setValidMoves([]);
          return;
        } catch (e) {
          console.error("Move failed:", e);
        }
      }
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setSourceSquare(square);
      const moves = game.moves({ square, verbose: true });
      setValidMoves(moves);
    } else {
      setSourceSquare(null);
      setValidMoves([]);
    }
  };

  const handlePromotion = (promotedPiece) => {
    if (!pendingPromotion) return;
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    try {
      gameCopy.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: promotedPiece });
      setGame(gameCopy);
    } catch (e) {
      console.error("Promotion failed:", e);
    }
    setPendingPromotion(null);
    setSourceSquare(null);
    setValidMoves([]);
  };

  const handleAnalyzeGame = async () => {
    const humanMovesPlayed = game.history().filter((_, i) => (playerColor === 'w' ? i % 2 === 0 : i % 2 !== 0)).length;

    if (humanMovesPlayed === 0) {
      alert("Hold your horses! You haven't made any moves yet. Play the game before asking for advice.");
      return;
    }
    
    if (humanMovesPlayed < 3) {
      alert("You've barely started! Play a few more moves so the AI has enough data to review your strategy.");
      return;
    }

    // --- DOT GLITCH FIX 1 ---
    setSourceSquare(null);
    setValidMoves([]);
    setIsAnalyzing(true);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pgn: game.pgn(), player_color: playerColor })
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.blunders_found > 0 || data.brilliant_found > 0) {
          setAnalysisData(data);
          
          if (data.blunders_found > 0) {
            setReviewMode('blunders');
            setReviewIndex(0);
            setGame(new Chess(data.blunders[0].fen));
          } else {
            setReviewMode('brilliant');
            setReviewIndex(0);
            setGame(new Chess(data.brilliant_moves[0].fen));
          }
        } else {
          setPerfectGame(true);
        }
      } else {
        alert("Error analyzing game: " + (data.detail || "Unknown error"));
      }
    } catch (error) {
      alert("Failed to connect to backend. Is your FastAPI server (uvicorn main:app --reload) currently running?");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRestart = () => {
    setSetupPhase('color');
    setPlayerColor(null);
    setTimeMode(null);
    setGame(new Chess());
    setSourceSquare(null);
    setValidMoves([]);
    setBotThinking(false);
    setIsAnalyzing(false);
    setIsResigned(false);
    setAnalysisData(null);
    setReviewIndex(-1);
    setPendingPromotion(null);
    setTimeUp(null);
    setPerfectGame(false);
    setFocusedAlternative(null);
    setStrategyStep(0);
  };

  return (
    <div className={`max-w-6xl mx-auto p-4 md:p-8 flex flex-col ${setupPhase === 'playing' ? 'md:flex-row' : 'md:flex-row justify-center'} gap-8`}>
      
      {/* Left Column: Board / Menus */}
      <div className="flex-1 w-full max-w-[600px]">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-500 hover:text-slate-900 dark:hover:text-white transition font-bold"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>
          <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
            vs Sophisticated AI
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-2xl p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 pb-2 min-h-[400px]">
          <div className="rounded-xl overflow-hidden shadow-inner border border-gray-300 dark:border-black h-full flex flex-col relative">
            
            {/* SETUP FLOW */}
            {setupPhase === 'color' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-12 text-center bg-[#dfe6e9] dark:bg-[#2f3542]">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-8">Choose Your Side</h2>
                <div className="flex gap-6 w-full max-w-sm">
                  <button onClick={() => { setPlayerColor('w'); setSetupPhase('mode'); }} className="flex-1 bg-white hover:bg-gray-100 text-slate-900 border-4 border-gray-300 shadow-xl rounded-xl py-6 font-bold text-xl transition transform hover:scale-105">
                    <div className="text-5xl mb-2">♙</div>White
                  </button>
                  <button onClick={() => { setPlayerColor('b'); setSetupPhase('mode'); }} className="flex-1 bg-[#1a1a1a] hover:bg-black text-white border-4 border-gray-700 shadow-xl rounded-xl py-6 font-bold text-xl transition transform hover:scale-105">
                    <div className="text-5xl mb-2">♟</div>Black
                  </button>
                </div>
              </div>
            )}

            {setupPhase === 'mode' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-12 text-center bg-[#dfe6e9] dark:bg-[#2f3542]">
                <button onClick={() => setSetupPhase('color')} className="absolute top-4 left-4 text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft size={24} /></button>
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-8">Select Mode</h2>
                <div className="flex flex-col gap-4 w-full max-w-sm">
                  <button onClick={() => { setTimeMode('timed'); setSetupPhase('time'); }} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white shadow-xl rounded-xl py-5 font-bold text-lg transition transform hover:scale-105">
                    <Clock size={24} /> Play with Timer
                  </button>
                  <button onClick={() => { setTimeMode('none'); setSetupPhase('playing'); }} className="w-full flex items-center justify-center gap-3 bg-slate-500 hover:bg-slate-600 text-white shadow-xl rounded-xl py-5 font-bold text-lg transition transform hover:scale-105">
                    <Flag size={24} /> No Timer (Casual)
                  </button>
                </div>
              </div>
            )}

            {setupPhase === 'time' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 sm:p-12 text-center bg-[#dfe6e9] dark:bg-[#2f3542]">
                <button onClick={() => setSetupPhase('mode')} className="absolute top-4 left-4 text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft size={24} /></button>
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-8">Time Control</h2>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                  {[3, 5, 10].map(mins => (
                    <button 
                      key={mins}
                      onClick={() => { setPlayerTime(mins * 60); setBotTime(mins * 60); setSetupPhase('playing'); }} 
                      className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 shadow-xl rounded-xl py-6 font-bold transition transform hover:scale-105"
                    >
                      <Clock4 size={28} className="mb-2 text-blue-500" />
                      <span className="text-2xl">{mins}</span>
                      <span className="text-sm font-normal text-slate-500">min</span>
                    </button>
                  ))}
                  <button 
                    onClick={() => setSetupPhase('customTime')} 
                    className="flex flex-col items-center justify-center bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 shadow-xl rounded-xl py-6 font-bold transition transform hover:scale-105"
                  >
                    <Settings size={28} className="mb-2 text-indigo-500" />
                    <span className="text-2xl">Custom</span>
                    <span className="text-sm font-normal text-slate-500">timer</span>
                  </button>
                </div>
              </div>
            )}

            {setupPhase === 'customTime' && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-12 text-center bg-[#dfe6e9] dark:bg-[#2f3542]">
                <button onClick={() => setSetupPhase('time')} className="absolute top-4 left-4 text-slate-500 hover:text-slate-800 dark:hover:text-white"><ArrowLeft size={24} /></button>
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-200 mb-8">Custom Timer</h2>
                <div className="flex flex-col items-center w-full max-w-xs gap-6">
                  <div className="flex items-center justify-center space-x-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-inner border-2 border-gray-200 dark:border-gray-700 w-full">
                    <input 
                      type="number" 
                      min="1" 
                      max="180" 
                      value={customMinutes} 
                      onChange={(e) => setCustomMinutes(e.target.value)} 
                      className="w-20 text-center text-4xl font-black bg-transparent text-slate-900 dark:text-white outline-none focus:ring-0" 
                    />
                    <span className="text-xl font-bold text-slate-500">min</span>
                  </div>
                  <button 
                    onClick={() => {
                      const m = Math.max(1, parseInt(customMinutes) || 1);
                      setPlayerTime(m * 60); 
                      setBotTime(m * 60); 
                      setSetupPhase('playing'); 
                    }} 
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xl rounded-xl py-4 font-bold text-xl transition transform hover:scale-105"
                  >
                    Start Game
                  </button>
                </div>
              </div>
            )}

            <CustomChessboard
              game={game}
              playerColor={playerColor}
              onSquareClick={handleSquareClick}
              sourceSquare={sourceSquare}
              validMoves={validMoves}
              arrows={currentArrows}
              pendingPromotion={pendingPromotion}
              onPromote={handlePromotion}
            />
          </div>
        </div>
      </div>

      {/* Right Column: Status & Controls */}
      {setupPhase === 'playing' && (
        <div className="w-full md:w-80 space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 shadow-xl border border-gray-200 dark:border-gray-800">

            {/* DUAL MODE TOGGLE BAR */}
            {analysisData && (analysisData.blunders_found > 0 || analysisData.brilliant_found > 0) && (
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 mb-6 border border-gray-200 dark:border-gray-700">
                 {analysisData.blunders_found > 0 && (
                    <button 
                      onClick={() => toggleReviewMode('blunders')} 
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${reviewMode==='blunders' ? 'bg-white dark:bg-slate-900 shadow-sm text-red-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Blunders ({analysisData.blunders_found})
                    </button>
                 )}
                 {analysisData.brilliant_found > 0 && (
                    <button 
                      onClick={() => toggleReviewMode('brilliant')} 
                      className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${reviewMode==='brilliant' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Strategies ({analysisData.brilliant_found})
                    </button>
                 )}
              </div>
            )}

            {/* PERFECT GAME UI */}
            {perfectGame ? (
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <PartyPopper size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Brilliant Game!</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  The AI analyzed all your moves and found exactly 0 blunders. You played flawlessly.
                </p>
              </div>
            ) : reviewIndex >= 0 && analysisData ? (
              
              // --- DYNAMIC TUTOR UI (BLUNDER VS BRILLIANT) ---
              <div>
                
                {/* HEADERS */}
                <div className="flex items-center space-x-2 mb-4">
                  {reviewMode === 'blunders' ? <BrainCircuit className="text-blue-500" size={24} /> : <Sparkles className="text-emerald-500" size={24} />}
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    {reviewMode === 'blunders' ? 'Blunder Tutor' : 'Strategy Masterclass'}
                  </h3>
                </div>
                
                <div className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2">
                  {reviewMode === 'blunders' ? 'Blunder ' : 'Strategy '} 
                  {reviewIndex + 1} of {reviewMode === 'blunders' ? analysisData.blunders.length : analysisData.brilliant_moves.length}
                </div>
                
                {/* TUTOR CARD CONTENT */}
                {reviewMode === 'blunders' ? (
                  // --- BLUNDER MODE CONTENT ---
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 shadow-inner mb-6 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1 tracking-wider">Mistake</h4>
                      <p className="text-slate-900 dark:text-white font-medium leading-relaxed italic text-sm">"{analysisData.blunders[reviewIndex].explanation.replace(/^Line 1:\s*/i, '')}"</p>
                    </div>
                    {analysisData.blunders[reviewIndex].solution && (
                      <div>
                        <h4 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1 tracking-wider">How to Overcome</h4>
                        <p className="text-slate-900 dark:text-white font-medium leading-relaxed text-sm">{analysisData.blunders[reviewIndex].solution.replace(/^Line 2:\s*/i, '')}</p>
                      </div>
                    )}
                    
                    {analysisData.blunders[reviewIndex].best_moves_uci && (
                      (() => {
                        const validAlts = analysisData.blunders[reviewIndex].best_moves_uci.filter(
                          m => m !== analysisData.blunders[reviewIndex].played_move_uci
                        );
                        if (validAlts.length === 0) return null;

                        return (
                          <div className="pt-3 border-t border-blue-200 dark:border-blue-800">
                            <h4 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase mb-2 tracking-wider">Better Alternatives</h4>
                            <div className="flex flex-wrap gap-2">
                              {validAlts.map((moveUci, i) => {
                                const isFocused = focusedAlternative === moveUci;
                                return (
                                  <button 
                                    key={i} 
                                    onClick={() => setFocusedAlternative(isFocused ? null : moveUci)}
                                    className={`px-3 py-1 rounded-md text-sm font-bold shadow-sm transition 
                                      ${isFocused 
                                        ? 'bg-green-500 text-white border-green-600 shadow-inner' 
                                        : 'bg-white dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-700'
                                      }`}
                                  >
                                    {moveUci.substring(0, 2)} &rarr; {moveUci.substring(2, 4)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ) : (
                  // --- BRILLIANT MODE CONTENT ---
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 shadow-inner mb-6 space-y-4">
                    <div>
                      {/* DYNAMIC CATEGORY LABEL */}
                      <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1 tracking-wider">
                        {analysisData.brilliant_moves[reviewIndex].category} Move
                      </h4>
                      <p className="text-slate-900 dark:text-white font-medium leading-relaxed italic text-sm">"{analysisData.brilliant_moves[reviewIndex].explanation}"</p>
                    </div>
                    
                    {analysisData.brilliant_moves[reviewIndex].strategy_line_uci && (
                      <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800">
                        <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2 tracking-wider">
                          Execution (Step {strategyStep}/{analysisData.brilliant_moves[reviewIndex].strategy_line_uci.length})
                        </h4>
                        
                        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900">
                          <button 
                            onClick={() => handleStrategyStep(-1)} 
                            disabled={strategyStep === 0} 
                            className="p-1 rounded bg-slate-100 dark:bg-slate-700 disabled:opacity-30 text-emerald-600 dark:text-emerald-400 transition hover:bg-slate-200 dark:hover:bg-slate-600"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                            {strategyStep === 0 ? 'Your Move' : (strategyStep % 2 === 1 ? "Opponent Reply" : "Your Follow-up")}
                          </span>
                          
                          <button 
                            onClick={() => handleStrategyStep(1)} 
                            disabled={strategyStep === analysisData.brilliant_moves[reviewIndex].strategy_line_uci.length} 
                            className="p-1 rounded bg-emerald-500 disabled:opacity-30 text-white transition hover:bg-emerald-600 shadow-sm"
                          >
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* NAVIGATION CONTROLS */}
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => handleReviewNav(-1)} disabled={reviewIndex === 0} className={`p-2 rounded-lg transition ${reviewIndex === 0 ? 'bg-gray-200 dark:bg-gray-800 text-gray-400' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400'}`}><ChevronLeft size={20} /></button>
                  <div className="text-xs font-bold text-gray-500">
                    <span className={reviewMode === 'blunders' ? 'text-red-500' : 'text-emerald-500'}>
                      Move: {reviewMode === 'blunders' ? analysisData.blunders[reviewIndex].move : analysisData.brilliant_moves[reviewIndex].move}
                    </span>
                  </div>
                  <button onClick={() => handleReviewNav(1)} disabled={reviewIndex === (reviewMode === 'blunders' ? analysisData.blunders.length - 1 : analysisData.brilliant_moves.length - 1)} className={`p-2 rounded-lg transition ${reviewIndex === (reviewMode === 'blunders' ? analysisData.blunders.length - 1 : analysisData.brilliant_moves.length - 1) ? 'bg-gray-200 dark:bg-gray-800 text-gray-400' : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400'}`}><ChevronRight size={20} /></button>
                </div>
              </div>
            ) : (
              // NORMAL GAME STATUS UI
              <>
                <h3 className="text-xl font-extrabold mb-6 text-slate-900 dark:text-white">Game Status</h3>

                <div className="space-y-4">
                  {/* BOT CARD */}
                  <div className={`p-4 rounded-xl flex flex-col justify-between transition-colors shadow-sm ${game.turn() !== playerColor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-800 border border-transparent'}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <div className={`w-5 h-5 rounded-full shadow-inner border border-gray-700 ${playerColor === 'w' ? 'bg-[#111]' : 'bg-white'}`}></div>
                        <span className="font-bold text-lg text-slate-900 dark:text-white">Bot ({playerColor === 'w' ? 'Black' : 'White'})</span>
                      </div>
                      {timeMode === 'timed' && (
                        <span className={`font-mono text-xl font-bold ${botTime < 30 ? 'text-red-500 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
                          {formatTime(botTime)}
                        </span>
                      )}
                    </div>
                    <CapturedPieces pieces={playerColor === 'w' ? capturedPieces.b : capturedPieces.w} />
                  </div>

                  {/* PLAYER CARD */}
                  <div className={`p-4 rounded-xl flex flex-col justify-between transition-colors shadow-sm ${game.turn() === playerColor ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-800 border border-transparent'}`}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <div className={`w-5 h-5 rounded-full shadow-md border border-gray-300 ${playerColor === 'w' ? 'bg-white' : 'bg-[#111]'}`}></div>
                        <span className="font-bold text-lg text-slate-900 dark:text-white">You ({playerColor === 'w' ? 'White' : 'Black'})</span>
                      </div>
                      {timeMode === 'timed' && (
                        <span className={`font-mono text-xl font-bold ${playerTime < 30 ? 'text-red-500 animate-pulse' : 'text-slate-600 dark:text-slate-300'}`}>
                          {formatTime(playerTime)}
                        </span>
                      )}
                    </div>
                    <CapturedPieces pieces={playerColor === 'w' ? capturedPieces.w : capturedPieces.b} />
                  </div>
                </div>
              </>
            )}

            {/* GAME OVER MESSAGES */}
            {loneKingMoves > 0 && loneKingMoves < SURVIVAL_LIMIT && !game.isGameOver() && (
              <div className="mt-4 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-400 font-bold text-center animate-pulse">
                Lone King! Survive {Math.ceil((SURVIVAL_LIMIT - loneKingMoves) / 2)} more turns!
              </div>
            )}

            {isGameFinished && playerColor && (
              <div className="mt-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-bold text-center shadow-inner">
                Game Over!{' '}
                {timeUp 
                  ? `Time Out! ${timeUp === 'w' ? 'Black' : 'White'} wins.`
                  : isResigned
                    ? `You Resigned. ${playerColor === 'w' ? 'Black' : 'White'} wins.`
                    : loneKingMoves >= SURVIVAL_LIMIT
                      ? `Army Overrun! ${playerColor === 'w' ? 'Black' : 'White'} wins.`
                      : game.isCheckmate()
                        ? (game.turn() === 'w' ? 'Black wins' : 'White wins')
                        : 'Draw'}
              </div>
            )}

            {/* DYNAMIC BUTTONS */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
              {/* 1. RESIGN: Only when it's your turn AND you've played at least 1 move */}
              {hasStarted && !isGameFinished && reviewIndex === -1 && !perfectGame && game.turn() === playerColor && (
                <button 
                  onClick={() => {
                    // --- DOT GLITCH FIX 2 ---
                    setSourceSquare(null);
                    setValidMoves([]);
                    setIsResigned(true);
                  }} 
                  className="w-full flex items-center justify-center space-x-3 py-4 px-4 rounded-full border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold transition"
                >
                  <Flag size={20} /><span>Resign Game</span>
                </button>
              )}

              {/* 2. ANALYZE: Only when game ends */}
              {isGameFinished && !analysisData && reviewIndex === -1 && !perfectGame && (
                <button onClick={handleAnalyzeGame} disabled={isAnalyzing || game.pgn() === ''} className={`w-full flex items-center justify-center space-x-3 py-4 px-4 rounded-full font-bold transition text-white shadow-lg transform hover:scale-105 ${isAnalyzing || game.pgn() === '' ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  <BrainCircuit size={20} className={isAnalyzing ? "animate-pulse" : ""} />
                  <span>{isAnalyzing ? "Connecting to AI..." : "Analyze Game with Groq AI"}</span>
                </button>
              )}

              {/* 3. RESTART */}
              {(hasStarted || isGameFinished) && (
                <button onClick={handleRestart} className="w-full flex items-center justify-center space-x-3 py-4 px-4 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 font-bold transition text-slate-900 dark:text-white transform hover:scale-105">
                  <RotateCcw size={20} /><span>Restart Game</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default GameArena;