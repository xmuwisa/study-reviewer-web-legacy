import {
  createCategoryRecord,
  createEntryRecord,
  createTopicRecord,
  type Category,
  type CategoryInput,
  type Entry,
  type EntryOption,
  type EntryInput,
  type EntryType,
  type FlashcardFrontSide,
  type RecordId,
  type StudyData,
  type StudySettings,
  type Timestamp,
  type Topic,
  type TopicInput,
} from '@/lib/study-data'

export type CategorySort = 'alphabetical' | 'reverse-alphabetical' | 'recent'
export type TopicSort = 'alphabetical' | 'reverse-alphabetical' | 'recent'
export type EntrySort = 'newest' | 'oldest' | 'alphabetical'

export type StudySettingsPatch = Partial<Omit<StudySettings, 'flashcardFrontByEntryType' | 'pomodoro'>> & {
  flashcardFrontByEntryType?: Partial<Record<Exclude<EntryType, 'question-options' | 'question-code'>, FlashcardFrontSide>>
  pomodoro?: Partial<StudySettings['pomodoro']>
}

const MAX_RECENT_ACTIVITY = 20

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase()
}

function compareAlphabetically(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}

function getRecentTimestamp(record: Category | Topic) {
  return record.lastAccessedAt ?? record.updatedAt ?? record.createdAt
}

function sortByRecent<T extends Category | Topic>(records: T[]) {
  return [...records].sort((left, right) => {
    const timestampDifference = getRecentTimestamp(right) - getRecentTimestamp(left)
    return timestampDifference || compareAlphabetically(left.name, right.name) || left.id.localeCompare(right.id)
  })
}

function sortByName<T extends Category | Topic>(records: T[], direction: 'ascending' | 'descending') {
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...records].sort((left, right) => multiplier * (compareAlphabetically(left.name, right.name) || left.id.localeCompare(right.id)))
}

function removeRecentActivity(data: StudyData, removedIds: Set<RecordId>) {
  return data.activity.recentlyAccessed.filter((activity) => !removedIds.has(activity.recordId))
}

function updateRecentActivity(data: StudyData, type: 'category' | 'topic', recordId: RecordId, accessedAt: Timestamp) {
  const nextActivity = [{ type, recordId, accessedAt }, ...data.activity.recentlyAccessed.filter((item) => item.recordId !== recordId)]
  return nextActivity.slice(0, MAX_RECENT_ACTIVITY)
}

export function createCategory(data: StudyData, input: CategoryInput, now = Date.now()): StudyData {
  const record = createCategoryRecord(input, now)
  if (!record.name) return data

  return { ...data, categories: [...data.categories, record] }
}

export function updateCategory(data: StudyData, categoryId: RecordId, input: CategoryInput, now = Date.now()): StudyData {
  const name = input.name.trim()
  if (!name || !data.categories.some((category) => category.id === categoryId)) return data

  return {
    ...data,
    categories: data.categories.map((category) =>
      category.id === categoryId
        ? { ...category, name, description: input.description?.trim() ?? '', updatedAt: now }
        : category,
    ),
  }
}

export function deleteCategories(data: StudyData, categoryIds: RecordId[]): StudyData {
  const categoryIdsToDelete = new Set(categoryIds.filter((categoryId) => data.categories.some((category) => category.id === categoryId)))
  if (categoryIdsToDelete.size === 0) return data

  const topicIds = new Set(data.topics.filter((topic) => categoryIdsToDelete.has(topic.categoryId)).map((topic) => topic.id))
  const removedIds = new Set([...categoryIdsToDelete, ...topicIds])

  return {
    ...data,
    categories: data.categories.filter((category) => !categoryIdsToDelete.has(category.id)),
    topics: data.topics.filter((topic) => !categoryIdsToDelete.has(topic.categoryId)),
    entries: data.entries.filter((entry) => !topicIds.has(entry.topicId)),
    activity: {
      ...data.activity,
      recentlyAccessed: removeRecentActivity(data, removedIds),
    },
  }
}

export function deleteCategory(data: StudyData, categoryId: RecordId): StudyData {
  return deleteCategories(data, [categoryId])
}

export function createTopic(data: StudyData, categoryId: RecordId, input: TopicInput, now = Date.now()): StudyData {
  const record = createTopicRecord(categoryId, input, now)
  if (!record.name || !data.categories.some((category) => category.id === categoryId)) return data

  return { ...data, topics: [...data.topics, record] }
}

export function updateTopic(data: StudyData, topicId: RecordId, input: TopicInput, now = Date.now()): StudyData {
  const name = input.name.trim()
  if (!name || !data.topics.some((topic) => topic.id === topicId)) return data

  return {
    ...data,
    topics: data.topics.map((topic) =>
      topic.id === topicId ? { ...topic, name, description: input.description?.trim() ?? '', updatedAt: now } : topic,
    ),
  }
}

export function deleteTopics(data: StudyData, topicIds: RecordId[]): StudyData {
  const topicIdsToDelete = new Set(topicIds.filter((topicId) => data.topics.some((topic) => topic.id === topicId)))
  if (topicIdsToDelete.size === 0) return data

  return {
    ...data,
    topics: data.topics.filter((topic) => !topicIdsToDelete.has(topic.id)),
    entries: data.entries.filter((entry) => !topicIdsToDelete.has(entry.topicId)),
    activity: {
      ...data.activity,
      recentlyAccessed: removeRecentActivity(data, topicIdsToDelete),
    },
  }
}

export function deleteTopic(data: StudyData, topicId: RecordId): StudyData {
  return deleteTopics(data, [topicId])
}

export function createEntry(data: StudyData, topicId: RecordId, input: EntryInput, now = Date.now()): StudyData {
  const record = createEntryRecord(topicId, input, now)
  if (!record.question || !data.topics.some((topic) => topic.id === topicId)) return data
  if (record.type === 'question-options' ? !hasValidQuestionOptions(record.options) : !record.answer) return data

  return { ...data, entries: [...data.entries, record] }
}

export function updateEntry(data: StudyData, entryId: RecordId, input: EntryInput, now = Date.now()): StudyData {
  const question = input.question.trim()
  const type = input.type ?? data.entries.find((entry) => entry.id === entryId)?.type
  const answer = type === 'question-options' ? '' : type === 'question-code' ? input.answer : input.answer.trim()
  const options = type === 'question-options' ? normalizeQuestionOptions(input.options) : undefined
  const explanation = type === 'question-options' || type === 'question-code' ? input.explanation?.trim() ?? '' : undefined
  if (!question || !data.entries.some((entry) => entry.id === entryId)) return data
  if (type === 'question-options' ? !hasValidQuestionOptions(options) : !answer) return data

  return {
    ...data,
    entries: data.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            type: type ?? entry.type,
            question,
            answer,
            ...(type === 'question-options' ? { options, explanation } : { options: undefined, explanation: type === 'question-code' ? explanation : undefined }),
            updatedAt: now,
          }
        : entry,
    ),
  }
}

function normalizeQuestionOptions(options: EntryOption[] | undefined) {
  return options?.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect }))
}

function hasValidQuestionOptions(options: EntryOption[] | undefined): options is EntryOption[] {
  return Boolean(
    options &&
      options.length >= 2 &&
      options.length <= 6 &&
      options.every((option) => option.text.length > 0) &&
      options.some((option) => option.isCorrect),
  )
}

export function deleteEntries(data: StudyData, entryIds: RecordId[]): StudyData {
  const ids = new Set(entryIds)
  if (ids.size === 0) return data

  const entries = data.entries.filter((entry) => !ids.has(entry.id))
  return entries.length === data.entries.length ? data : { ...data, entries }
}

export function deleteEntry(data: StudyData, entryId: RecordId): StudyData {
  return deleteEntries(data, [entryId])
}

export function markCategoryAccessed(data: StudyData, categoryId: RecordId, accessedAt = Date.now()): StudyData {
  if (!data.categories.some((category) => category.id === categoryId)) return data

  return {
    ...data,
    categories: data.categories.map((category) =>
      category.id === categoryId ? { ...category, lastAccessedAt: accessedAt } : category,
    ),
    activity: {
      ...data.activity,
      recentlyAccessed: updateRecentActivity(data, 'category', categoryId, accessedAt),
    },
  }
}

export function markTopicAccessed(data: StudyData, topicId: RecordId, accessedAt = Date.now()): StudyData {
  if (!data.topics.some((topic) => topic.id === topicId)) return data

  return {
    ...data,
    topics: data.topics.map((topic) => (topic.id === topicId ? { ...topic, lastAccessedAt: accessedAt } : topic)),
    activity: {
      ...data.activity,
      recentlyAccessed: updateRecentActivity(data, 'topic', topicId, accessedAt),
    },
  }
}

export function updateSettings(data: StudyData, patch: StudySettingsPatch): StudyData {
  return {
    ...data,
    settings: {
      ...data.settings,
      ...patch,
      flashcardFrontByEntryType: {
        ...data.settings.flashcardFrontByEntryType,
        ...patch.flashcardFrontByEntryType,
      },
      pomodoro: {
        ...data.settings.pomodoro,
        ...patch.pomodoro,
      },
    },
  }
}

export function filterAndSortCategories(data: StudyData, searchTerm: string, sort: CategorySort): Category[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm)
  const filtered = data.categories.filter((category) => category.name.toLocaleLowerCase().includes(normalizedTerm))

  if (sort === 'recent') return sortByRecent(filtered)

  return sortByName(filtered, sort === 'reverse-alphabetical' ? 'descending' : 'ascending')
}

export function filterAndSortTopics(data: StudyData, categoryId: RecordId, searchTerm: string, sort: TopicSort): Topic[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm)
  const filtered = data.topics.filter(
    (topic) => topic.categoryId === categoryId && topic.name.toLocaleLowerCase().includes(normalizedTerm),
  )

  if (sort === 'recent') return sortByRecent(filtered)

  return sortByName(filtered, sort === 'reverse-alphabetical' ? 'descending' : 'ascending')
}

export function filterAndSortEntries(data: StudyData, topicId: RecordId, searchTerm: string, sort: EntrySort): Entry[] {
  const normalizedTerm = normalizeSearchTerm(searchTerm)
  const filtered = data.entries.filter((entry) =>
    entry.topicId === topicId &&
    `${entry.question} ${entry.answer}`.toLocaleLowerCase().includes(normalizedTerm),
  )

  if (sort === 'alphabetical') {
    return [...filtered].sort((left, right) => compareAlphabetically(left.question, right.question) || left.id.localeCompare(right.id))
  }

  return [...filtered].sort((left, right) => {
    const timestampDifference = (sort === 'newest' ? right.createdAt - left.createdAt : left.createdAt - right.createdAt)
    return timestampDifference || compareAlphabetically(left.question, right.question) || left.id.localeCompare(right.id)
  })
}
