import type { EntryOption } from './study-data'

export function isExactQuestionOptionsSelection(options: readonly EntryOption[], selectedIndexes: Iterable<number>) {
  const selected = new Set(selectedIndexes)
  const correctCount = options.filter((option) => option.isCorrect).length

  return selected.size === correctCount && options.every((option, index) => option.isCorrect === selected.has(index))
}
