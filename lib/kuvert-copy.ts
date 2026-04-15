const COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Du er i Nuvio Flow/g, 'Du har styr på udgifterne'],
  [/Nuvio Flow Score/g, 'Din Score'],
  [/Flow Score/g, 'Din Score'],
  [/flow-score/g, 'score'],
  [/Flow-budget/g, 'kuvertbudget'],
  [/flow-budget/g, 'kuvertbudget'],
  [/Nuvio Flow/g, 'Udgifter'],
  [/Nuvio Score/g, 'Din Score'],
  [/Nuvio/g, 'Kuvert'],
];

export function toKuvertCopy(value: string): string {
  return COPY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}
