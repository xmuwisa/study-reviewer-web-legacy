import { useCallback, useEffect, useSyncExternalStore } from 'react'

import {
  getPomodoroAmbienceOption,
  WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED,
} from '@/lib/pomodoro-audio'
import { pomodoroAudioManager } from '@/lib/pomodoro-audio-controller'
import type { AudioInitializationResult } from '@/lib/pomodoro-permissions'
import { useStudyData } from '@/lib/use-study-data'

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
  const audioSnapshot = useSyncExternalStore(
    pomodoroAudioManager.subscribe,
    pomodoroAudioManager.getSnapshot,
    pomodoroAudioManager.getSnapshot,
  )
  const selectedAmbience = getPomodoroAmbienceOption(data.settings.pomodoro.defaultAmbience)
  const source = selectedAmbience.src
  const isMuted = data.settings.pomodoro.ambienceMuted
  const autoPlay = data.settings.pomodoro.autoPlayAmbience
  const ambienceState = audioSnapshot.ambience
  const isPlaying = ambienceState.source === source && ambienceState.isPlaying

  useEffect(() => {
    pomodoroAudioManager.syncAmbienceSource(source, isMuted)
  }, [isMuted, source])

  const startAutomatically = useCallback(() => {
    if (!WEB_AUTOMATIC_AMBIENCE_AUDIO_ENABLED || !autoPlay || !source) return
    void pomodoroAudioManager.startAmbience(source, isMuted)
  }, [autoPlay, isMuted, source])

  const toggle = useCallback(() => {
    if (!source) return

    if (!isPlaying) {
      void pomodoroAudioManager.startAmbience(source, isMuted)
      return
    }

    const nextMuted = !isMuted
    if (!updateSettings({ pomodoro: { ambienceMuted: nextMuted } })) return
    pomodoroAudioManager.setAmbienceMuted(nextMuted)
  }, [isMuted, isPlaying, source, updateSettings])

  const initializeAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    return pomodoroAudioManager.prepareAmbienceAudio(source, isMuted) ? 'ready' : 'not-configured'
  }, [isMuted, source])

  const enableAudio = useCallback(async (): Promise<AudioInitializationResult> => {
    return pomodoroAudioManager.startAmbience(source, isMuted)
  }, [isMuted, source])

  return {
    isPlaying,
    isMuted,
    available: Boolean(source),
    audioBlocked: ambienceState.source === source && ambienceState.blocked,
    toggle,
    startAutomatically,
    initializeAudio,
    enableAudio,
  }
}
