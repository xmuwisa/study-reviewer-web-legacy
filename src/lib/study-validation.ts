import {
  createDefaultSettings,
  STUDY_DATA_SCHEMA_VERSION,
  type ActivityState,
  type Category,
  type Entry,
  type EntryType,
  type FlashcardFrontSide,
  type PomodoroMode,
  type PomodoroPreferences,
  type PomodoroSession,
  type RecentActivity,
  type StudyData,
  type StudySettings,
  type TimerState,
  type Topic,
} from '@/lib/study-data'
import { POMODORO_ALARM_OPTIONS, POMODORO_AMBIENCE_OPTIONS, POMODORO_SNOOZE_OPTIONS, removeLegacyAutomaticAmbiencePreference, removeLegacySoundEnabledPreference } from '@/lib/pomodoro-audio'

export type ValidationIssue = {
  path: string
  message: string
}

export type ValidationResult =
  | { ok: true; data: StudyData }
  | { ok: false; issues: ValidationIssue[] }

export type MigrationResult =
  | { ok: true; value: unknown; version: typeof STUDY_DATA_SCHEMA_VERSION }
  | { ok: false; reason: 'invalid' | 'unsupported'; message: string }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || isTimestamp(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isPomodoroMode(value: unknown): value is PomodoroMode {
  return value === 'focus' || value === 'short-break' || value === 'long-break'
}

function isEntryType(value: unknown): value is EntryType {
  return value === 'question-answer' || value === 'term-definition'
}

function isFlashcardFrontSide(value: unknown): value is FlashcardFrontSide {
  return value === 'left' || value === 'right'
}

function addIssue(issues: ValidationIssue[], path: string, message: string) {
  issues.push({ path, message })
}

function validateCategory(value: unknown, path: string, issues: ValidationIssue[]): value is Category {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (!isNonEmptyString(value.id)) addIssue(issues, `${path}.id`, 'must be a non-empty string')
  if (!isNonEmptyString(value.name)) addIssue(issues, `${path}.name`, 'must be a non-empty string')
  if (typeof value.description !== 'string') addIssue(issues, `${path}.description`, 'must be a string')
  if (!isTimestamp(value.createdAt)) addIssue(issues, `${path}.createdAt`, 'must be a timestamp')
  if (!isTimestamp(value.updatedAt)) addIssue(issues, `${path}.updatedAt`, 'must be a timestamp')
  if (!isNullableTimestamp(value.lastAccessedAt)) addIssue(issues, `${path}.lastAccessedAt`, 'must be a timestamp or null')

  return true
}

function validateTopic(value: unknown, path: string, issues: ValidationIssue[]): value is Topic {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (!isNonEmptyString(value.id)) addIssue(issues, `${path}.id`, 'must be a non-empty string')
  if (!isNonEmptyString(value.categoryId)) addIssue(issues, `${path}.categoryId`, 'must be a non-empty string')
  if (!isNonEmptyString(value.name)) addIssue(issues, `${path}.name`, 'must be a non-empty string')
  if (typeof value.description !== 'string') addIssue(issues, `${path}.description`, 'must be a string')
  if (!isTimestamp(value.createdAt)) addIssue(issues, `${path}.createdAt`, 'must be a timestamp')
  if (!isTimestamp(value.updatedAt)) addIssue(issues, `${path}.updatedAt`, 'must be a timestamp')
  if (!isNullableTimestamp(value.lastAccessedAt)) addIssue(issues, `${path}.lastAccessedAt`, 'must be a timestamp or null')

  return true
}

function validateEntry(value: unknown, path: string, issues: ValidationIssue[]): value is Entry {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (!isNonEmptyString(value.id)) addIssue(issues, `${path}.id`, 'must be a non-empty string')
  if (!isNonEmptyString(value.topicId)) addIssue(issues, `${path}.topicId`, 'must be a non-empty string')
  if (!isEntryType(value.type)) addIssue(issues, `${path}.type`, 'must be question-answer or term-definition')
  if (!isNonEmptyString(value.question)) addIssue(issues, `${path}.question`, 'must be a non-empty string')
  if (!isNonEmptyString(value.answer)) addIssue(issues, `${path}.answer`, 'must be a non-empty string')
  if (!isTimestamp(value.createdAt)) addIssue(issues, `${path}.createdAt`, 'must be a timestamp')
  if (!isTimestamp(value.updatedAt)) addIssue(issues, `${path}.updatedAt`, 'must be a timestamp')

  return true
}

function validatePomodoroPreferences(value: unknown, path: string, issues: ValidationIssue[]): value is PomodoroPreferences {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  const durationFields = ['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const
  for (const field of durationFields) {
    if (!isNonNegativeInteger(value[field]) || value[field] < 1 || value[field] > 120) {
      addIssue(issues, `${path}.${field}`, 'must be an integer from 1 to 120')
    }
  }
  if (!isNonNegativeInteger(value.sessionsBeforeLongBreak) || value.sessionsBeforeLongBreak < 1 || value.sessionsBeforeLongBreak > 12) {
    addIssue(issues, `${path}.sessionsBeforeLongBreak`, 'must be an integer from 1 to 12')
  }
  for (const field of ['autoSwitch', 'autoStart', 'notificationsEnabled', 'ambienceMuted'] as const) {
    if (typeof value[field] !== 'boolean') addIssue(issues, `${path}.${field}`, 'must be a boolean')
  }
  if (typeof value.defaultAlarm !== 'string' || !POMODORO_ALARM_OPTIONS.some((option) => option.value === value.defaultAlarm)) {
    addIssue(issues, `${path}.defaultAlarm`, 'must be a supported alarm or none')
  }
  if (typeof value.defaultAmbience !== 'string' || !POMODORO_AMBIENCE_OPTIONS.some((option) => option.value === value.defaultAmbience)) {
    addIssue(issues, `${path}.defaultAmbience`, 'must be a supported ambience or none')
  }
  if (typeof value.defaultSnoozeMinutes !== 'number' || !POMODORO_SNOOZE_OPTIONS.some((option) => option === value.defaultSnoozeMinutes)) {
    addIssue(issues, `${path}.defaultSnoozeMinutes`, 'must be 5, 10, or 15 minutes')
  }
  if (value.permissionSetupStatus !== 'pending' && value.permissionSetupStatus !== 'enabled' && value.permissionSetupStatus !== 'dismissed') {
    addIssue(issues, `${path}.permissionSetupStatus`, 'must be pending, enabled, or dismissed')
  }

  return true
}

function validateSettings(value: unknown, path: string, issues: ValidationIssue[]): value is StudySettings {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system') {
    addIssue(issues, `${path}.theme`, 'must be light, dark, or system')
  }
  if (value.defaultStudyMode !== 'list' && value.defaultStudyMode !== 'flashcard') {
    addIssue(issues, `${path}.defaultStudyMode`, 'must be list or flashcard')
  }
  for (const field of ['showQuestionsByDefault', 'showAnswersByDefault', 'allowCopyPaste', 'spellcheck'] as const) {
    if (typeof value[field] !== 'boolean') addIssue(issues, `${path}.${field}`, 'must be a boolean')
  }
  if (!isRecord(value.flashcardFrontByEntryType)) {
    addIssue(issues, `${path}.flashcardFrontByEntryType`, 'must be an object')
  } else {
    for (const type of ['question-answer', 'term-definition'] as const) {
      if (!isFlashcardFrontSide(value.flashcardFrontByEntryType[type])) {
        addIssue(issues, `${path}.flashcardFrontByEntryType.${type}`, 'must be left or right')
      }
    }
  }
  validatePomodoroPreferences(value.pomodoro, `${path}.pomodoro`, issues)

  return true
}

function validateRecentActivity(value: unknown, path: string, issues: ValidationIssue[]): value is RecentActivity {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (value.type !== 'category' && value.type !== 'topic') addIssue(issues, `${path}.type`, 'must be category or topic')
  if (!isNonEmptyString(value.recordId)) addIssue(issues, `${path}.recordId`, 'must be a non-empty string')
  if (!isTimestamp(value.accessedAt)) addIssue(issues, `${path}.accessedAt`, 'must be a timestamp')

  return true
}

function validateActivity(value: unknown, path: string, issues: ValidationIssue[]): value is ActivityState {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (!Array.isArray(value.recentlyAccessed)) {
    addIssue(issues, `${path}.recentlyAccessed`, 'must be an array')
  } else {
    value.recentlyAccessed.forEach((item, index) => validateRecentActivity(item, `${path}.recentlyAccessed[${index}]`, issues))
  }
  if (!isNonNegativeInteger(value.completedFocusSessions)) addIssue(issues, `${path}.completedFocusSessions`, 'must be a non-negative integer')
  if (!isNonNegativeInteger(value.completedFocusMinutes)) addIssue(issues, `${path}.completedFocusMinutes`, 'must be a non-negative integer')

  return true
}

function validatePomodoroSession(value: unknown, path: string, issues: ValidationIssue[]): value is PomodoroSession {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object or null')
    return false
  }

  if (!isPomodoroMode(value.mode)) addIssue(issues, `${path}.mode`, 'must be a supported Pomodoro mode')
  if (!isNonNegativeInteger(value.durationMinutes) || value.durationMinutes < 1 || value.durationMinutes > 120) {
    addIssue(issues, `${path}.durationMinutes`, 'must be an integer from 1 to 120')
  }
  if (value.status !== 'running' && value.status !== 'paused' && value.status !== 'completed' && value.status !== 'reset') {
    addIssue(issues, `${path}.status`, 'must be running, paused, completed, or reset')
  }
  if (!isTimestamp(value.startedAt)) addIssue(issues, `${path}.startedAt`, 'must be a timestamp')
  if (!isNullableTimestamp(value.endsAt)) addIssue(issues, `${path}.endsAt`, 'must be a timestamp or null')
  if (!isNullableTimestamp(value.pausedAt)) addIssue(issues, `${path}.pausedAt`, 'must be a timestamp or null')
  if (!isNullableTimestamp(value.completedAt)) addIssue(issues, `${path}.completedAt`, 'must be a timestamp or null')

  return true
}

function validateTimer(value: unknown, path: string, issues: ValidationIssue[]): value is TimerState {
  if (!isRecord(value)) {
    addIssue(issues, path, 'must be an object')
    return false
  }

  if (!isPomodoroMode(value.selectedMode)) addIssue(issues, `${path}.selectedMode`, 'must be a supported Pomodoro mode')
  if (!isNonNegativeInteger(value.selectedDurationMinutes) || value.selectedDurationMinutes < 1 || value.selectedDurationMinutes > 120) {
    addIssue(issues, `${path}.selectedDurationMinutes`, 'must be an integer from 1 to 120')
  }
  if (value.activeSession !== null) validatePomodoroSession(value.activeSession, `${path}.activeSession`, issues)
  if (!isNonNegativeInteger(value.focusCycleCount)) addIssue(issues, `${path}.focusCycleCount`, 'must be a non-negative integer')

  return true
}

function getDefaultPomodoroDuration(value: UnknownRecord, mode: PomodoroMode) {
  const defaults = createDefaultSettings().pomodoro
  const settings = isRecord(value.settings) && isRecord(value.settings.pomodoro) ? value.settings.pomodoro : defaults
  if (mode === 'short-break' && typeof settings.shortBreakMinutes === 'number') return settings.shortBreakMinutes
  if (mode === 'long-break' && typeof settings.longBreakMinutes === 'number') return settings.longBreakMinutes
  if (mode === 'focus' && typeof settings.focusMinutes === 'number') return settings.focusMinutes
  return defaults.focusMinutes
}

function migrateTimerState(value: UnknownRecord) {
  const timer = isRecord(value.timer) ? value.timer : {}
  const selectedMode = isPomodoroMode(timer.selectedMode) ? timer.selectedMode : 'focus'
  const selectedDurationMinutes = isNonNegativeInteger(timer.selectedDurationMinutes) && timer.selectedDurationMinutes >= 1 && timer.selectedDurationMinutes <= 120
    ? timer.selectedDurationMinutes
    : getDefaultPomodoroDuration(value, selectedMode)

  return {
    ...value,
    timer: {
      ...timer,
      selectedMode,
      selectedDurationMinutes,
    },
  }
}

function migratePomodoroPreferences(value: UnknownRecord) {
  const settings = isRecord(value.settings) ? value.settings : {}
  const pomodoro = isRecord(settings.pomodoro) ? settings.pomodoro : {}
  const savedPomodoro = removeLegacySoundEnabledPreference(removeLegacyAutomaticAmbiencePreference(pomodoro))

  return {
    ...value,
    settings: {
      ...settings,
      pomodoro: {
        ...createDefaultSettings().pomodoro,
        ...savedPomodoro,
      },
    },
  }
}

function validateUniqueIds(records: Array<{ id: unknown }>, path: string, issues: ValidationIssue[]) {
  const ids = new Set<string>()
  records.forEach((record, index) => {
    if (typeof record.id !== 'string') return
    if (ids.has(record.id)) addIssue(issues, `${path}[${index}].id`, 'must be unique')
    ids.add(record.id)
  })
}

export function migrateStudyData(value: unknown): MigrationResult {
  if (!isRecord(value) || typeof value.schemaVersion !== 'number') {
    return { ok: false, reason: 'invalid', message: 'Stored data has no valid schema version.' }
  }

  if (value.schemaVersion === 1) {
    const defaultSettings = createDefaultSettings()
    const entries = Array.isArray(value.entries)
      ? value.entries.map((entry) => (isRecord(entry) ? { ...entry, type: isEntryType(entry.type) ? entry.type : 'question-answer' } : entry))
      : value.entries
    const settings = isRecord(value.settings)
      ? {
          ...value.settings,
          showAnswersByDefault: true,
          flashcardFrontByEntryType: defaultSettings.flashcardFrontByEntryType,
        }
      : value.settings

    return {
      ok: true,
      value: migrateTimerState(migratePomodoroPreferences({ ...value, schemaVersion: STUDY_DATA_SCHEMA_VERSION, entries, settings })),
      version: STUDY_DATA_SCHEMA_VERSION,
    }
  }

  if (value.schemaVersion !== STUDY_DATA_SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupported', message: `Stored schema version ${value.schemaVersion} is not supported.` }
  }

  return { ok: true, value: migrateTimerState(migratePomodoroPreferences(value)), version: STUDY_DATA_SCHEMA_VERSION }
}

export function validateStudyData(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = []

  if (!isRecord(value)) return { ok: false, issues: [{ path: 'data', message: 'must be an object' }] }
  if (value.schemaVersion !== STUDY_DATA_SCHEMA_VERSION) {
    addIssue(issues, 'schemaVersion', `must be ${STUDY_DATA_SCHEMA_VERSION}`)
  }
  if (!Array.isArray(value.categories)) {
    addIssue(issues, 'categories', 'must be an array')
  } else {
    value.categories.forEach((item, index) => validateCategory(item, `categories[${index}]`, issues))
    validateUniqueIds(value.categories, 'categories', issues)
  }
  if (!Array.isArray(value.topics)) {
    addIssue(issues, 'topics', 'must be an array')
  } else {
    value.topics.forEach((item, index) => validateTopic(item, `topics[${index}]`, issues))
    validateUniqueIds(value.topics, 'topics', issues)
  }
  if (!Array.isArray(value.entries)) {
    addIssue(issues, 'entries', 'must be an array')
  } else {
    value.entries.forEach((item, index) => validateEntry(item, `entries[${index}]`, issues))
    validateUniqueIds(value.entries, 'entries', issues)
  }

  validateSettings(value.settings, 'settings', issues)
  validateActivity(value.activity, 'activity', issues)
  validateTimer(value.timer, 'timer', issues)

  if (Array.isArray(value.categories) && Array.isArray(value.topics)) {
    const categoryIds = new Set(value.categories.flatMap((category) => (isRecord(category) && typeof category.id === 'string' ? [category.id] : [])))
    value.topics.forEach((topic, index) => {
      if (isRecord(topic) && typeof topic.categoryId === 'string' && !categoryIds.has(topic.categoryId)) {
        addIssue(issues, `topics[${index}].categoryId`, 'must reference an existing category')
      }
    })
  }
  if (Array.isArray(value.topics) && Array.isArray(value.entries)) {
    const topicIds = new Set(value.topics.flatMap((topic) => (isRecord(topic) && typeof topic.id === 'string' ? [topic.id] : [])))
    value.entries.forEach((entry, index) => {
      if (isRecord(entry) && typeof entry.topicId === 'string' && !topicIds.has(entry.topicId)) {
        addIssue(issues, `entries[${index}].topicId`, 'must reference an existing topic')
      }
    })
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, data: value as StudyData }
}
