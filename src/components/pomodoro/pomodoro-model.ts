import type { PointerEvent } from 'react'

import type { PomodoroMode } from '@/lib/study-data'

export const MIN_DURATION_MINUTES = 1
export const MAX_DURATION_MINUTES = 120
export const MAX_INDICATOR_ANGLE = 720
export const TICK_MARKS = Array.from({ length: 60 }, (_, index) => index)
export const LAUNCHER_TICK_MARKS = Array.from({ length: 16 }, (_, index) => index)
export const CALYX_CLIP_PATH = 'polygon(50% 0%, 100% 100%, 50% 78%, 0% 100%)'
export type PomodoroDurationKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'

export const TIMER_MODES: Record<PomodoroMode, { durationKey: PomodoroDurationKey; label: string; modeLabel: string }> = {
  focus: { durationKey: 'focusMinutes', label: 'Focus timer', modeLabel: 'Focus' },
  'short-break': { durationKey: 'shortBreakMinutes', label: 'Short break timer', modeLabel: 'Short Break' },
  'long-break': { durationKey: 'longBreakMinutes', label: 'Long break timer', modeLabel: 'Long Break' },
}

export function clampDuration(value: number) {
  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, Math.round(value)))
}

export function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function getPomodoroDocumentTitle({ alarmActive, isRunning, mode, remainingLabel }: { alarmActive: boolean; isRunning: boolean; mode: PomodoroMode; remainingLabel: string }) {
  if (alarmActive) return `🔔 ${mode === 'focus' ? 'Focus' : 'Break'} Complete · Study Reviewer`
  if (!isRunning) return 'Study Reviewer'
  return `${mode === 'focus' ? '🍅' : '☕'} ${remainingLabel} · Study Reviewer`
}

export function getIndicatorAngle(minutes: number) {
  return Math.min(MAX_INDICATOR_ANGLE, Math.max(0, (minutes / MAX_DURATION_MINUTES) * MAX_INDICATOR_ANGLE))
}

export function getCountdownAngle(remainingSeconds: number, durationMinutes: number) {
  const totalSeconds = Math.max(1, durationMinutes * 60)
  const remainingRatio = Math.min(1, Math.max(0, remainingSeconds / totalSeconds))
  return remainingRatio * getIndicatorAngle(durationMinutes)
}

export function getPointerAngle(event: PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = event.clientX - (bounds.left + bounds.width / 2)
  const y = event.clientY - (bounds.top + bounds.height / 2)
  return Math.atan2(x, -y)
}
