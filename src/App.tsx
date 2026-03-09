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
  Eraser,
  Download
} from 'lucide-react';
import { get, set } from 'idb-keyval';
import * as htmlToImage from 'html-to-image';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SudokuLogic } from './lib/sudoku';
import { Difficulty, GameState, Chain } from './types';
import { getSudokuHint } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STORAGE_KEY = 'sudoku_game_state';

console.log("App starting...");

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [savedGame, setSavedGame] = useState<GameState | null>(null);
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'normal' | 'draft' | 'chain'>('normal');
  const [chainType, setChainType] = useState<'strong' | 'weak'>('strong');
  const [chainStart, setChainStart] = useState<{ row: number; col: number; num?: number } | null>(null);
  const [showCandidatePicker, setShowCandidatePicker] = useState(false);
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const loadGame = async () => {
      try {
        setIsInitializing(true);
        const saved = await get(STORAGE_KEY);
        if (saved) {
          setSavedGame(saved);
          setShowResumeScreen(true);
        } else {
          startNewGame('Advanced');
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setInitError("无法初始化游戏，请刷新页面重试。");
      } finally {
        setIsInitializing(false);
      }
    };
    loadGame();
  }, []);

  const handleResume = () => {
    if (savedGame) {
      setGameState(savedGame);
      setShowResumeScreen(false);
    }
  };

  const handleStartNewFromResume = () => {
    setShowResumeScreen(false);
    startNewGame('Advanced');
  };

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
      if (!gameState) return;
      // Only allow empty cells with candidates
      if (gameState.grid[row][col] !== null) return;
      const hasCandidates = gameState.notes[row][col].some(v => v);
      if (!hasCandidates) return;

      setSelectedCell({ row, col });
      setShowCandidatePicker(true);
    } else {
      setSelectedCell({ row, col });
    }
  };

  const handleCandidateSelect = (num: number) => {
    if (!selectedCell || !gameState) return;
    const { row, col } = selectedCell;

    if (!chainStart) {
      setChainStart({ row, col, num });
      setShowCandidatePicker(false);
      setSelectedCell(null);
    } else {
      // Create chain
      const newChain: Chain = {
        id: Math.random().toString(36).substr(2, 9),
        start: chainStart,
        end: { row, col, num },
        type: chainType
      };
      setGameState(prev => prev ? { ...prev, chains: [...prev.chains, newChain] } : null);
      setChainStart(null);
      setShowCandidatePicker(false);
      setSelectedCell(null);
    }
  };

  const handleNumberSelect = (num: number | null) => {
    if (!selectedCell || !gameState) return;
    const { row, col } = selectedCell;
    
    if (mode === 'chain') {
      // In chain mode, we use handleCandidateSelect instead
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

  const exportBoard = async () => {
    if (!boardRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(boardRef.current, {
        quality: 1,
        pixelRatio: 3, // High resolution
        backgroundColor: '#F5F5F0',
      });
      const link = document.createElement('a');
      link.download = `sudoku-board-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="animate-spin text-emerald-600">
          <RotateCcw size={40} />
        </div>
      </div>
    );
  }

  if (initError || (!gameState && !showResumeScreen)) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4 text-center">
        <p className="text-red-500 font-bold mb-4">{initError || "游戏加载失败"}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-black text-white px-6 py-2 rounded-xl font-bold"
        >
          刷新页面
        </button>
      </div>
    );
  }

  if (showResumeScreen) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-black/5 max-w-sm w-full">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <RotateCcw size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">发现进行中的游戏</h2>
          <p className="text-black/50 text-sm mb-8">
            您上次的游戏进度已保存，是否继续？
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleResume}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-lg active:scale-95"
            >
              继续游戏
            </button>
            <button
              onClick={handleStartNewFromResume}
              className="w-full bg-black/5 text-black/60 py-4 rounded-2xl font-bold hover:bg-black/10 transition-colors active:scale-95"
            >
              开始新游戏
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-emerald-200">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="bg-black text-white p-1.5 rounded-lg">
            <Trophy size={18} />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-widest">禅意数独</h1>
            <p className="text-[9px] text-black/50 font-mono">{gameState.difficulty === 'Advanced' ? '高级' : gameState.difficulty === 'Expert' ? '专家' : '地狱'} 难度</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-tighter text-black/40 font-bold">时间</span>
            <div className="flex items-center gap-1 font-mono text-xs">
              <Timer size={12} />
              {formatTime(gameState.time)}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-tighter text-black/40 font-bold">提示</span>
            <div className="flex items-center gap-1 font-mono text-xs">
              <Lightbulb size={12} />
              {gameState.hintsUsed}
            </div>
          </div>
        </div>
      </header>

      {/* Floating Tools at Top */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-40 w-full px-4">
        <div className="flex items-center gap-2 w-full max-w-md">
          <div className="flex-1 bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl shadow-xl border border-black/5 flex items-center justify-around">
            <ToolButton 
              active={mode === 'normal'} 
              onClick={() => setMode('normal')}
              icon={<CheckCircle2 size={18} />}
              label="填数"
            />
            <ToolButton 
              active={mode === 'draft'} 
              onClick={() => setMode('draft')}
              icon={<Pencil size={18} />}
              label="草稿"
            />
            <div className="w-[1px] h-6 bg-black/5" />
            <ToolButton 
              active={mode === 'chain'} 
              onClick={() => setMode('chain')}
              icon={<Link2 size={18} />}
              label="推理链"
            />
          </div>

          <div className="bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl shadow-xl border border-black/5 flex items-center gap-1">
            <ToolButton 
              onClick={handleHintRequest}
              icon={isHintLoading ? <div className="animate-spin"><RotateCcw size={18} /></div> : <Lightbulb size={18} />}
              label="提示"
            />
            <ToolButton 
              onClick={exportBoard}
              icon={<Download size={18} />}
              label="导出"
            />
            <div className="relative">
              <ToolButton 
                onClick={() => setShowDifficultyMenu(!showDifficultyMenu)}
                icon={<Settings2 size={18} />}
                label="新游戏"
              />
              <AnimatePresence>
                {showDifficultyMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-2xl border border-black/5 p-2 min-w-[100px] z-[60]"
                  >
                    {(['Advanced', 'Expert', 'Hell'] as Difficulty[]).map(d => (
                      <button
                        key={d}
                        onClick={() => startNewGame(d)}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-emerald-50 rounded-lg transition-colors"
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

        {mode === 'chain' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 bg-white/90 backdrop-blur-xl p-1.5 rounded-xl shadow-lg border border-black/5"
          >
            <button
              onClick={() => setChainType('strong')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                chainType === 'strong' ? "bg-emerald-500 text-white" : "bg-black/5 text-black/40"
              )}
            >
              强链
            </button>
            <button
              onClick={() => setChainType('weak')}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                chainType === 'weak' ? "bg-red-500 text-white" : "bg-black/5 text-black/40"
              )}
            >
              弱链
            </button>
            <button
              onClick={undoChain}
              className="p-1.5 rounded-lg bg-black/5 text-black/40 hover:bg-black/10"
            >
              <RotateCcw size={14} />
            </button>
          </motion.div>
        )}
      </div>

      {/* Main Board Area */}
      <main className="pt-48 pb-12 px-2 flex flex-col items-center justify-start min-h-screen overflow-x-hidden">
        <div className="relative w-full max-w-[500px] flex flex-col items-center">
          {/* SVG Overlay for Chains */}
          <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full">
            <defs>
              <marker
                id="arrowhead-strong"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
              </marker>
              <marker
                id="arrowhead-weak"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>
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
                  markerEnd={`url(#arrowhead-${chain.type})`}
                  className="opacity-80"
                />
              );
            })}
          </svg>

          {/* Sudoku Grid */}
          <div 
            ref={boardRef}
            className="grid grid-cols-9 border-[1.5px] border-black bg-white shadow-2xl rounded-sm overflow-hidden w-full aspect-square"
          >
            {gameState.grid.map((row, ri) => (
              row.map((val, ci) => {
                const isInitial = gameState.initialGrid[ri][ci] !== null;
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                const isChainStart = chainStart?.row === ri && chainStart?.col === ci;
                const isHinted = hint?.cells.some(([r, c]) => r === ri && c === ci);
                
                // Highlight logic
                let isHighlighted = false;
                if (selectedCell) {
                  const selectedVal = gameState.grid[selectedCell.row][selectedCell.col];
                  
                  const isInSameBox = (r1: number, c1: number, r2: number, c2: number) => {
                    return Math.floor(r1 / 3) === Math.floor(r2 / 3) && 
                           Math.floor(c1 / 3) === Math.floor(c2 / 3);
                  };

                  if (selectedVal !== null) {
                    // Find all cells with the same value
                    for (let r = 0; r < 9; r++) {
                      for (let c = 0; c < 9; c++) {
                        if (gameState.grid[r][c] === selectedVal) {
                          if (ri === r || ci === c || isInSameBox(ri, ci, r, c)) {
                            isHighlighted = true;
                            break;
                          }
                        }
                      }
                      if (isHighlighted) break;
                    }
                  } else {
                    // If empty cell selected, highlight its row, column, and box
                    isHighlighted = ri === selectedCell.row || 
                                    ci === selectedCell.col || 
                                    isInSameBox(ri, ci, selectedCell.row, selectedCell.col);
                  }
                }

                return (
                  <div
                    key={`${ri}-${ci}`}
                    onClick={() => handleCellClick(ri, ci)}
                    className={cn(
                      "relative flex items-center justify-center text-2xl sm:text-3xl cursor-pointer transition-all duration-200 border-[0.5px] border-black/10 aspect-square",
                      (ci + 1) % 3 === 0 && ci !== 8 && "border-r-[1.5px] border-r-black",
                      (ri + 1) % 3 === 0 && ri !== 8 && "border-b-[1.5px] border-b-black",
                      isSelected && "bg-emerald-100 z-10 scale-[1.02] shadow-lg",
                      !isSelected && isHighlighted && "bg-blue-50/80",
                      isChainStart && "ring-2 ring-inset ring-emerald-400 bg-emerald-50/50",
                      !isSelected && !isHighlighted && !isChainStart && "hover:bg-black/5",
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
                      <div className="grid grid-cols-3 gap-[1px] w-full h-full p-[1px] sm:p-[2px]">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-center text-[9px] sm:text-[11px] text-black/30 leading-none font-mono">
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

          {/* 数字选择器弹窗 */}
          <AnimatePresence>
            {selectedCell && !showCandidatePicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-[-12px] translate-y-full z-50 bg-white/95 backdrop-blur-xl p-4 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] border border-black/5 flex flex-col gap-3 w-max"
              >
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumberSelect(num)}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-emerald-500 hover:text-white transition-all duration-200 font-bold text-lg border border-black/5 shadow-sm active:scale-90"
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handleNumberSelect(num)}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white hover:bg-emerald-500 hover:text-white transition-all duration-200 font-bold text-lg border border-black/5 shadow-sm active:scale-90"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => handleNumberSelect(null)}
                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-100 shadow-sm active:scale-90"
                    title="擦除"
                  >
                    <Eraser size={20} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 候选数放大镜 (推理链模式) */}
          <AnimatePresence>
            {showCandidatePicker && selectedCell && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-[-16px] translate-y-full z-[60] bg-white/95 backdrop-blur-xl p-6 rounded-[3rem] shadow-[0_30px_80px_rgba(0,0,0,0.2)] border border-black/10 w-max"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-black/40">
                    {chainStart ? "选择链尾候选数" : "选择链首候选数"}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
                      const isAvailable = gameState.notes[selectedCell.row][selectedCell.col][num];
                      const isStart = chainStart && chainStart.row === selectedCell.row && chainStart.col === selectedCell.col && chainStart.num === num;
                      
                      return (
                        <button
                          key={num}
                          disabled={!isAvailable}
                          onClick={() => handleCandidateSelect(num)}
                          className={cn(
                            "w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200 font-bold text-xl border shadow-sm active:scale-90",
                            isAvailable 
                              ? isStart 
                                ? "bg-emerald-500 text-white border-emerald-600" 
                                : "bg-white text-black hover:bg-black hover:text-white border-black/5"
                              : "bg-black/5 text-black/10 border-transparent cursor-not-allowed"
                          )}
                        >
                          {isAvailable ? num : ''}
                        </button>
                      );
                    })}
                  </div>
                  <button 
                    onClick={() => {
                      setShowCandidatePicker(false);
                      setSelectedCell(null);
                    }}
                    className="mt-2 text-[10px] uppercase font-bold text-black/40 hover:text-black transition-colors"
                  >
                    取消
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
        "flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl transition-all duration-300",
        active ? "bg-black text-white shadow-lg" : "text-black/40 hover:bg-black/5 hover:text-black"
      )}
    >
      {icon}
      <span className="text-[7px] sm:text-[8px] uppercase font-bold mt-1 tracking-tighter">{label}</span>
    </button>
  );
}
