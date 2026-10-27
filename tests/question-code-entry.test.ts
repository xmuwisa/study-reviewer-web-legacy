import { expect, test } from 'bun:test'

import { createEmptyStudyData, createEntryRecord } from '../src/lib/study-data'
import { validateStudyData } from '../src/lib/study-validation'

function createData() {
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
  return data
}

test('Question & Code entries preserve code formatting in saved records', () => {
  const code = 'function greet(name) {\n  return `Hello, ${name}`\n}\n'
  const data = createData()
  data.entries.push(createEntryRecord('topic-1', {
    type: 'question-code',
    question: 'How do you greet someone?',
    answer: code,
  }, 2, 'entry-1'))

  expect(data.entries).toHaveLength(1)
  expect(data.entries[0]).toMatchObject({ type: 'question-code', answer: code })
  expect(validateStudyData(data)).toMatchObject({ ok: true })

  const updatedCode = 'const greeting = "hello"\n  console.log(greeting)\n'
  const updated = createEntryRecord('topic-1', {
    type: 'question-code',
    question: 'Show the greeting code.',
    answer: updatedCode,
  }, 3, 'entry-1')

  expect(updated).toMatchObject({ type: 'question-code', question: 'Show the greeting code.', answer: updatedCode })
})
