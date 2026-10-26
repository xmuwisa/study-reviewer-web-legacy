import { useCallback, useEffect, useRef, useState } from 'react'

import {
  POMODORO_ALARM_END_EVENT,
  POMODORO_ALARM_START_EVENT,
  getPomodoroAmbienceOption,
  WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED,
} from '@/lib/pomodoro-audio'
import type { AudioInitializationResult } from '@/lib/pomodoro-permissions'
import { useStudyData } from '@/lib/use-study-data'

type AmbienceAlarmSnapshot = {
  muted: boolean
  source: string
  wasPlaying: boolean
}

export type AmbienceController = {
  isPlaying: boolean
  isMuted: boolean
  available: boolean
  audioBlocked: boolean
  toggle: () => void
  startAutomatically: () => void
  initializeAudio: () => Promise<AudioInitializationResult>
  enableAudio: () => Promise<AudioInitializationResult>
}

export function useAmbienceController(): AmbienceController {
  const { data, updateSettings } = useStudyData()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<string | null>(null)
  const retryCleanupRef = useRef<(() => void) | null>(null)
  const playbackPromiseRef = useRef<Promise<boolean> | null>(null)
  const alarmSnapshotRef = useRef<AmbienceAlarmSnapshot | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const selectedAmbience = getPomodoroAmbienceOption(data.settings.pomodoro.defaultAmbience)
  const source = selectedAmbience.src
  const isMuted = data.settings.pomodoro.ambienceMuted
  const autoPlay = data.settings.pomodoro.autoPlayAmbience

  const clearRetry = useCallback(() => {
    retryCleanupRef.current?.()
    retryCleanupRef.current = null
  }, [])

  const stopAudio = useCallback(() => {
    clearRetry()
    playbackPromiseRef.current = null
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
    audioRef.current = null
    sourceRef.current = null
    setIsPlaying(false)
    setAudioBlocked(false)
  }, [clearRetry])

  const startAudio = useCallback((nextSource: string, muted: boolean) => {
    const currentAudio = audioRef.current
    if (currentAudio && sourceRef.current === nextSource) {
      currentAudio.muted = muted
      if (playbackPromiseRef.current) return playbackPromiseRef.current
      if (!currentAudio.paused) {
        setIsPlaying(true)
        setAudioBlocked(false)
        return Promise.resolve(true)
      }

      const playback = currentAudio.play().then(() => {
        if (audioRef.current === currentAudio) {
          const alarmPaused = alarmSnapshotRef.current?.source === nextSource
          setIsPlaying(!alarmPaused && !currentAudio.paused)
          setAudioBlocked(false)
        }
        return !currentAudio.paused && alarmSnapshotRef.current?.source !== nextSource
      }).catch(() => {
        if (audioRef.current === currentAudio) {
          if (alarmSnapshotRef.current?.source === nextSource) {
            setIsPlaying(false)
            return false
          }
          audioRef.current = null
          sourceRef.current = null
          setIsPlaying(false)
          setAudioBlocked(true)
        }
        return false
      })
      playbackPromiseRef.current = playback
      void playback.finally(() => {
        if (playbackPromiseRef.current === playback) playbackPromiseRef.current = null
      })
      return playback
    }

    stopAudio()
    const audio = new Audio(nextSource)
    audio.loop = true
    audio.muted = muted
    audio.preload = 'auto'
    audioRef.current = audio
    sourceRef.current = nextSource
    audio.load()

    const playback = audio.play().then(() => {
      if (audioRef.current === audio) {
        const alarmPaused = alarmSnapshotRef.current?.source === nextSource
        setIsPlaying(!alarmPaused && !audio.paused)
        setAudioBlocked(false)
      }
      return !audio.paused && alarmSnapshotRef.current?.source !== nextSource
    }).catch(() => {
      if (audioRef.current === audio) {
        if (alarmSnapshotRef.current?.source === nextSource) {
          setIsPlaying(false)
          return false
        }
        audioRef.current = null
        sourceRef.current = null
        setIsPlaying(false)
        setAudioBlocked(true)
      }
      return false
    })
    playbackPromiseRef.current = playback
    void playback.finally(() => {
      if (playbackPromiseRef.current === playback) playbackPromiseRef.current = null
    })
    return playback
  }, [stopAudio])

  const primeAudio = useCallback((nextSource: string) => {
    const currentAudio = audioRef.current
    if (currentAudio && sourceRef.current === nextSource && !currentAudio.paused) return Promise.resolve(true)

    if (!currentAudio || sourceRef.current !== nextSource) stopAudio()

    const audio = audioRef.current ?? new Audio(nextSource)
    audio.loop = true
    audio.preload = 'auto'
    audio.muted = true
    audioRef.current = audio
    sourceRef.current = nextSource
    audio.load()

    const playback = audio.play().then(() => {
      if (audioRef.current !== audio) return false
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
      setAudioBlocked(false)
      return true
    }).catch(() => {
      if (audioRef.current === audio) {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
        audioRef.current = null
        sourceRef.current = null
        setAudioBlocked(true)
      }
      return false
    })
    playbackPromiseRef.current = playback
    void playback.finally(() => {
      if (playbackPromiseRef.current === playback) playbackPromiseRef.current = null
    })
    return playback
  }, [stopAudio])

  const queueRetry = useCallback((nextSource: string, muted: boolean) => {
    if (retryCleanupRef.current) return

    const retry = () => {
      clearRetry()
      void startAudio(nextSource, muted)
    }
    const cleanup = () => {
      document.removeEventListener('pointerdown', retry, true)
      document.removeEventListener('keydown', retry, true)
    }

    retryCleanupRef.current = cleanup
    document.addEventListener('pointerdown', retry, { capture: true, once: true })
    document.addEventListener('keydown', retry, { capture: true, once: true })
  }, [clearRetry, startAudio])

  const startAutomatically = useCallback(() => {
    if (!WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED || !autoPlay || !source) return

    const attemptPlayback = async () => {
      const played = await startAudio(source, isMuted)
      if (!played && !alarmSnapshotRef.current) queueRetry(source, isMuted)
    }

    void attemptPlayback()
  }, [autoPlay, isMuted, queueRetry, source, startAudio])

  const pauseForAlarm = useCallback(() => {
    const audio = audioRef.current
    const currentSource = sourceRef.current
    if (!audio || !currentSource) {
      alarmSnapshotRef.current = null
      return
    }

    alarmSnapshotRef.current = {
      muted: audio.muted,
      source: currentSource,
      wasPlaying: !audio.paused,
    }
    clearRetry()
    if (audio.paused) return

    if (playbackPromiseRef.current) audio.muted = true
    else audio.pause()
    setIsPlaying(false)
  }, [clearRetry])

  const restoreAfterAlarm = useCallback(() => {
    const snapshot = alarmSnapshotRef.current
    alarmSnapshotRef.current = null
    if (!snapshot?.wasPlaying || !source || source !== snapshot.source) return

    void startAudio(snapshot.source, snapshot.muted)
  }, [source, startAudio])

  const pauseForAlarmRef = useRef(pauseForAlarm)
  const restoreAfterAlarmRef = useRef(restoreAfterAlarm)
  pauseForAlarmRef.current = pauseForAlarm
  restoreAfterAlarmRef.current = restoreAfterAlarm

  useEffect(() => {
    const handleAlarmStart = () => pauseForAlarmRef.current()
    const handleAlarmEnd = () => restoreAfterAlarmRef.current()
    window.addEventListener(POMODORO_ALARM_START_EVENT, handleAlarmStart)
    window.addEventListener(POMODORO_ALARM_END_EVENT, handleAlarmEnd)

    return () => {
      window.removeEventListener(POMODORO_ALARM_START_EVENT, handleAlarmStart)
      window.removeEventListener(POMODORO_ALARM_END_EVENT, handleAlarmEnd)
    }
  }, [])

  useEffect(() => {
    if (sourceRef.current === source) return

    const currentAudio = audioRef.current
    const shouldResume = Boolean(currentAudio && !currentAudio.paused)
    const muted = currentAudio?.muted ?? isMuted
    stopAudio()
    if (shouldResume && source) void startAudio(source, muted)
  }, [isMuted, source, startAudio, stopAudio])

  useEffect(() => () => stopAudio(), [stopAudio])

  const toggle = useCallback(() => {
    if (!source) return

    const audio = audioRef.current
    if (!isPlaying || !audio || sourceRef.current !== source || audio.paused) {
      void startAudio(source, isMuted)
      return
    }

    const nextMuted = !isMuted
    if (!updateSettings({ pomodoro: { ambienceMuted: nextMuted } })) return
    audio.muted = nextMuted
    setAudioBlocked(false)
  }, [isMuted, isPlaying, source, startAudio, updateSettings])

  const initializeAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    if (!source) return 'not-configured'
    const initialized = await primeAudio(source)
    return initialized ? 'ready' : 'blocked'
  }, [primeAudio, source])

  const enableAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    if (!source) return 'not-configured'
    const initialized = await startAudio(source, isMuted)
    return initialized ? 'ready' : 'blocked'
  }, [isMuted, source, startAudio])

  return {
    isPlaying,
    isMuted,
    available: Boolean(source),
    audioBlocked,
    toggle,
    startAutomatically,
    initializeAudio,
    enableAudio,
  }
}
