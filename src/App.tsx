import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Timer, 
  Lightbulb, 
  RotateCcw, 
  Pencil, 
  Link2, 
  Settings2, 
  ChevronDown,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Eraser
} from 'lucide-react';
import { get, set } from 'idb-keyval';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SudokuLogic } from './lib/sudoku';
import { Difficulty, GameState, Chain } from './types';
import { getSudokuHint } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'sudoku_game_state';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [mode, setMode] = useState<'normal' | 'draft' | 'chain'>('normal');
  const [chainType, setChainType] = useState<'strong' | 'weak'>('strong');
  const [chainStart, setChainStart] = useState<{ row: number; col: number; num?: number } | null>(null);
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  const [hint, setHint] = useState<{ message: string; cells: [number, number][] } | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);

  const handleHintRequest = async () => {
    if (!gameState || isHintLoading) return;
    setIsHintLoading(true);
    try {
      const hintData = await getSudokuHint(gameState.grid, gameState.difficulty);
      setHint({
        message: hintData.message,
        cells: hintData.highlightCells || []
      });
      setGameState(prev => prev ? { ...prev, hintsUsed: prev.hintsUsed + 1 } : null);
    } catch (error) {
      console.error("Hint error:", error);
      setHint({ message: "Could not generate hint at this time.", cells: [] });
    } finally {
      setIsHintLoading(false);
    }
  };
  useEffect(() => {
    const loadGame = async () => {
      const saved = await get(STORAGE_KEY);
      if (saved) {
        setGameState(saved);
      } else {
        startNewGame('Advanced');
      }
    };
    loadGame();
  }, []);

  // Save game
  useEffect(() => {
    if (gameState) {
      set(STORAGE_KEY, gameState);
    }
  }, [gameState]);

  // Timer
  useEffect(() => {
    if (gameState?.status === 'playing') {
      const interval = setInterval(() => {
        setGameState(prev => prev ? { ...prev, time: prev.time + 1 } : null);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState?.status]);

  const startNewGame = (difficulty: Difficulty) => {
    const { grid, solution } = SudokuLogic.generate(difficulty);
    const newState: GameState = {
      grid,
      initialGrid: grid.map(row => [...row]),
      solution,
      notes: Array(9).fill(null).map(() => Array(9).fill(null).map(() => Array(10).fill(false))),
      chains: [],
      difficulty,
      time: 0,
      hintsUsed: 0,
      status: 'playing'
    };
    setGameState(newState);
    setSelectedCell(null);
    setHint(null);
    setShowDifficultyMenu(false);
  };

  const handleCellClick = (row: number, col: number) => {
    if (mode === 'chain') {
      setSelectedCell({ row, col });
    } else {
      setSelectedCell({ row, col });
    }
  };

  const handleNumberSelect = (num: number | null) => {
    if (!selectedCell || !gameState) return;
    const { row, col } = selectedCell;
    
    if (mode === 'chain') {
      if (num === null) {
        setSelectedCell(null);
        return;
      }
      if (!chainStart) {
        setChainStart({ row, col, num });
        setSelectedCell(null);
      } else {
        const newChain: Chain = {
          id: Math.random().toString(36).substr(2, 9),
          start: chainStart,
          end: { row, col, num },
          type: chainType
        };
        setGameState(prev => prev ? { ...prev, chains: [...prev.chains, newChain] } : null);
        setChainStart(null);
        setSelectedCell(null);
      }
      return;
    }

    if (gameState.initialGrid[row][col] !== null) return;

    if (num === null) {
      const newGrid = [...gameState.grid];
      newGrid[row][col] = null;
      setGameState({ ...gameState, grid: newGrid });
      setSelectedCell(null);
      return;
    }

    if (mode === 'draft') {
      const newNotes = [...gameState.notes];
      newNotes[row][col][num] = !newNotes[row][col][num];
      setGameState({ ...gameState, notes: newNotes });
    } else {
      const newGrid = [...gameState.grid];
      newGrid[row][col] = newGrid[row][col] === num ? null : num;
      
      // Check win
      const isWon = newGrid.every((r, ri) => r.every((c, ci) => c === gameState.solution[ri][ci]));
      
      setGameState({ 
        ...gameState, 
        grid: newGrid,
        status: isWon ? 'won' : 'playing'
      });
      setSelectedCell(null);
    }
  };

  const undoChain = () => {
    setGameState(prev => prev ? { ...prev, chains: prev.chains.slice(0, -1) } : null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-emerald-200">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-4">
          <div className="bg-black text-white p-2 rounded-lg">
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest">禅意数独</h1>
            <p className="text-[10px] text-black/50 font-mono">{gameState.difficulty === 'Advanced' ? '高级' : gameState.difficulty === 'Expert' ? '专家' : '地狱'} 难度</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-tighter text-black/40 font-bold">时间</span>
            <div className="flex items-center gap-1 font-mono text-sm">
              <Timer size={14} />
              {formatTime(gameState.time)}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-tighter text-black/40 font-bold">提示</span>
            <div className="flex items-center gap-1 font-mono text-sm">
              <Lightbulb size={14} />
              {gameState.hintsUsed}
            </div>
          </div>
        </div>
      </header>

      {/* Main Board Area */}
      <main className="pt-24 pb-32 px-4 flex flex-col items-center justify-center min-h-screen">
        <div className="relative group">
          {/* SVG Overlay for Chains */}
          <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full">
            {gameState.chains.map(chain => {
              const getPos = (row: number, col: number, num?: number) => {
                const cellW = 100 / 9;
                const cellH = 100 / 9;
                let x = (col * cellW) + (cellW / 2);
                let y = (row * cellH) + (cellH / 2);

                if (num) {
                  const subRow = Math.floor((num - 1) / 3);
                  const subCol = (num - 1) % 3;
                  const subW = cellW / 3;
                  const subH = cellH / 3;
                  x = (col * cellW) + (subCol * subW) + (subW / 2);
                  y = (row * cellH) + (subRow * subH) + (subH / 2);
                }
                return { x, y };
              };

              const start = getPos(chain.start.row, chain.start.col, chain.start.num);
              const end = getPos(chain.end.row, chain.end.col, chain.end.num);
              
              return (
                <line
                  key={chain.id}
                  x1={`${start.x}%`}
                  y1={`${start.y}%`}
                  x2={`${end.x}%`}
                  y2={`${end.y}%`}
                  stroke={chain.type === 'strong' ? '#10b981' : '#ef4444'}
                  strokeWidth="2"
                  strokeDasharray={chain.type === 'weak' ? "4 2" : "0"}
                  className="opacity-80"
                />
              );
            })}
          </svg>

          {/* Sudoku Grid */}
          <div className="grid grid-cols-9 border-2 border-black bg-white shadow-2xl rounded-sm overflow-hidden w-full max-w-[500px] aspect-square">
            {gameState.grid.map((row, ri) => (
              row.map((val, ci) => {
                const isInitial = gameState.initialGrid[ri][ci] !== null;
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                const isChainStart = chainStart?.row === ri && chainStart?.col === ci;
                const isHinted = hint?.cells.some(([r, c]) => r === ri && c === ci);
                
                return (
                  <div
                    key={`${ri}-${ci}`}
                    onClick={() => handleCellClick(ri, ci)}
                    className={cn(
                      "relative flex items-center justify-center text-xl sm:text-2xl cursor-pointer transition-all duration-200 border-[0.5px] border-black/10 aspect-square",
                      (ci + 1) % 3 === 0 && ci !== 8 && "border-r-2 border-r-black",
                      (ri + 1) % 3 === 0 && ri !== 8 && "border-b-2 border-b-black",
                      isSelected && "bg-emerald-50 z-10 scale-[1.02] shadow-lg",
                      isChainStart && "ring-2 ring-inset ring-emerald-400 bg-emerald-50/50",
                      !isSelected && !isChainStart && "hover:bg-black/5",
                      isHinted && "bg-amber-100/50",
                      isInitial ? "font-bold text-black" : "font-light text-emerald-600"
                    )}
                  >
                    {val !== null ? (
                      <motion.span
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                      >
                        {val}
                      </motion.span>
                    ) : (
                      <div className="grid grid-cols-3 gap-[1px] w-full h-full p-[2px]">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center text-[8px] sm:text-[10px] text-black/30 leading-none">
                            {gameState.notes[ri][ci][i + 1] ? i + 1 : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ))}
          </div>

          {/* Number Picker Pop-up */}
          <AnimatePresence>
            {selectedCell && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute left-1/2 -translate-x-1/2 -bottom-24 z-50 bg-white p-2 rounded-xl shadow-2xl border border-black/10 flex gap-1"
              >
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumberSelect(num)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-emerald-500 hover:text-white transition-colors font-bold border border-black/5"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => handleNumberSelect(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors border border-red-100"
                    title="擦除"
                  >
                    <Eraser size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hint Message */}
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl max-w-md text-center"
            >
              <p className="text-sm text-amber-900 italic">"{hint.message}"</p>
              <button 
                onClick={() => setHint(null)}
                className="mt-2 text-[10px] uppercase font-bold text-amber-700 hover:underline"
              >
                关闭
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Tools */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        <div className="bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-black/5 flex items-center gap-1">
          <ToolButton 
            active={mode === 'normal'} 
            onClick={() => setMode('normal')}
            icon={<CheckCircle2 size={20} />}
            label="填数"
          />
          <ToolButton 
            active={mode === 'draft'} 
            onClick={() => setMode('draft')}
            icon={<Pencil size={20} />}
            label="草稿"
          />
          <div className="w-[1px] h-8 bg-black/5 mx-1" />
          <ToolButton 
            active={mode === 'chain'} 
            onClick={() => setMode('chain')}
            icon={<Link2 size={20} />}
            label="推理链"
          />
          {mode === 'chain' && (
            <div className="flex gap-1 ml-1">
              <button
                onClick={() => setChainType('strong')}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  chainType === 'strong' ? "bg-emerald-500 text-white" : "bg-black/5 text-black/40"
                )}
              >
                强链
              </button>
              <button
                onClick={() => setChainType('weak')}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-bold transition-all",
                  chainType === 'weak' ? "bg-red-500 text-white" : "bg-black/5 text-black/40"
                )}
              >
                弱链
              </button>
              <button
                onClick={undoChain}
                className="p-1 rounded-md bg-black/5 text-black/40 hover:bg-black/10"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-black/5 flex items-center gap-1">
          <ToolButton 
            onClick={handleHintRequest}
            icon={isHintLoading ? <div className="animate-spin"><RotateCcw size={20} /></div> : <Lightbulb size={20} />}
            label="提示"
          />
          <div className="relative">
            <ToolButton 
              onClick={() => setShowDifficultyMenu(!showDifficultyMenu)}
              icon={<Settings2 size={20} />}
              label="新游戏"
            />
            <AnimatePresence>
              {showDifficultyMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-black/5 p-2 min-w-[120px]"
                >
                  {(['Advanced', 'Expert', 'Hell'] as Difficulty[]).map(d => (
                    <button
                      key={d}
                      onClick={() => startNewGame(d)}
                      className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      {d === 'Advanced' ? '高级' : d === 'Expert' ? '专家' : '地狱'}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Win Modal */}
      <AnimatePresence>
        {gameState.status === 'won' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2">挑战成功！</h2>
              <p className="text-black/50 text-sm mb-6">
                你以 {gameState.difficulty === 'Advanced' ? '高级' : gameState.difficulty === 'Expert' ? '专家' : '地狱'} 难度完成了挑战，用时 {formatTime(gameState.time)}。
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-black/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-black/40">提示次数</span>
                  <span className="text-lg font-mono">{gameState.hintsUsed}</span>
                </div>
                <div className="bg-black/5 p-3 rounded-xl">
                  <span className="block text-[10px] uppercase font-bold text-black/40">总用时</span>
                  <span className="text-lg font-mono">{formatTime(gameState.time)}</span>
                </div>
              </div>
              <button
                onClick={() => startNewGame(gameState.difficulty)}
                className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors"
              >
                再玩一次
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300",
        active ? "bg-black text-white shadow-lg" : "text-black/40 hover:bg-black/5 hover:text-black"
      )}
    >
      {icon}
      <span className="text-[8px] uppercase font-bold mt-1 tracking-tighter">{label}</span>
    </button>
  );
}
