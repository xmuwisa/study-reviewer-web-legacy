import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { getPomodoroRemainingSeconds } from '@/lib/pomodoro'
import { getPomodoroAlarmOption } from '@/lib/pomodoro-audio'
import { pomodoroAudioManager } from '@/lib/pomodoro-audio-controller'
import {
  type AudioOperationResult,
  getNotificationPermission,
  getPomodoroNotificationIdentity,
  showPomodoroNotification,
} from '@/lib/pomodoro-permissions'
import type { PomodoroMode } from '@/lib/study-data'
import { useStudyData } from '@/lib/use-study-data'

import { clampDuration, formatTimer, TIMER_MODES } from './pomodoro-model'

export type PomodoroController = {
  mode: PomodoroMode
  duration: number
  preciseDuration: string
  isRunning: boolean
  hasStarted: boolean
  remainingSeconds: number
  remainingLabel: string
  indicatorDurationMinutes: number
  alarmActive: boolean
  alarmSoundAvailable: boolean
  alarmSilenced: boolean
  audioBlocked: boolean
  modeLabel: string
  setDurationValue: (value: number) => void
  handleModeChange: (value: string[]) => void
  handleReset: () => void
  handlePlayPause: () => void
  handlePreciseDurationChange: (value: string) => void
  commitPreciseDuration: () => void
  initializeAudio: () => Promise<AudioOperationResult>
  toggleAlarmSound: () => void
  stopAlarm: () => void
  snoozeAlarm: () => void
}

export function usePomodoroController(): PomodoroController {
  const {
    data,
    updateSettings,
    selectPomodoroMode,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    snoozePomodoro,
    resetPomodoro,
    completePomodoroSession,
  } = useStudyData()
  const audioSnapshot = useSyncExternalStore(
    pomodoroAudioManager.subscribe,
    pomodoroAudioManager.getSnapshot,
    pomodoroAudioManager.getSnapshot,
  )
  const [preciseDuration, setPreciseDuration] = useState(() => String(data.settings.pomodoro.focusMinutes))
  const [now, setNow] = useState(() => Date.now())
  const alarmAnnouncementRef = useRef<string | null>(null)
  const notificationAnnouncementRef = useRef<string | null>(null)
  const session = data.timer.activeSession
  const mode = data.timer.selectedMode
  const modeConfig = TIMER_MODES[mode]
  const duration = data.settings.pomodoro[modeConfig.durationKey]
  const permissionSetupStatus = data.settings.pomodoro.permissionSetupStatus
  const selectedAlarm = getPomodoroAlarmOption(data.settings.pomodoro.defaultAlarm)
  const remainingSeconds = session ? getPomodoroRemainingSeconds(session, now) : duration * 60
  const alarmActive = Boolean(session && (session.status === 'completed' || (session.status === 'running' && remainingSeconds === 0)))
  const isRunning = Boolean(session?.status === 'running' && !alarmActive)
  const hasStarted = Boolean(session)
  const alarmState = audioSnapshot.alarm

  useEffect(() => {
    if (!session || session.status !== 'running') return

    const updateNow = () => setNow(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    window.addEventListener('focus', updateNow)
    document.addEventListener('visibilitychange', updateNow)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', updateNow)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [session?.endsAt, session?.pausedAt, session?.status])

  useEffect(() => {
    if (!session) setPreciseDuration(String(duration))
  }, [duration, session])

  useEffect(() => {
    if (!alarmActive) {
      alarmAnnouncementRef.current = null
      if (alarmState.active) pomodoroAudioManager.endAlarm()
      return
    }

    if (!selectedAlarm.src) {
      if (alarmState.active) pomodoroAudioManager.endAlarm()
      return
    }

    const alarmIdentity = `${session?.mode}:${session?.startedAt}:${session?.endsAt ?? session?.completedAt ?? 'unknown'}:${selectedAlarm.src}`
    if (alarmAnnouncementRef.current === alarmIdentity) return

    alarmAnnouncementRef.current = alarmIdentity
    void pomodoroAudioManager.beginAlarm(selectedAlarm.src, alarmIdentity)
  }, [alarmActive, selectedAlarm.src, session?.completedAt, session?.endsAt, session?.mode, session?.startedAt])

  useEffect(() => {
    if (!alarmActive) {
      notificationAnnouncementRef.current = null
      return
    }

    if (permissionSetupStatus !== 'enabled' || !data.settings.pomodoro.notificationsEnabled || getNotificationPermission() !== 'granted' || !session) return

    const notificationIdentity = getPomodoroNotificationIdentity(session)
    if (notificationAnnouncementRef.current === notificationIdentity) return

    const shown = showPomodoroNotification(
      'Pomodoro session finished',
      `${modeConfig.label} is complete.`,
      notificationIdentity,
    )
    if (shown) notificationAnnouncementRef.current = notificationIdentity
  }, [alarmActive, data.settings.pomodoro.notificationsEnabled, modeConfig.label, permissionSetupStatus, session])

  function setDurationValue(value: number) {
    const nextDuration = clampDuration(value)
    const saved = updateSettings({ pomodoro: { [modeConfig.durationKey]: nextDuration } })
    setPreciseDuration(saved ? String(nextDuration) : String(duration))
  }

  function handleModeChange(value: string[]) {
    if (alarmActive || session?.status === 'running' || session?.status === 'paused') return
    const nextMode = value[0]
    if (nextMode !== 'focus' && nextMode !== 'short-break' && nextMode !== 'long-break') return

    selectPomodoroMode(nextMode)
    setPreciseDuration(String(data.settings.pomodoro[TIMER_MODES[nextMode].durationKey]))
  }

  function handleReset() {
    if (alarmActive) pomodoroAudioManager.endAlarm()
    resetPomodoro()
  }

  const toggleAlarmSound = useCallback(() => {
    if (!alarmActive || !selectedAlarm.src) return

    if (alarmState.silenced) {
      void pomodoroAudioManager.resumeAlarm(selectedAlarm.src)
      return
    }

    pomodoroAudioManager.silenceAlarm()
  }, [alarmActive, alarmState.silenced, selectedAlarm.src])

  function handlePlayPause() {
    if (alarmActive) return

    if (session?.status === 'running') {
      pausePomodoro()
      return
    }

    if (selectedAlarm.src) {
      void pomodoroAudioManager.initializeAlarmPlayback(selectedAlarm.src)
    }

    if (session?.status === 'paused') {
      resumePomodoro()
      return
    }

    startPomodoro()
  }

  function handlePreciseDurationChange(value: string) {
    setPreciseDuration(value)
    if (value === '') return

    const parsedValue = Number(value)
    if (Number.isFinite(parsedValue)) setDurationValue(parsedValue)
  }

  function commitPreciseDuration() {
    const parsedValue = Number(preciseDuration)
    setDurationValue(Number.isFinite(parsedValue) ? parsedValue : duration)
  }

  function stopAlarm() {
    if (!session || !alarmActive) return

    pomodoroAudioManager.endAlarm()
    completePomodoroSession(session.mode, session.durationMinutes)
  }

  function snoozeAlarm() {
    if (!session || !alarmActive) return

    pomodoroAudioManager.endAlarm()
    snoozePomodoro(data.settings.pomodoro.defaultSnoozeMinutes)
  }

  const initializeAudio = useCallback(async (): Promise<AudioOperationResult> => {
    if (!selectedAlarm.src) return 'not-configured'
    if (alarmActive) {
      const alarmIdentity = `${session?.mode}:${session?.startedAt}:${session?.endsAt ?? session?.completedAt ?? 'unknown'}:${selectedAlarm.src}`
      return pomodoroAudioManager.beginAlarm(selectedAlarm.src, alarmIdentity)
    }
    return pomodoroAudioManager.initializeAlarmPlayback(selectedAlarm.src)
  }, [alarmActive, selectedAlarm.src, session?.completedAt, session?.endsAt, session?.mode, session?.startedAt])

  return {
    mode,
    duration,
    preciseDuration,
    isRunning,
    hasStarted,
    remainingSeconds,
    remainingLabel: formatTimer(remainingSeconds),
    indicatorDurationMinutes: session ? data.timer.selectedDurationMinutes : duration,
    alarmActive,
    alarmSoundAvailable: Boolean(selectedAlarm.src),
    alarmSilenced: alarmState.silenced,
    audioBlocked: alarmState.blocked,
    modeLabel: modeConfig.label,
    setDurationValue,
    handleModeChange,
    handleReset,
    handlePlayPause,
    handlePreciseDurationChange,
    commitPreciseDuration,
    initializeAudio,
    toggleAlarmSound,
    stopAlarm,
    snoozeAlarm,
  }
}
