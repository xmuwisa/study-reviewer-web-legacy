import type { AudioInitializationResult } from './pomodoro-permissions'

export type PomodoroPreviewKind = 'alarm' | 'ambience'
export type AudioPlaybackResult = AudioInitializationResult

export type PomodoroAudioSnapshot = {
  ambience: {
    source: string | null
    isPlaying: boolean
    isMuted: boolean
    blocked: boolean
  }
  alarm: {
    source: string | null
    active: boolean
    isPlaying: boolean
    silenced: boolean
    blocked: boolean
  }
  preview: {
    kind: PomodoroPreviewKind | null
    isPlaying: boolean
  }
}

type AmbienceResumeRequest = {
  source: string
  muted: boolean
  wasPlaying: boolean
}

type AudioFactory = (source: string) => HTMLAudioElement

const INITIAL_SNAPSHOT: PomodoroAudioSnapshot = {
  ambience: { source: null, isPlaying: false, isMuted: false, blocked: false },
  alarm: { source: null, active: false, isPlaying: false, silenced: false, blocked: false },
  preview: { kind: null, isPlaying: false },
}

function createBrowserAudio(source: string) {
  return new Audio(source)
}

export class PomodoroAudioManager {
  private readonly audioFactory: AudioFactory
  private readonly listeners = new Set<() => void>()
  private snapshot: PomodoroAudioSnapshot = INITIAL_SNAPSHOT
  private ambienceAudio: HTMLAudioElement | null = null
  private ambienceSource: string | null = null
  private ambienceErrorCleanup: (() => void) | null = null
  private ambiencePlayPromise: Promise<AudioPlaybackResult> | null = null
  private ambienceGeneration = 0
  private ambienceSuspension: AmbienceResumeRequest | null = null
  private alarmAudio: HTMLAudioElement | null = null
  private alarmSource: string | null = null
  private alarmErrorCleanup: (() => void) | null = null
  private alarmPlayPromise: Promise<AudioPlaybackResult> | null = null
  private alarmGeneration = 0
  private alarmActive = false
  private previewAudio: HTMLAudioElement | null = null
  private previewErrorCleanup: (() => void) | null = null
  private previewGeneration = 0

  constructor(audioFactory: AudioFactory = createBrowserAudio) {
    this.audioFactory = audioFactory
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private notify() {
    for (const listener of this.listeners) listener()
  }

  private updateSnapshot(nextSnapshot: PomodoroAudioSnapshot) {
    if (
      this.snapshot.ambience.source === nextSnapshot.ambience.source
      && this.snapshot.ambience.isPlaying === nextSnapshot.ambience.isPlaying
      && this.snapshot.ambience.isMuted === nextSnapshot.ambience.isMuted
      && this.snapshot.ambience.blocked === nextSnapshot.ambience.blocked
      && this.snapshot.alarm.source === nextSnapshot.alarm.source
      && this.snapshot.alarm.active === nextSnapshot.alarm.active
      && this.snapshot.alarm.isPlaying === nextSnapshot.alarm.isPlaying
      && this.snapshot.alarm.silenced === nextSnapshot.alarm.silenced
      && this.snapshot.alarm.blocked === nextSnapshot.alarm.blocked
      && this.snapshot.preview.kind === nextSnapshot.preview.kind
      && this.snapshot.preview.isPlaying === nextSnapshot.preview.isPlaying
    ) return

    this.snapshot = nextSnapshot
    this.notify()
  }

  private createAudio(source: string, loop: boolean, onError: () => void) {
    const audio = this.audioFactory(source)
    audio.loop = loop
    audio.preload = 'auto'
    const handleError = () => onError()
    audio.addEventListener('error', handleError)
    audio.load()
    return {
      audio,
      cleanup: () => audio.removeEventListener('error', handleError),
    }
  }

  private releaseAudio(audio: HTMLAudioElement | null, cleanup: (() => void) | null) {
    cleanup?.()
    audio?.pause()
    if (audio) audio.currentTime = 0
  }

  private setAmbienceState(patch: Partial<PomodoroAudioSnapshot['ambience']>) {
    this.updateSnapshot({
      ...this.snapshot,
      ambience: { ...this.snapshot.ambience, ...patch },
    })
  }

  private setAlarmState(patch: Partial<PomodoroAudioSnapshot['alarm']>) {
    this.updateSnapshot({
      ...this.snapshot,
      alarm: { ...this.snapshot.alarm, ...patch },
    })
  }

  private setPreviewState(patch: Partial<PomodoroAudioSnapshot['preview']>) {
    this.updateSnapshot({
      ...this.snapshot,
      preview: { ...this.snapshot.preview, ...patch },
    })
  }

  private prepareAmbience(source: string, muted: boolean) {
    if (this.ambienceAudio && this.ambienceSource === source) {
      this.ambienceAudio.muted = muted
      this.setAmbienceState({ isMuted: muted })
      return this.ambienceAudio
    }

    this.stopAmbience()
    const prepared = this.createAudio(source, true, () => {
      if (this.ambienceAudio !== prepared.audio) return
      this.ambienceGeneration += 1
      this.ambiencePlayPromise = null
      prepared.audio.pause()
      this.setAmbienceState({ isPlaying: false, blocked: true })
    })
    prepared.audio.muted = muted
    this.ambienceAudio = prepared.audio
    this.ambienceSource = source
    this.ambienceErrorCleanup = prepared.cleanup
    this.setAmbienceState({ source, isPlaying: false, isMuted: muted, blocked: false })
    return prepared.audio
  }

  prepareAmbienceAudio(source: string | null, muted: boolean) {
    if (!source) {
      this.stopAmbience()
      return false
    }

    this.prepareAmbience(source, muted)
    return true
  }

  syncAmbienceSource(source: string | null, muted: boolean) {
    if (!source) {
      this.stopAmbience()
      return
    }

    if (this.ambienceSource === source) {
      if (this.ambienceAudio) this.ambienceAudio.muted = muted
      this.setAmbienceState({ isMuted: muted })
      return
    }

    const previousAudio = this.ambienceAudio
    const shouldResume = Boolean(previousAudio && (!previousAudio.paused || this.ambiencePlayPromise))
    this.stopAmbience()
    this.prepareAmbience(source, muted)
    if (shouldResume && !this.alarmActive) void this.startAmbience(source, muted)
  }

  private playAmbienceAudio(audio: HTMLAudioElement, muted: boolean, generation: number) {
    audio.muted = muted
    this.setAmbienceState({ isMuted: muted })

    if (this.ambiencePlayPromise) return this.ambiencePlayPromise
    if (!audio.paused && !audio.ended) {
      this.setAmbienceState({ isPlaying: true, blocked: false })
      return Promise.resolve<AudioPlaybackResult>('ready')
    }

    const playback = audio.play().then(() => {
      if (this.ambienceAudio === audio && this.ambienceGeneration === generation) {
        this.setAmbienceState({ isPlaying: !audio.paused, blocked: false })
      }
      return 'ready' as const
    }).catch(() => {
      if (this.ambienceAudio === audio && this.ambienceGeneration === generation) {
        this.setAmbienceState({ isPlaying: false, blocked: true })
      }
      return 'blocked' as const
    })
    this.ambiencePlayPromise = playback
    void playback.finally(() => {
      if (this.ambiencePlayPromise === playback) this.ambiencePlayPromise = null
    })
    return playback
  }

  startAmbience(source: string | null, muted: boolean): Promise<AudioPlaybackResult> {
    if (!source) return Promise.resolve('not-configured')
    if (this.alarmActive) return Promise.resolve('blocked')

    const audio = this.prepareAmbience(source, muted)
    const generation = this.ambienceGeneration
    return this.playAmbienceAudio(audio, muted, generation)
  }

  retryAmbience(source: string | null, muted: boolean) {
    return this.startAmbience(source, muted)
  }

  setAmbienceMuted(muted: boolean) {
    if (this.ambienceAudio) this.ambienceAudio.muted = muted
    this.setAmbienceState({ isMuted: muted })
  }

  stopAmbience() {
    this.ambienceGeneration += 1
    this.ambiencePlayPromise = null
    this.releaseAudio(this.ambienceAudio, this.ambienceErrorCleanup)
    this.ambienceAudio = null
    this.ambienceSource = null
    this.ambienceErrorCleanup = null
    this.setAmbienceState({ source: null, isPlaying: false, isMuted: false, blocked: false })
  }

  private suspendAmbience(existingRequest: AmbienceResumeRequest | null = null) {
    if (!this.ambienceAudio || !this.ambienceSource) {
      this.ambienceSuspension = existingRequest
      return existingRequest
    }

    const request = existingRequest ?? {
      source: this.ambienceSource,
      muted: this.ambienceAudio.muted,
      wasPlaying: Boolean(!this.ambienceAudio.paused || this.ambiencePlayPromise),
    }
    this.ambienceSuspension = request
    this.ambienceGeneration += 1
    this.ambiencePlayPromise = null
    this.ambienceAudio.pause()
    this.setAmbienceState({ isPlaying: false })
    return request
  }

  private prepareAlarm(source: string) {
    if (this.alarmAudio && this.alarmSource === source) return this.alarmAudio

    this.releaseAudio(this.alarmAudio, this.alarmErrorCleanup)
    this.alarmGeneration += 1
    this.alarmPlayPromise = null
    const prepared = this.createAudio(source, true, () => {
      if (this.alarmAudio !== prepared.audio) return
      this.alarmGeneration += 1
      this.alarmPlayPromise = null
      prepared.audio.pause()
      this.setAlarmState({ isPlaying: false, blocked: true })
    })
    this.alarmAudio = prepared.audio
    this.alarmSource = source
    this.alarmErrorCleanup = prepared.cleanup
    this.setAlarmState({ source, isPlaying: false, silenced: false, blocked: false })
    return prepared.audio
  }

  prepareAlarmAudio(source: string | null) {
    if (!source) return false
    this.prepareAlarm(source)
    return true
  }

  private playAlarmAudio(audio: HTMLAudioElement, generation: number) {
    audio.muted = false
    if (this.alarmPlayPromise) return this.alarmPlayPromise
    if (!audio.paused && !audio.ended) {
      this.setAlarmState({ isPlaying: true, blocked: false })
      return Promise.resolve<AudioPlaybackResult>('ready')
    }

    const playback = audio.play().then(() => {
      if (this.alarmAudio === audio && this.alarmGeneration === generation) {
        this.setAlarmState({ isPlaying: !audio.paused, blocked: false })
      }
      return 'ready' as const
    }).catch(() => {
      if (this.alarmAudio === audio && this.alarmGeneration === generation) {
        this.setAlarmState({ isPlaying: false, blocked: true })
      }
      return 'blocked' as const
    })
    this.alarmPlayPromise = playback
    void playback.finally(() => {
      if (this.alarmPlayPromise === playback) this.alarmPlayPromise = null
    })
    return playback
  }

  beginAlarm(source: string | null): Promise<AudioPlaybackResult> {
    if (!source) return Promise.resolve('not-configured')

    if (!this.alarmActive) {
      const previewRequest = this.stopPreview(false)
      this.suspendAmbience(previewRequest)
      this.alarmActive = true
    }
    const audio = this.prepareAlarm(source)
    this.setAlarmState({ active: true })
    if (this.snapshot.alarm.source === source && !audio.paused && !audio.ended) {
      return Promise.resolve('ready')
    }

    if (this.snapshot.alarm.source === source && audio.paused) audio.currentTime = 0
    this.alarmGeneration += 1
    this.setAlarmState({ silenced: false })
    return this.playAlarmAudio(audio, this.alarmGeneration)
  }

  retryAlarm(source: string | null) {
    if (!source || !this.alarmActive) return Promise.resolve('not-configured' as const)
    const audio = this.prepareAlarm(source)
    return this.playAlarmAudio(audio, this.alarmGeneration)
  }

  silenceAlarm() {
    if (!this.alarmAudio) return
    this.alarmGeneration += 1
    this.alarmPlayPromise = null
    this.alarmAudio.pause()
    this.setAlarmState({ isPlaying: false, silenced: true })
  }

  resumeAlarm(source: string | null) {
    if (!source || !this.alarmActive) return Promise.resolve('not-configured' as const)
    const audio = this.prepareAlarm(source)
    this.setAlarmState({ silenced: false })
    return this.playAlarmAudio(audio, this.alarmGeneration)
  }

  endAlarm(currentAmbienceSource: string | null = null) {
    this.alarmActive = false
    this.alarmGeneration += 1
    this.alarmPlayPromise = null
    this.alarmAudio?.pause()
    if (this.alarmAudio) this.alarmAudio.currentTime = 0
    this.setAlarmState({ active: false, isPlaying: false, silenced: false })

    const request = this.ambienceSuspension
    this.ambienceSuspension = null
    if (request?.wasPlaying && request.source === (currentAmbienceSource ?? this.ambienceSource)) {
      void this.startAmbience(request.source, request.muted)
    }
  }

  async startPreview(kind: PomodoroPreviewKind, source: string | null) {
    this.stopPreview()
    if (!source) return 'not-configured' as const

    const ambienceRequest = this.suspendAmbience()
    const prepared = this.createAudio(source, kind === 'ambience', () => {
      if (this.previewAudio !== prepared.audio) return
      this.setPreviewState({ isPlaying: false })
      this.stopPreview(false)
      if (ambienceRequest?.wasPlaying) this.ambienceSuspension = ambienceRequest
    })
    this.previewAudio = prepared.audio
    const handleEnded = () => {
      if (this.previewAudio === prepared.audio) this.stopPreview()
    }
    prepared.audio.addEventListener('ended', handleEnded)
    this.previewErrorCleanup = () => {
      prepared.cleanup()
      prepared.audio.removeEventListener('ended', handleEnded)
    }
    const generation = ++this.previewGeneration
    this.setPreviewState({ kind, isPlaying: false })

    try {
      await prepared.audio.play()
      if (this.previewAudio !== prepared.audio || this.previewGeneration !== generation) return 'blocked' as const
      this.setPreviewState({ isPlaying: true })
      return 'ready' as const
    } catch {
      if (this.previewAudio === prepared.audio && this.previewGeneration === generation) {
        this.setPreviewState({ isPlaying: false })
        this.stopPreview(false)
        if (ambienceRequest?.wasPlaying) this.ambienceSuspension = ambienceRequest
      }
      return 'blocked' as const
    }
  }

  stopPreview(restoreAmbience = true): AmbienceResumeRequest | null {
    const request = this.ambienceSuspension
    this.previewGeneration += 1
    this.releaseAudio(this.previewAudio, this.previewErrorCleanup)
    this.previewAudio = null
    this.previewErrorCleanup = null
    this.setPreviewState({ kind: null, isPlaying: false })
    this.ambienceSuspension = null
    if (restoreAmbience && request?.wasPlaying) {
      void this.startAmbience(request.source, request.muted)
    }
    return request
  }
}

export const pomodoroAudioManager = new PomodoroAudioManager()
