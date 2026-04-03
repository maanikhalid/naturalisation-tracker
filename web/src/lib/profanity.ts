const blockedTerms = [
  "spamword1",
  "spamword2",
  "offensive1",
  "offensive2",
];

export function hasBlockedWord(value: string): boolean {
  const normalized = value.toLowerCase();
  return blockedTerms.some((term) => normalized.includes(term));
}
