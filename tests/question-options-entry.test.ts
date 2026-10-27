import { expect, test } from 'bun:test'

import { createEmptyStudyData, createEntryRecord } from '../src/lib/study-data'
import { validateStudyData } from '../src/lib/study-validation'

function createQuestionOptionsData(options = [
  { text: 'First answer', isCorrect: false },
  { text: 'Second answer', isCorrect: true },
]) {
  const data = createEmptyStudyData()
  data.categories.push({
    id: 'category-1',
    name: 'Category',
    description: '',
    createdAt: 1,
    updatedAt: 1,
    lastAccessedAt: null,
  })
  data.topics.push({
    id: 'topic-1',
    categoryId: 'category-1',
    name: 'Topic',
    description: '',
    createdAt: 1,
    updatedAt: 1,
    lastAccessedAt: null,
  })
  data.entries.push(createEntryRecord('topic-1', {
    type: 'question-options',
    question: 'Which answers are correct?',
    answer: '',
    options,
    explanation: 'Choose every correct answer.',
  }, 1, 'entry-1'))
  return data
}

test('Question & Options entries validate with multiple correct options and an explanation', () => {
  const data = createQuestionOptionsData([
    { text: 'First answer', isCorrect: true },
    { text: 'Second answer', isCorrect: true },
    { text: 'Third answer', isCorrect: false },
  ])

  expect(validateStudyData(data)).toMatchObject({ ok: true })
})

test('Question & Options entries require non-empty options and at least one correct option', () => {
  const data = createQuestionOptionsData([
    { text: 'First answer', isCorrect: false },
    { text: '   ', isCorrect: false },
  ])

  const validation = validateStudyData(data)

  expect(validation.ok).toBe(false)
  if (validation.ok) return
  expect(validation.issues.some((issue) => issue.path === 'entries[0].options[1]')).toBe(true)
  expect(validation.issues.some((issue) => issue.path === 'entries[0].options')).toBe(true)
})

test('legacy Question & Answer entries remain valid without Question & Options fields', () => {
  const data = createEmptyStudyData()
  data.categories.push({
    id: 'category-1',
    name: 'Category',
    description: '',
    createdAt: 1,
    updatedAt: 1,
    lastAccessedAt: null,
  })
  data.topics.push({
    id: 'topic-1',
    categoryId: 'category-1',
    name: 'Topic',
    description: '',
    createdAt: 1,
    updatedAt: 1,
    lastAccessedAt: null,
  })
  data.entries.push({
    id: 'entry-1',
    topicId: 'topic-1',
    type: 'question-answer',
    question: 'What is the answer?',
    answer: 'This is the answer.',
    createdAt: 1,
    updatedAt: 1,
  })

  expect(validateStudyData(data)).toMatchObject({ ok: true })
})
