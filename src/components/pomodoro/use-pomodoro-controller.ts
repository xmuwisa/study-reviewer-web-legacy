import { useCallback, useEffect, useRef, useState } from 'react'

import { getPomodoroRemainingSeconds } from '@/lib/pomodoro'
import { getPomodoroAlarmOption, POMODORO_ALARM_END_EVENT, POMODORO_ALARM_START_EVENT, WEB_AUTOMATIC_ALARM_AUDIO_ENABLED } from '@/lib/pomodoro-audio'
import {
  getNotificationPermission,
  getPomodoroNotificationIdentity,
  showPomodoroNotification,
  type AudioInitializationResult,
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
  initializeAudio: () => Promise<AudioInitializationResult>
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
  const [preciseDuration, setPreciseDuration] = useState(() => String(data.settings.pomodoro.focusMinutes))
  const [now, setNow] = useState(() => Date.now())
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null)
  const alarmSourceRef = useRef<string | null>(null)
  const alarmRetryCleanupRef = useRef<(() => void) | null>(null)
  const alarmRetrySourceRef = useRef<string | null>(null)
  const alarmPlayPendingRef = useRef(false)
  const alarmSilencedRef = useRef(false)
  const alarmActiveRef = useRef(false)
  const alarmPlayRef = useRef<(source: string) => Promise<boolean>>(() => Promise.resolve(false))
  const alarmAnnouncementRef = useRef<string | null>(null)
  const notificationAnnouncementRef = useRef<string | null>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [alarmSilenced, setAlarmSilenced] = useState(false)
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
  alarmActiveRef.current = alarmActive

  const clearAlarmRetry = useCallback(() => {
    alarmRetryCleanupRef.current?.()
    alarmRetryCleanupRef.current = null
    alarmRetrySourceRef.current = null
  }, [])

  const queueAlarmRetry = useCallback((source: string) => {
    if (alarmRetryCleanupRef.current && alarmRetrySourceRef.current === source) return

    clearAlarmRetry()
    const retry = () => {
      clearAlarmRetry()
      void alarmPlayRef.current(source)
    }
    const cleanup = () => {
      document.removeEventListener('pointerdown', retry, true)
      document.removeEventListener('keydown', retry, true)
    }

    alarmRetrySourceRef.current = source
    alarmRetryCleanupRef.current = cleanup
    document.addEventListener('pointerdown', retry, { capture: true, once: true })
    document.addEventListener('keydown', retry, { capture: true, once: true })
  }, [clearAlarmRetry])

  const prepareAlarmAudio = useCallback((source: string) => {
    if (alarmAudioRef.current && alarmSourceRef.current === source) return alarmAudioRef.current

    alarmAudioRef.current?.pause()
    if (alarmAudioRef.current) alarmAudioRef.current.currentTime = 0
    const audio = new Audio(source)
    audio.loop = true
    audio.preload = 'auto'
    alarmAudioRef.current = audio
    alarmSourceRef.current = source
    audio.load()
    return audio
  }, [])

  const playAlarmAudio = useCallback(async (source: string) => {
    const audio = prepareAlarmAudio(source)
    audio.loop = true
    audio.muted = false

    if (alarmPlayPendingRef.current || !audio.paused) return true

    alarmPlayPendingRef.current = true
    try {
      await audio.play()
      if (alarmSilencedRef.current) {
        audio.pause()
        return true
      }
      clearAlarmRetry()
      setAudioBlocked(false)
      return true
    } catch {
      if (alarmAudioRef.current === audio) {
        setAudioBlocked(true)
        queueAlarmRetry(source)
      }
      return false
    } finally {
      alarmPlayPendingRef.current = false
    }
  }, [clearAlarmRetry, prepareAlarmAudio, queueAlarmRetry])

  alarmPlayRef.current = playAlarmAudio

  const primeAlarmAudio = useCallback((source: string) => {
    const audio = prepareAlarmAudio(source)
    audio.muted = true
    return audio.play().then(() => {
      if (alarmAudioRef.current !== audio) return false
      if (alarmActiveRef.current) {
        audio.currentTime = 0
        audio.muted = false
        return true
      }
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      setAudioBlocked(false)
      return true
    }).catch(() => {
      if (alarmAudioRef.current === audio) {
        audio.muted = false
        setAudioBlocked(true)
      }
      return false
    })
  }, [prepareAlarmAudio])

  const initializeAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    if (!selectedAlarm.src) return 'not-configured'

    const initialized = alarmActive && data.settings.pomodoro.soundEnabled
      ? await playAlarmAudio(selectedAlarm.src)
      : await primeAlarmAudio(selectedAlarm.src)

    return initialized ? 'ready' : 'blocked'
  }, [alarmActive, data.settings.pomodoro.soundEnabled, playAlarmAudio, primeAlarmAudio, selectedAlarm.src])

  const stopAlarmAudio = useCallback(() => {
    clearAlarmRetry()
    alarmPlayPendingRef.current = false
    alarmAudioRef.current?.pause()
    if (alarmAudioRef.current) {
      alarmAudioRef.current.currentTime = 0
      alarmAudioRef.current.muted = false
    }
    alarmAudioRef.current = null
    alarmSourceRef.current = null
    alarmSilencedRef.current = false
    setAlarmSilenced(false)
    setAudioBlocked(false)
  }, [clearAlarmRetry])

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
      return
    }

    if (permissionSetupStatus !== 'enabled' || !WEB_AUTOMATIC_ALARM_AUDIO_ENABLED) {
      stopAlarmAudio()
      return
    }

    if (!data.settings.pomodoro.soundEnabled || !selectedAlarm.src) {
      stopAlarmAudio()
      return
    }

    if (alarmSilenced) return

    const alarmIdentity = `${session?.mode}:${session?.startedAt}:${session?.endsAt ?? 'unknown'}:${selectedAlarm.src}`
    if (alarmAnnouncementRef.current !== alarmIdentity) {
      alarmAnnouncementRef.current = alarmIdentity
      window.dispatchEvent(new Event(POMODORO_ALARM_START_EVENT))
    }

    void playAlarmAudio(selectedAlarm.src)
  }, [alarmActive, alarmSilenced, data.settings.pomodoro.soundEnabled, permissionSetupStatus, playAlarmAudio, selectedAlarm.src, session?.completedAt, session?.endsAt, session?.mode, session?.startedAt, stopAlarmAudio])

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

  useEffect(() => () => stopAlarmAudio(), [stopAlarmAudio])

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
    if (alarmActive) window.dispatchEvent(new Event(POMODORO_ALARM_END_EVENT))
    stopAlarmAudio()
    resetPomodoro()
  }

  const toggleAlarmSound = useCallback(() => {
    if (!alarmActive || permissionSetupStatus !== 'enabled' || !data.settings.pomodoro.soundEnabled || !selectedAlarm.src) return

    if (alarmSilenced) {
      alarmSilencedRef.current = false
      setAlarmSilenced(false)
      void playAlarmAudio(selectedAlarm.src)
      return
    }

    clearAlarmRetry()
    alarmPlayPendingRef.current = false
    alarmAudioRef.current?.pause()
    alarmSilencedRef.current = true
    setAlarmSilenced(true)
  }, [alarmActive, alarmSilenced, clearAlarmRetry, data.settings.pomodoro.soundEnabled, permissionSetupStatus, playAlarmAudio, selectedAlarm.src])

  function handlePlayPause() {
    if (alarmActive) return
    if (WEB_AUTOMATIC_ALARM_AUDIO_ENABLED && selectedAlarm.src) primeAlarmAudio(selectedAlarm.src)

    if (session?.status === 'running') {
      pausePomodoro()
      return
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

    stopAlarmAudio()
    window.dispatchEvent(new Event(POMODORO_ALARM_END_EVENT))
    completePomodoroSession(session.mode, session.durationMinutes)
  }

  function snoozeAlarm() {
    if (!session || !alarmActive) return

    stopAlarmAudio()
    window.dispatchEvent(new Event(POMODORO_ALARM_END_EVENT))
    snoozePomodoro(data.settings.pomodoro.defaultSnoozeMinutes)
  }

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
    alarmSoundAvailable: Boolean(permissionSetupStatus === 'enabled' && data.settings.pomodoro.soundEnabled && selectedAlarm.src),
    alarmSilenced,
    audioBlocked,
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
