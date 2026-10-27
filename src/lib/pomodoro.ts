import type {
  PomodoroMode,
  PomodoroPreferences,
  PomodoroSession,
  StudyData,
  TimerState,
  Timestamp,
} from './study-data'

export const POMODORO_MINUTES_MIN = 1
export const POMODORO_MINUTES_MAX = 120

const MINUTE_IN_MS = 60_000

export function clampPomodoroMinutes(value: number) {
  return Math.min(POMODORO_MINUTES_MAX, Math.max(POMODORO_MINUTES_MIN, Math.round(value)))
}

export function getPomodoroModeDuration(preferences: PomodoroPreferences, mode: PomodoroMode) {
  if (mode === 'short-break') return preferences.shortBreakMinutes
  if (mode === 'long-break') return preferences.longBreakMinutes
  return preferences.focusMinutes
}

export function getPomodoroModeLabel(mode: PomodoroMode) {
  if (mode === 'short-break') return 'Short Break'
  if (mode === 'long-break') return 'Long Break'
  return 'Focus'
}

export function createPomodoroSession(mode: PomodoroMode, durationMinutes: number, now: Timestamp): PomodoroSession {
  const duration = clampPomodoroMinutes(durationMinutes)

  return {
    mode,
    durationMinutes: duration,
    status: 'running',
    startedAt: now,
    endsAt: now + duration * MINUTE_IN_MS,
    pausedAt: null,
    completedAt: null,
  }
}

export function getPomodoroRemainingSeconds(session: PomodoroSession | null, now: Timestamp) {
  if (!session) return 0

  if (session.status === 'completed') return 0

  if (session.status === 'paused' && session.endsAt !== null && session.pausedAt !== null) {
    return Math.max(0, Math.ceil((session.endsAt - session.pausedAt) / 1000))
  }

  if (session.status === 'running' && session.endsAt !== null) {
    return Math.max(0, Math.ceil((session.endsAt - now) / 1000))
  }

  return session.durationMinutes * 60
}

function withTimer(data: StudyData, timer: TimerState): StudyData {
  return { ...data, timer }
}

function getDefaultDuration(data: StudyData, mode: PomodoroMode) {
  return getPomodoroModeDuration(data.settings.pomodoro, mode)
}

export function selectPomodoroMode(data: StudyData, mode: PomodoroMode) {
  if (data.timer.activeSession?.status === 'running' || data.timer.activeSession?.status === 'paused') return data

  return withTimer(data, {
    ...data.timer,
    selectedMode: mode,
    selectedDurationMinutes: getDefaultDuration(data, mode),
    activeSession: null,
  })
}

export function abandonPomodoroSession(data: StudyData, mode: PomodoroMode) {
  return withTimer(data, {
    ...data.timer,
    selectedMode: mode,
    selectedDurationMinutes: getDefaultDuration(data, mode),
    activeSession: null,
  })
}

export function startPomodoro(data: StudyData, now: Timestamp) {
  const activeSession = data.timer.activeSession
  if (activeSession?.status === 'running' || activeSession?.status === 'paused') return data

  const durationMinutes = getDefaultDuration(data, data.timer.selectedMode)

  return withTimer(data, {
    ...data.timer,
    selectedDurationMinutes: durationMinutes,
    activeSession: createPomodoroSession(data.timer.selectedMode, durationMinutes, now),
  })
}

export function pausePomodoro(data: StudyData, now: Timestamp) {
  const session = data.timer.activeSession
  if (!session || session.status !== 'running' || session.endsAt === null) return data
  if (now >= session.endsAt) return reconcilePomodoro(data, now)

  return withTimer(data, {
    ...data.timer,
    activeSession: { ...session, status: 'paused', pausedAt: now },
  })
}

export function resumePomodoro(data: StudyData, now: Timestamp) {
  const session = data.timer.activeSession
  if (!session || session.status !== 'paused' || session.endsAt === null || session.pausedAt === null) return data

  const remainingMs = Math.max(0, session.endsAt - session.pausedAt)
  if (remainingMs === 0) return resetPomodoro(data)

  return withTimer(data, {
    ...data.timer,
    activeSession: {
      ...session,
      status: 'running',
      startedAt: now,
      endsAt: now + remainingMs,
      pausedAt: null,
    },
  })
}

export function snoozePomodoro(data: StudyData, durationMinutes: number, now: Timestamp) {
  const session = data.timer.activeSession
  if (!session || (session.status !== 'completed' && !(session.status === 'running' && session.endsAt !== null && session.endsAt <= now))) return data

  const snoozeMinutes = clampPomodoroMinutes(durationMinutes)

  return withTimer(data, {
    ...data.timer,
    selectedDurationMinutes: snoozeMinutes,
    activeSession: {
      ...session,
      status: 'running',
      startedAt: now,
      endsAt: now + snoozeMinutes * MINUTE_IN_MS,
      pausedAt: null,
      completedAt: null,
    },
  })
}

export function resetPomodoro(data: StudyData) {
  return withTimer(data, {
    ...data.timer,
    selectedDurationMinutes: getDefaultDuration(data, data.timer.selectedMode),
    activeSession: null,
  })
}

export function completePomodoroSession(data: StudyData, mode: PomodoroMode, durationMinutes: number, now: Timestamp) {
  const completedSession = createPomodoroSession(mode, durationMinutes, now - clampPomodoroMinutes(durationMinutes) * MINUTE_IN_MS)
  const transition = getCompletionTransition(data, completedSession)
  const nextMode = transition.selectedMode
  const nextDuration = getDefaultDuration(data, nextMode)
  const activeSession = data.settings.pomodoro.autoStartNextSession
    ? createPomodoroSession(nextMode, nextDuration, now)
    : null

  return withTimer(
    {
      ...data,
      activity: transition.activity,
    },
    {
      ...data.timer,
      selectedMode: nextMode,
      selectedDurationMinutes: nextDuration,
      focusCycleCount: transition.focusCycleCount,
      activeSession,
    },
  )
}

export function adjustPomodoroDuration(data: StudyData, durationMinutes: number) {
  if (data.timer.activeSession) return data

  return withTimer(data, {
    ...data.timer,
    selectedDurationMinutes: clampPomodoroMinutes(durationMinutes),
  })
}

function getCompletionTransition(data: StudyData, session: PomodoroSession) {
  let selectedMode: PomodoroMode = session.mode
  let focusCycleCount = data.timer.focusCycleCount
  let activity = data.activity

  if (session.mode === 'focus') {
    const completedFocusSessions = data.activity.completedFocusSessions + 1
    focusCycleCount += 1
    const nextMode = focusCycleCount >= data.settings.pomodoro.sessionsBeforeLongBreak ? 'long-break' : 'short-break'
    selectedMode = nextMode
    activity = {
      ...data.activity,
      completedFocusSessions,
      completedFocusMinutes: data.activity.completedFocusMinutes + session.durationMinutes,
    }
  } else if (session.mode === 'long-break') {
    selectedMode = 'focus'
    focusCycleCount = 0
  } else {
    selectedMode = 'focus'
  }

  return { activity, focusCycleCount, selectedMode }
}

export function reconcilePomodoro(data: StudyData, now: Timestamp) {
  const session = data.timer.activeSession
  if (!session || session.status !== 'running' || session.endsAt === null || now < session.endsAt) return data

  return withTimer(data, {
    ...data.timer,
    activeSession: {
      ...session,
      status: 'completed',
      completedAt: now,
    },
  })
}
