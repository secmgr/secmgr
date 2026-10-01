export const n = (count: number, word: string, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;

export const list = (items: string[], max = 3) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} and ${items.length - max} more`;
