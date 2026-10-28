import { createContext } from 'react'

import type { CategoryInput, EntryInput, PomodoroMode, RecordId, StudyData, TopicInput } from '@/lib/study-data'
import type { ContextualImportMode, StudyExportDocument, StudyImportResult } from '@/lib/study-backup'
import type { StudySettingsPatch } from '@/lib/study-operations'

export type StorageNotice = {
  kind: 'warning' | 'error'
  message: string
}

export type StudyContextValue = {
  data: StudyData
  storageNotice: StorageNotice | null
  clearStorageNotice: () => void
  createCategory: (input: CategoryInput) => boolean
  updateCategory: (categoryId: RecordId, input: CategoryInput) => boolean
  deleteCategory: (categoryId: RecordId) => boolean
  deleteCategories: (categoryIds: RecordId[]) => boolean
  createTopic: (categoryId: RecordId, input: TopicInput) => boolean
  updateTopic: (topicId: RecordId, input: TopicInput) => boolean
  deleteTopic: (topicId: RecordId) => boolean
  deleteTopics: (topicIds: RecordId[]) => boolean
  createEntry: (topicId: RecordId, input: EntryInput) => boolean
  updateEntry: (entryId: RecordId, input: EntryInput) => boolean
  deleteEntry: (entryId: RecordId) => boolean
  deleteEntries: (entryIds: RecordId[]) => boolean
  openCategory: (categoryId: RecordId) => boolean
  openTopic: (topicId: RecordId) => boolean
  updateSettings: (patch: StudySettingsPatch) => boolean
  importTopic: (topicId: RecordId, document: StudyExportDocument, mode: ContextualImportMode) => StudyImportResult
  importCategory: (categoryId: RecordId, document: StudyExportDocument, mode: ContextualImportMode) => StudyImportResult
  restoreFullBackup: (document: StudyExportDocument) => StudyImportResult
  selectPomodoroMode: (mode: PomodoroMode) => boolean
  abandonPomodoroSession: (mode: PomodoroMode) => boolean
  startPomodoro: () => boolean
  pausePomodoro: () => boolean
  resumePomodoro: () => boolean
  snoozePomodoro: (durationMinutes: number) => boolean
  resetPomodoro: () => boolean
  completePomodoroSession: (mode: PomodoroMode, durationMinutes: number) => boolean
  adjustPomodoroDuration: (durationMinutes: number) => boolean
}

export const StudyContext = createContext<StudyContextValue | null>(null)
