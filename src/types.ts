export type Difficulty = 'Advanced' | 'Expert' | 'Hell';

export interface Chain {
  id: string;
  start: { row: number; col: number; num?: number };
  end: { row: number; col: number; num?: number };
  type: 'strong' | 'weak';
}

export interface GameState {
  grid: (number | null)[][];
  initialGrid: (number | null)[][];
  solution: number[][];
  notes: boolean[][][]; // [row][col][number 1-9]
  chains: Chain[];
  difficulty: Difficulty;
  time: number;
  hintsUsed: number;
  status: 'playing' | 'won' | 'paused';
}
