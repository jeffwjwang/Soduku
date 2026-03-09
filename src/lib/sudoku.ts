import { Difficulty } from '../types';

export class SudokuLogic {
  static generate(difficulty: Difficulty): { grid: (number | null)[][], solution: number[][] } {
    const solution = this.generateFullGrid();
    const grid = solution.map(row => [...row]);
    
    let attempts = 0;
    let cellsToRemove = 0;
    
    switch (difficulty) {
      case 'Advanced': cellsToRemove = 45; break;
      case 'Expert': cellsToRemove = 55; break;
      case 'Hell': cellsToRemove = 62; break;
    }

    while (attempts < cellsToRemove) {
      const row = Math.floor(Math.random() * 9);
      const col = Math.floor(Math.random() * 9);
      if (grid[row][col] !== null) {
        grid[row][col] = null;
        attempts++;
      }
    }

    return { grid, solution };
  }

  private static generateFullGrid(): number[][] {
    const grid = Array(9).fill(null).map(() => Array(9).fill(0));
    this.fillGrid(grid);
    return grid;
  }

  private static fillGrid(grid: number[][]): boolean {
    for (let i = 0; i < 81; i++) {
      const row = Math.floor(i / 9);
      const col = i % 9;
      if (grid[row][col] === 0) {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
        for (const num of numbers) {
          if (this.isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (this.fillGrid(grid)) return true;
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }

  static isValid(grid: (number | null)[][], row: number, col: number, num: number): boolean {
    for (let x = 0; x < 9; x++) if (grid[row][x] === num) return false;
    for (let x = 0; x < 9; x++) if (grid[x][col] === num) return false;
    const startRow = row - row % 3, startCol = col - col % 3;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        if (grid[i + startRow][j + startCol] === num) return false;
    return true;
  }
}
