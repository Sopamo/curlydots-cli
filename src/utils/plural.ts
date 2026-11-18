export function plural(count: number, word: string): string {
  if (count === 1) {
    return word;
  }

  if (/[sxz]$/i.test(word) || /[cs]h$/i.test(word)) {
    return `${word}es`;
  }

  if (/[^aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}
