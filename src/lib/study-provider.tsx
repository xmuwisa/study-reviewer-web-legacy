import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { CategoryInput, EntryInput, PomodoroMode, RecordId, StudyData, TopicInput } from '@/lib/study-data'
import { importCategoryExport, importTopicExport, restoreFullBackup, type ContextualImportMode, type StudyExportDocument, type StudyImportResult } from '@/lib/study-backup'
import {
  createCategory,
  createEntry,
  createTopic,
  deleteCategory,
  deleteCategories,
  deleteEntry,
  deleteEntries,
  deleteTopic,
  deleteTopics,
  markCategoryAccessed,
  markTopicAccessed,
  updateCategory,
  updateEntry,
  updateTopic,
  updateSettings,
} from '@/lib/study-operations'
import { StudyContext, type StorageNotice, type StudyContextValue } from '@/lib/study-context'
import { createStudyRepository } from '@/lib/study-storage'
import {
  abandonPomodoroSession,
  adjustPomodoroDuration,
  completePomodoroSession,
  pausePomodoro,
  reconcilePomodoro,
  resetPomodoro,
  resumePomodoro,
  snoozePomodoro,
  selectPomodoroMode,
  startPomodoro,
} from '@/lib/pomodoro'

function getInitialNotice(status: ReturnType<ReturnType<typeof createStudyRepository>['load']>['status'], message?: string) {
  if (status === 'invalid' || status === 'unavailable') {
    return { kind: 'warning' as const, message: message ?? 'Local study data could not be loaded.' }
  }

  return null
}

export function StudyProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => createStudyRepository(), [])
  const [initialLoad] = useState(() => repository.load())
  const [data, setData] = useState(initialLoad.data)
  const [storageNotice, setStorageNotice] = useState<StorageNotice | null>(() =>
    getInitialNotice(initialLoad.status, 'message' in initialLoad ? initialLoad.message : undefined),
  )

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const isDark = data.settings.theme === 'dark' || (data.settings.theme === 'system' && mediaQuery.matches)
      root.classList.toggle('dark', isDark)
      root.style.colorScheme = isDark ? 'dark' : 'light'
    }

    applyTheme()
    if (data.settings.theme !== 'system') return

    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [data.settings.theme])

  const commit = useCallback(
    (nextData: StudyData) => {
      const result = repository.save(nextData)
      if (!result.ok) {
        setStorageNotice({ kind: 'error', message: result.message })
        return false
      }

      setData(nextData)
      setStorageNotice(null)
      return true
    },
    [repository],
  )

  const commitImport = useCallback((result: StudyImportResult): StudyImportResult => {
    if (!result.ok) return result

    const saveResult = repository.save(result.data)
    if (!saveResult.ok) {
      setStorageNotice({ kind: 'error', message: saveResult.message })
      return { ok: false, message: saveResult.message, issues: saveResult.issues }
    }

    setData(result.data)
    setStorageNotice(null)
    return result
  }, [repository])

  const createCategoryAction = useCallback((input: CategoryInput) => commit(createCategory(data, input)), [commit, data])
  const updateCategoryAction = useCallback(
    (categoryId: RecordId, input: CategoryInput) => commit(updateCategory(data, categoryId, input)),
    [commit, data],
  )
  const deleteCategoryAction = useCallback((categoryId: RecordId) => commit(deleteCategory(data, categoryId)), [commit, data])
  const deleteCategoriesAction = useCallback((categoryIds: RecordId[]) => commit(deleteCategories(data, categoryIds)), [commit, data])
  const createTopicAction = useCallback(
    (categoryId: RecordId, input: TopicInput) => commit(createTopic(data, categoryId, input)),
    [commit, data],
  )
  const updateTopicAction = useCallback(
    (topicId: RecordId, input: TopicInput) => commit(updateTopic(data, topicId, input)),
    [commit, data],
  )
  const deleteTopicAction = useCallback((topicId: RecordId) => commit(deleteTopic(data, topicId)), [commit, data])
  const deleteTopicsAction = useCallback((topicIds: RecordId[]) => commit(deleteTopics(data, topicIds)), [commit, data])
  const createEntryAction = useCallback(
    (topicId: RecordId, input: EntryInput) => commit(createEntry(data, topicId, input)),
    [commit, data],
  )
  const updateEntryAction = useCallback(
    (entryId: RecordId, input: EntryInput) => commit(updateEntry(data, entryId, input)),
    [commit, data],
  )
  const deleteEntryAction = useCallback((entryId: RecordId) => commit(deleteEntry(data, entryId)), [commit, data])
  const deleteEntriesAction = useCallback((entryIds: RecordId[]) => commit(deleteEntries(data, entryIds)), [commit, data])
  const openCategory = useCallback((categoryId: RecordId) => commit(markCategoryAccessed(data, categoryId)), [commit, data])
  const openTopic = useCallback((topicId: RecordId) => commit(markTopicAccessed(data, topicId)), [commit, data])
  const updateSettingsAction = useCallback((patch: Parameters<typeof updateSettings>[1]) => commit(updateSettings(data, patch)), [commit, data])
  const importTopicAction = useCallback(
    (topicId: RecordId, document: StudyExportDocument, mode: ContextualImportMode) => commitImport(importTopicExport(data, topicId, document, mode)),
    [commitImport, data],
  )
  const importCategoryAction = useCallback(
    (categoryId: RecordId, document: StudyExportDocument, mode: ContextualImportMode) => commitImport(importCategoryExport(data, categoryId, document, mode)),
    [commitImport, data],
  )
  const restoreFullBackupAction = useCallback(
    (document: StudyExportDocument) => commitImport(restoreFullBackup(document)),
    [commitImport],
  )
  const selectPomodoroModeAction = useCallback((mode: PomodoroMode) => commit(selectPomodoroMode(data, mode)), [commit, data])
  const abandonPomodoroSessionAction = useCallback((mode: PomodoroMode) => commit(abandonPomodoroSession(data, mode)), [commit, data])
  const startPomodoroAction = useCallback(() => commit(startPomodoro(data, Date.now())), [commit, data])
  const pausePomodoroAction = useCallback(() => commit(pausePomodoro(data, Date.now())), [commit, data])
  const resumePomodoroAction = useCallback(() => commit(resumePomodoro(data, Date.now())), [commit, data])
  const snoozePomodoroAction = useCallback((durationMinutes: number) => commit(snoozePomodoro(data, durationMinutes, Date.now())), [commit, data])
  const resetPomodoroAction = useCallback(() => commit(resetPomodoro(data)), [commit, data])
  const completePomodoroSessionAction = useCallback((mode: PomodoroMode, durationMinutes: number) => commit(completePomodoroSession(data, mode, durationMinutes, Date.now())), [commit, data])
  const adjustPomodoroDurationAction = useCallback((durationMinutes: number) => commit(adjustPomodoroDuration(data, durationMinutes)), [commit, data])
  const clearStorageNotice = useCallback(() => setStorageNotice(null), [])

  useEffect(() => {
    const reconcile = () => {
      const nextData = reconcilePomodoro(data, Date.now())
      if (nextData !== data) commit(nextData)
    }

    reconcile()
    const session = data.timer.activeSession
    if (!session || session.status !== 'running') return

    const intervalId = window.setInterval(reconcile, 1000)
    window.addEventListener('focus', reconcile)
    document.addEventListener('visibilitychange', reconcile)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', reconcile)
      document.removeEventListener('visibilitychange', reconcile)
    }
  }, [commit, data])

  const value = useMemo<StudyContextValue>(
    () => ({
      data,
      storageNotice,
      clearStorageNotice,
      createCategory: createCategoryAction,
      updateCategory: updateCategoryAction,
      deleteCategory: deleteCategoryAction,
      deleteCategories: deleteCategoriesAction,
      createTopic: createTopicAction,
      updateTopic: updateTopicAction,
      deleteTopic: deleteTopicAction,
      deleteTopics: deleteTopicsAction,
      createEntry: createEntryAction,
      updateEntry: updateEntryAction,
      deleteEntry: deleteEntryAction,
      deleteEntries: deleteEntriesAction,
      openCategory,
      openTopic,
      updateSettings: updateSettingsAction,
      importTopic: importTopicAction,
      importCategory: importCategoryAction,
      restoreFullBackup: restoreFullBackupAction,
      selectPomodoroMode: selectPomodoroModeAction,
      abandonPomodoroSession: abandonPomodoroSessionAction,
      startPomodoro: startPomodoroAction,
      pausePomodoro: pausePomodoroAction,
      resumePomodoro: resumePomodoroAction,
      snoozePomodoro: snoozePomodoroAction,
      resetPomodoro: resetPomodoroAction,
      completePomodoroSession: completePomodoroSessionAction,
      adjustPomodoroDuration: adjustPomodoroDurationAction,
    }),
    [
      clearStorageNotice,
      createCategoryAction,
      createEntryAction,
      data,
      deleteCategoryAction,
      deleteCategoriesAction,
      deleteEntryAction,
      deleteEntriesAction,
      deleteTopicAction,
      deleteTopicsAction,
      openCategory,
      openTopic,
      storageNotice,
      selectPomodoroModeAction,
      abandonPomodoroSessionAction,
      startPomodoroAction,
      pausePomodoroAction,
      resumePomodoroAction,
      snoozePomodoroAction,
      resetPomodoroAction,
      completePomodoroSessionAction,
      adjustPomodoroDurationAction,
      updateCategoryAction,
      updateEntryAction,
      updateTopicAction,
      createTopicAction,
      updateSettingsAction,
      importTopicAction,
      importCategoryAction,
      restoreFullBackupAction,
    ],
  )

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}
