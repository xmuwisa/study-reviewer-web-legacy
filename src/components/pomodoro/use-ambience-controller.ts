import { useCallback, useEffect, useRef, useState } from 'react'

import { POMODORO_AMBIENCE_OPTIONS, WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED } from '@/lib/pomodoro-audio'
import type { AudioInitializationResult } from '@/lib/pomodoro-permissions'
import { useStudyData } from '@/lib/use-study-data'

export type AmbienceController = {
  isPlaying: boolean
  available: boolean
  audioBlocked: boolean
  toggle: () => void
  initializeAudio: () => Promise<AudioInitializationResult>
}

export function useAmbienceController(): AmbienceController {
  const { data, updateSettings } = useStudyData()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<string | null>(null)
  const retryCleanupRef = useRef<(() => void) | null>(null)
  const playbackPromiseRef = useRef<Promise<boolean> | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const selectedAmbience = POMODORO_AMBIENCE_OPTIONS.find((option) => option.value === data.settings.pomodoro.defaultAmbience) ?? POMODORO_AMBIENCE_OPTIONS[0]
  const source = selectedAmbience.src
  const isMuted = data.settings.pomodoro.ambienceMuted
  const autoPlay = data.settings.pomodoro.autoPlayAmbience
  const permissionSetupStatus = data.settings.pomodoro.permissionSetupStatus

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

  const startAudio = useCallback((nextSource: string) => {
    const currentAudio = audioRef.current
    if (currentAudio && sourceRef.current === nextSource) {
      if (playbackPromiseRef.current) return playbackPromiseRef.current
      if (!currentAudio.paused) {
        setIsPlaying(true)
        return Promise.resolve(true)
      }

      const playback = currentAudio.play().then(() => {
        if (audioRef.current === currentAudio) {
          setIsPlaying(true)
          setAudioBlocked(false)
        }
        return true
      }).catch(() => {
        if (audioRef.current === currentAudio) {
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
    audio.preload = 'auto'
    audioRef.current = audio
    sourceRef.current = nextSource
    audio.load()

    const playback = audio.play().then(() => {
      if (audioRef.current === audio) {
        setIsPlaying(true)
        setAudioBlocked(false)
      }
      return true
    }).catch(() => {
      if (audioRef.current === audio) {
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

  useEffect(() => {
    if (isMuted || !source) {
      stopAudio()
      return
    }

    if (permissionSetupStatus !== 'enabled' || !WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED || !autoPlay) {
      if (sourceRef.current && sourceRef.current !== source) stopAudio()
      return
    }

    let cancelled = false
    const queueRetry = (attempt: () => void) => {
      if (retryCleanupRef.current) return

      const retry = () => {
        clearRetry()
        if (!cancelled) attempt()
      }
      const cleanup = () => {
        document.removeEventListener('pointerdown', retry, true)
        document.removeEventListener('keydown', retry, true)
      }

      retryCleanupRef.current = cleanup
      document.addEventListener('pointerdown', retry, { capture: true, once: true })
      document.addEventListener('keydown', retry, { capture: true, once: true })
    }

    const attemptPlayback = async () => {
      if (cancelled) return
      const played = await startAudio(source)
      if (cancelled) return
      if (played) clearRetry()
      else queueRetry(() => { void attemptPlayback() })
    }

    void attemptPlayback()

    return () => {
      cancelled = true
      clearRetry()
    }
  }, [autoPlay, clearRetry, isMuted, permissionSetupStatus, source, startAudio, stopAudio])

  useEffect(() => () => stopAudio(), [stopAudio])

  const toggle = useCallback(() => {
    if (!source) return

    const nextMuted = isPlaying
    if (!updateSettings({ pomodoro: { ambienceMuted: nextMuted } })) return
    if (nextMuted) {
      stopAudio()
      return
    }

    void startAudio(source)
  }, [isPlaying, source, startAudio, stopAudio, updateSettings])

  const initializeAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    if (!source || isMuted) return 'not-configured'

    const initialized = autoPlay
      ? await startAudio(source)
      : await primeAudio(source)

    return initialized ? 'ready' : 'blocked'
  }, [autoPlay, isMuted, primeAudio, source, startAudio])

  return {
    isPlaying,
    available: Boolean(source),
    audioBlocked,
    toggle,
    initializeAudio,
  }
}
