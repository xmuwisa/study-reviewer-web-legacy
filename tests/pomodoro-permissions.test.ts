import { expect, test } from 'bun:test'

import {
  combineAudioInitializationResults,
  getAudioSetupFeedback,
} from '../src/lib/pomodoro-permissions'
import { getPomodoroDocumentTitle } from '../src/components/pomodoro/pomodoro-model'
import { getPomodoroAlarmOption } from '../src/lib/pomodoro-audio'

test('audio setup reports blocked playback before configured playback', () => {
  expect(combineAudioInitializationResults('not-configured', 'blocked')).toBe('blocked')
  expect(combineAudioInitializationResults('not-configured', 'initialized')).toBe('initialized')
  expect(combineAudioInitializationResults('not-configured', 'played')).toBe('initialized')
  expect(combineAudioInitializationResults('not-configured', 'not-configured')).toBe('not-configured')
})

test('audio setup feedback distinguishes unconfigured and blocked sound', () => {
  expect(getAudioSetupFeedback('not-configured').kind).toBe('success')
  expect(getAudioSetupFeedback('blocked').kind).toBe('error')
  expect(getAudioSetupFeedback('initialized').message).toContain('Audible playback will be checked')
})

test('saved Happy Bells selection resolves to the shipped alarm asset', () => {
  expect(getPomodoroAlarmOption('happy-bells-alarm')).toMatchObject({
    label: 'Happy Bells',
    src: '/audio/alarms/happy-bells-alarm.wav',
  })
})

test('audio setup feedback does not claim audible playback is guaranteed', () => {
  expect(getAudioSetupFeedback('initialized')).toEqual({
    kind: 'success',
    message: 'Audio interaction was initialized. Audible playback will be checked when a sound starts.',
  })
})

test('Pomodoro document title follows the timestamp-derived controller state', () => {
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: true, mode: 'focus', remainingLabel: '24:35' })).toBe('🍅 24:35 · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: true, mode: 'short-break', remainingLabel: '04:35' })).toBe('☕ 04:35 · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: true, isRunning: false, mode: 'focus', remainingLabel: '00:00' })).toBe('🔔 Focus Complete · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: true, isRunning: false, mode: 'long-break', remainingLabel: '00:00' })).toBe('🔔 Break Complete · Study Reviewer')
  expect(getPomodoroDocumentTitle({ alarmActive: false, isRunning: false, mode: 'focus', remainingLabel: '24:35' })).toBe('Study Reviewer')
})
