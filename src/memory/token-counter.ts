export interface TokenCounter {
  count(text: string): number;
}

export class WordCountHeuristic implements TokenCounter {
  private readonly multiplier: number;

  constructor(multiplier = 1.4) {
    this.multiplier = multiplier;
  }

  count(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(words * this.multiplier);
  }
}

export const defaultTokenCounter = new WordCountHeuristic();
