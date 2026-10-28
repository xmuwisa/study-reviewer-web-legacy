import type {
  PomodoroAlarmSelection,
  PomodoroAmbienceSelection,
  PomodoroSnoozeMinutes,
} from './pomodoro-audio'
import type { PomodoroPermissionSetupStatus } from './pomodoro-permissions'

export const STUDY_DATA_SCHEMA_VERSION = 2 as const
export const STUDY_DATA_STORAGE_KEY = `study-reviewer:data:v${STUDY_DATA_SCHEMA_VERSION}`
export const LEGACY_STUDY_DATA_STORAGE_KEYS = ['study-reviewer:data:v1'] as const

export type RecordId = string
export type Timestamp = number

export type ThemePreference = 'light' | 'dark' | 'system'
export type StudyMode = 'list' | 'flashcard'
export type EntryType = 'question-answer' | 'term-definition' | 'question-options' | 'question-code'
export type FlashcardEntryType = Exclude<EntryType, 'question-options' | 'question-code'>
export type FlashcardFrontSide = 'left' | 'right'
export type PomodoroMode = 'focus' | 'short-break' | 'long-break'
export type PomodoroSessionStatus = 'running' | 'paused' | 'completed' | 'reset'

export type Category = {
  id: RecordId
  name: string
  description: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastAccessedAt: Timestamp | null
}

export type Topic = {
  id: RecordId
  categoryId: RecordId
  name: string
  description: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastAccessedAt: Timestamp | null
}

export type Entry = {
  id: RecordId
  topicId: RecordId
  type: EntryType
  question: string
  answer: string
  options?: EntryOption[]
  explanation?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type EntryOption = {
  text: string
  isCorrect: boolean
}

export type PomodoroPreferences = {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
  autoStartNextSession: boolean
  ambienceMuted: boolean
  defaultAlarm: PomodoroAlarmSelection
  defaultAmbience: PomodoroAmbienceSelection
  defaultSnoozeMinutes: PomodoroSnoozeMinutes
  permissionSetupStatus: PomodoroPermissionSetupStatus
}

export type StudySettings = {
  theme: ThemePreference
  defaultStudyMode: StudyMode
  showQuestionsByDefault: boolean
  showAnswersByDefault: boolean
  allowCopyPaste: boolean
  spellcheck: boolean
  flashcardFrontByEntryType: Record<FlashcardEntryType, FlashcardFrontSide>
  pomodoro: PomodoroPreferences
}

export type RecentActivity = {
  type: 'category' | 'topic'
  recordId: RecordId
  accessedAt: Timestamp
}

export type ActivityState = {
  recentlyAccessed: RecentActivity[]
  completedFocusSessions: number
  completedFocusMinutes: number
}

export type PomodoroSession = {
  mode: PomodoroMode
  durationMinutes: number
  status: PomodoroSessionStatus
  startedAt: Timestamp
  endsAt: Timestamp | null
  pausedAt: Timestamp | null
  completedAt: Timestamp | null
}

export type TimerState = {
  selectedMode: PomodoroMode
  selectedDurationMinutes: number
  activeSession: PomodoroSession | null
  focusCycleCount: number
}

export type StudyData = {
  schemaVersion: typeof STUDY_DATA_SCHEMA_VERSION
  categories: Category[]
  topics: Topic[]
  entries: Entry[]
  settings: StudySettings
  activity: ActivityState
  timer: TimerState
}

export type CategoryInput = {
  name: string
  description?: string
}

export type TopicInput = CategoryInput

export type EntryInput = {
  type?: EntryType
  question: string
  answer: string
  options?: EntryOption[]
  explanation?: string
}

export function createStableId(): RecordId {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${randomPart}`
}

export function createDefaultSettings(): StudySettings {
  return {
    theme: 'system',
    defaultStudyMode: 'list',
    showQuestionsByDefault: true,
    showAnswersByDefault: true,
    allowCopyPaste: true,
    spellcheck: true,
    flashcardFrontByEntryType: {
      'question-answer': 'left',
      'term-definition': 'right',
    },
    pomodoro: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      autoStartNextSession: false,
      ambienceMuted: false,
      defaultAlarm: 'none',
      defaultAmbience: 'none',
      defaultSnoozeMinutes: 5,
      permissionSetupStatus: 'pending',
    },
  }
}

export function createEmptyStudyData(): StudyData {
  return {
    schemaVersion: STUDY_DATA_SCHEMA_VERSION,
    categories: [],
    topics: [],
    entries: [],
    settings: createDefaultSettings(),
    activity: {
      recentlyAccessed: [],
      completedFocusSessions: 0,
      completedFocusMinutes: 0,
    },
    timer: {
      selectedMode: 'focus',
      selectedDurationMinutes: 25,
      activeSession: null,
      focusCycleCount: 0,
    },
  }
}

export function createCategoryRecord(
  input: CategoryInput,
  now: Timestamp = Date.now(),
  id: RecordId = createStableId(),
): Category {
  return {
    id,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: null,
  }
}

export function createTopicRecord(
  categoryId: RecordId,
  input: TopicInput,
  now: Timestamp = Date.now(),
  id: RecordId = createStableId(),
): Topic {
  return {
    id,
    categoryId,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: null,
  }
}

export function createEntryRecord(
  topicId: RecordId,
  input: EntryInput,
  now: Timestamp = Date.now(),
  id: RecordId = createStableId(),
): Entry {
  const isQuestionOptions = input.type === 'question-options'
  const isQuestionCode = input.type === 'question-code'

  return {
    id,
    topicId,
    type: input.type ?? 'question-answer',
    question: input.question.trim(),
    answer: isQuestionOptions ? '' : isQuestionCode ? input.answer : input.answer.trim(),
    ...(isQuestionOptions
      ? {
          options: input.options?.map((option) => ({ text: option.text.trim(), isCorrect: option.isCorrect })),
          explanation: input.explanation?.trim() ?? '',
        }
      : isQuestionCode
        ? { explanation: input.explanation?.trim() ?? '' }
        : {}),
    createdAt: now,
    updatedAt: now,
  }
}

export function findCategory(data: StudyData, categoryId: RecordId) {
  return data.categories.find((category) => category.id === categoryId)
}

export function findTopic(data: StudyData, topicId: RecordId) {
  return data.topics.find((topic) => topic.id === topicId)
}

export function findEntry(data: StudyData, entryId: RecordId) {
  return data.entries.find((entry) => entry.id === entryId)
}

export function getTopicsForCategory(data: StudyData, categoryId: RecordId) {
  return data.topics.filter((topic) => topic.categoryId === categoryId)
}

export function getEntriesForTopic(data: StudyData, topicId: RecordId) {
  return data.entries.filter((entry) => entry.topicId === topicId)
}

export function getCategoryForTopic(data: StudyData, topicId: RecordId) {
  const topic = findTopic(data, topicId)
  return topic ? findCategory(data, topic.categoryId) : undefined
}

export function getTopicForEntry(data: StudyData, entryId: RecordId) {
  const entry = findEntry(data, entryId)
  return entry ? findTopic(data, entry.topicId) : undefined
}
