import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("GEMINI_API_KEY is not configured. Please add it to your environment variables.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function getSudokuHint(grid: (number | null)[][], difficulty: string) {
  const ai = getAI();
  const prompt = `
    You are a Sudoku expert. Given the current 9x9 grid (0 for empty):
    ${JSON.stringify(grid)}
    Difficulty: ${difficulty}
    
    Provide a logical hint. If it's a "Hell" difficulty, look for advanced chains (X-Wing, Swordfish, XY-Wing, or AIC).
    Return a JSON object:
    {
      "type": "logic", 
      "message": "Explanation of the hint",
      "highlightCells": [[r, c], ...],
      "highlightNumbers": [n],
      "action": { "row": r, "col": c, "value": v }
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
}
