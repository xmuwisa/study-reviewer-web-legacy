import type { AudioInitializationResult, AudioPlaybackResult } from './pomodoro-permissions'

export type AlarmAudioFactory = (source: string) => HTMLAudioElement

export type PomodoroAlarmSnapshot = {
  source: string | null
  active: boolean
  isPlaying: boolean
  silenced: boolean
  blocked: boolean
}

const INITIAL_SNAPSHOT: PomodoroAlarmSnapshot = {
  source: null,
  active: false,
  isPlaying: false,
  silenced: false,
  blocked: false,
}

export class PomodoroAlarmPlayer {
  private readonly audioFactory: AlarmAudioFactory
  private readonly onSnapshot: (snapshot: PomodoroAlarmSnapshot) => void
  private snapshot = INITIAL_SNAPSHOT
  private audio: HTMLAudioElement | null = null
  private source: string | null = null
  private errorCleanup: (() => void) | null = null
  private playPromise: Promise<AudioPlaybackResult> | null = null
  private initializationPromise: Promise<AudioInitializationResult> | null = null
  private generation = 0
  private activeSessionKey: string | null = null
  private initializedSource: string | null = null

  constructor(audioFactory: AlarmAudioFactory, onSnapshot: (snapshot: PomodoroAlarmSnapshot) => void = () => {}) {
    this.audioFactory = audioFactory
    this.onSnapshot = onSnapshot
  }

  getSnapshot = () => this.snapshot

  private updateSnapshot(patch: Partial<PomodoroAlarmSnapshot>) {
    const nextSnapshot = { ...this.snapshot, ...patch }
    if (
      this.snapshot.source === nextSnapshot.source
      && this.snapshot.active === nextSnapshot.active
      && this.snapshot.isPlaying === nextSnapshot.isPlaying
      && this.snapshot.silenced === nextSnapshot.silenced
      && this.snapshot.blocked === nextSnapshot.blocked
    ) return

    this.snapshot = nextSnapshot
    this.onSnapshot(nextSnapshot)
  }

  private resetAudio() {
    this.audio?.pause()
    if (this.audio) {
      this.audio.currentTime = 0
      this.audio.muted = false
    }
  }

  private releaseAudio() {
    this.errorCleanup?.()
    this.resetAudio()
    this.errorCleanup = null
  }

  private handleMediaError(audio: HTMLAudioElement) {
    if (this.audio !== audio) return

    this.generation += 1
    this.playPromise = null
    this.initializationPromise = null
    this.initializedSource = null
    audio.pause()
    this.updateSnapshot({ isPlaying: false, blocked: true })
  }

  private ensureAudio(source: string) {
    if (this.audio && this.source === source) return this.audio

    this.releaseAudio()
    this.generation += 1
    this.playPromise = null
    this.initializationPromise = null
    this.initializedSource = null

    const audio = this.audioFactory(source)
    audio.loop = true
    audio.preload = 'auto'
    const handleError = () => this.handleMediaError(audio)
    audio.addEventListener('error', handleError)
    audio.load()

    this.audio = audio
    this.source = source
    this.errorCleanup = () => audio.removeEventListener('error', handleError)
    this.updateSnapshot({ source, active: false, isPlaying: false, silenced: false, blocked: false })
    return audio
  }

  initialize(source: string | null): Promise<AudioInitializationResult> {
    if (!source) return Promise.resolve('not-configured')

    const audio = this.ensureAudio(source)
    if (this.initializedSource === source && !this.snapshot.blocked) return Promise.resolve('initialized')
    if (this.initializationPromise) return this.initializationPromise

    const generation = ++this.generation
    audio.muted = true
    const initialization = audio.play().then(() => {
      if (this.audio === audio && this.generation === generation) {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
        this.initializedSource = source
        this.updateSnapshot({ blocked: false })
      }
      return 'initialized' as const
    }).catch(() => {
      if (this.audio === audio && this.generation === generation) {
        audio.pause()
        audio.muted = false
        this.initializedSource = null
        this.updateSnapshot({ isPlaying: false, blocked: true })
      }
      return 'blocked' as const
    })

    this.initializationPromise = initialization
    void initialization.then(() => {
      if (this.initializationPromise === initialization) this.initializationPromise = null
    })
    return initialization
  }

  play(source: string | null, sessionKey: string | null = null): Promise<AudioPlaybackResult> {
    if (!source) return Promise.resolve('not-configured')

    const audio = this.ensureAudio(source)
    const pendingInitialization = this.initializationPromise

    if (this.snapshot.active && this.activeSessionKey === sessionKey && this.source === source) {
      if (this.playPromise) return this.playPromise
      if (!audio.paused && !audio.ended) {
        this.updateSnapshot({ isPlaying: true, blocked: false, silenced: false })
        return Promise.resolve('played')
      }
    }

    this.activeSessionKey = sessionKey
    this.updateSnapshot({ active: true, source, isPlaying: false, silenced: false, blocked: false })

    if (pendingInitialization) {
      return pendingInitialization.then(() => this.play(source, sessionKey))
    }

    const generation = ++this.generation
    audio.muted = false
    const playback = audio.play().then(() => {
      if (this.audio === audio && this.generation === generation) {
        this.updateSnapshot({ isPlaying: !audio.paused, blocked: false, silenced: false })
      }
      return 'played' as const
    }).catch(() => {
      if (this.audio === audio && this.generation === generation) {
        this.updateSnapshot({ isPlaying: false, blocked: true })
      }
      return 'blocked' as const
    })

    this.playPromise = playback
    void playback.then(() => {
      if (this.playPromise === playback) this.playPromise = null
    })
    return playback
  }

  retry(source: string | null) {
    if (!source || !this.snapshot.active) return Promise.resolve('not-configured' as const)
    return this.play(source, this.activeSessionKey)
  }

  silence() {
    if (!this.audio || !this.snapshot.active) return

    this.generation += 1
    this.playPromise = null
    this.audio.pause()
    this.updateSnapshot({ isPlaying: false, silenced: true })
  }

  resume(source: string | null) {
    if (!source || !this.snapshot.active) return Promise.resolve('not-configured' as const)
    return this.play(source, this.activeSessionKey)
  }

  stop() {
    this.generation += 1
    this.playPromise = null
    this.initializationPromise = null
    this.activeSessionKey = null
    this.resetAudio()
    this.updateSnapshot({ active: false, isPlaying: false, silenced: false, blocked: false })
  }
}
