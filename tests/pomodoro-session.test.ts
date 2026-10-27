import { expect, test } from 'bun:test'

import { completePomodoroSession } from '../src/lib/pomodoro'
import { createEmptyStudyData } from '../src/lib/study-data'
import { migrateStudyData } from '../src/lib/study-validation'

test('automatic next-session setting starts the transitioned session', () => {
  const data = createEmptyStudyData()
  data.settings.pomodoro.autoStartNextSession = true

  const completed = completePomodoroSession(data, 'focus', 25, 1_500_000)

  expect(completed.timer.selectedMode).toBe('short-break')
  expect(completed.timer.activeSession).toMatchObject({
    mode: 'short-break',
    status: 'running',
    startedAt: 1_500_000,
  })
})

test('manual next-session setting leaves progression ready for Play', () => {
  const data = createEmptyStudyData()

  const completed = completePomodoroSession(data, 'focus', 25, 1_500_000)

  expect(completed.timer.selectedMode).toBe('short-break')
  expect(completed.timer.activeSession).toBeNull()
})

test('legacy session settings migrate without losing the selected alarm', () => {
  const data = createEmptyStudyData()
  const legacyPomodoro = Object.fromEntries(Object.entries(data.settings.pomodoro).filter(([key]) => key !== 'autoStartNextSession'))
  const migrated = migrateStudyData({
    ...data,
    settings: {
      ...data.settings,
      pomodoro: {
        ...legacyPomodoro,
        autoSwitch: true,
        autoStart: true,
        defaultAlarm: 'happy-bells-alarm',
      },
    },
  })

  expect(migrated.ok).toBe(true)
  if (!migrated.ok) return

  const pomodoro = (migrated.value as { settings: { pomodoro: Record<string, unknown> } }).settings.pomodoro
  expect(pomodoro.autoStartNextSession).toBe(true)
  expect(pomodoro).not.toHaveProperty('autoSwitch')
  expect(pomodoro).not.toHaveProperty('autoStart')
  expect(pomodoro.defaultAlarm).toBe('happy-bells-alarm')
})
