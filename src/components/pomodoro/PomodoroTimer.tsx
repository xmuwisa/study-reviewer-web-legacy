import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { Music2, Pause, Play, RotateCcw, Settings, VolumeX, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { AmbienceController } from './use-ambience-controller'
import type { PomodoroController } from './use-pomodoro-controller'
import { CALYX_CLIP_PATH, clampDuration, formatTimer, getCountdownAngle, getIndicatorAngle, getPointerAngle, LAUNCHER_TICK_MARKS, MAX_DURATION_MINUTES, MIN_DURATION_MINUTES, TIMER_MODES, TICK_MARKS } from './pomodoro-model'

function TomatoCalyx({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('absolute top-[11%] left-1/2 h-[15%] w-[27%] -translate-x-1/2', className)}>
      <span
        className="absolute top-0 left-1/2 h-[84%] w-[24%] -translate-x-1/2 bg-[var(--pomodoro-leaf)]"
        style={{ clipPath: CALYX_CLIP_PATH }}
      />
      <span
        className="absolute top-[8%] left-[20%] h-[70%] w-[30%] -rotate-[38deg] bg-[var(--pomodoro-leaf)]"
        style={{ clipPath: CALYX_CLIP_PATH }}
      />
      <span
        className="absolute top-[8%] right-[20%] h-[70%] w-[30%] rotate-[38deg] bg-[var(--pomodoro-leaf)]"
        style={{ clipPath: CALYX_CLIP_PATH }}
      />
      <span
        className="absolute top-[32%] left-[15%] h-[64%] w-[29%] -rotate-[76deg] bg-[var(--pomodoro-leaf)]"
        style={{ clipPath: CALYX_CLIP_PATH }}
      />
      <span
        className="absolute top-[32%] right-[15%] h-[64%] w-[29%] rotate-[76deg] bg-[var(--pomodoro-leaf)]"
        style={{ clipPath: CALYX_CLIP_PATH }}
      />
      <span className="absolute top-[30%] left-1/2 h-[58%] w-[12%] -translate-x-1/2 rotate-[16deg] rounded-full bg-[var(--pomodoro-leaf-deep)]" />
    </div>
  )
}

function TomatoDial({ duration, indicatorAngle, label, timerSeconds, onDurationChange }: { duration: number; indicatorAngle: number; label: string; timerSeconds: number; onDurationChange: (duration: number) => void }) {
  const pointerId = useRef<number | null>(null)
  const lastPointerAngle = useRef<number | null>(null)
  const dragDuration = useRef(duration)

  function updateFromPointer(event: PointerEvent<HTMLDivElement>) {
    const currentAngle = getPointerAngle(event)
    const previousAngle = lastPointerAngle.current
    if (previousAngle === null) {
      lastPointerAngle.current = currentAngle
      return
    }

    let angleDelta = currentAngle - previousAngle
    if (angleDelta > Math.PI) angleDelta -= Math.PI * 2
    if (angleDelta < -Math.PI) angleDelta += Math.PI * 2

    dragDuration.current = Math.min(
      MAX_DURATION_MINUTES,
      Math.max(MIN_DURATION_MINUTES, dragDuration.current + (angleDelta / (Math.PI * 2)) * (MAX_DURATION_MINUTES / 2)),
    )
    lastPointerAngle.current = currentAngle
    onDurationChange(clampDuration(dragDuration.current))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    pointerId.current = event.pointerId
    lastPointerAngle.current = getPointerAngle(event)
    dragDuration.current = duration
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return
    updateFromPointer(event)
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return
    pointerId.current = null
    lastPointerAngle.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 5 : 1
    let nextDuration = duration

    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextDuration += step
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextDuration -= step
    if (event.key === 'PageUp') nextDuration += 5
    if (event.key === 'PageDown') nextDuration -= 5
    if (event.key === 'Home') nextDuration = MIN_DURATION_MINUTES
    if (event.key === 'End') nextDuration = MAX_DURATION_MINUTES

    const clampedDuration = clampDuration(nextDuration)
    if (clampedDuration === duration) return

    event.preventDefault()
    onDurationChange(clampedDuration)
  }

  return (
    <div
      aria-label="Session duration"
      aria-valuemax={MAX_DURATION_MINUTES}
      aria-valuemin={MIN_DURATION_MINUTES}
      aria-valuenow={duration}
      aria-valuetext={`${duration} minutes`}
      className="relative mx-auto aspect-square w-full max-w-[20rem] touch-none select-none rounded-full outline-none transition-transform active:scale-[0.995] focus-visible:ring-4 focus-visible:ring-[var(--pomodoro-control)]/40"
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      role="slider"
      tabIndex={0}
    >
      <div className="absolute inset-0 rounded-full bg-[var(--pomodoro-ring)] shadow-[0_22px_40px_-28px_rgb(0_0_0_/_0.9)]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          {TICK_MARKS.map((tick) => (
            <span className="absolute inset-0 flex justify-center" key={tick} style={{ transform: `rotate(${tick * 6}deg)` }}>
              <span
                className={cn(
                  'mt-[3.5%] block rounded-full bg-[var(--pomodoro-tick)]',
                  tick % 5 === 0 ? 'h-[4.5%] w-[0.7%]' : 'h-[2.3%] w-[0.35%]',
                )}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-[5.5%] overflow-hidden rounded-full">
          <div className="pomodoro-tomato-face absolute inset-0 rounded-full">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 transition-transform duration-200 ease-out"
              style={{ transform: `rotate(${indicatorAngle}deg)` }}
            >
              <div className="absolute top-[5%] left-1/2 h-[45%] w-[1.3%] -translate-x-1/2 rounded-full bg-white/90" />
            </div>
            <TomatoCalyx />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white">
              <span aria-live="polite" className="font-sans text-[clamp(3rem,8.4vw,5rem)] font-medium leading-none tracking-[-0.065em] tabular-nums lg:text-[clamp(2.4rem,7.2vw,4.6rem)]">
                {formatTimer(timerSeconds)}
              </span>
              <span className="mt-3 text-[clamp(0.68rem,1.7vw,0.95rem)] font-medium uppercase tracking-[0.14em] text-white/85">
                {label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PomodoroLauncher({ controller, ambience, open, onClick, onEnableSound }: { controller: PomodoroController; ambience: AmbienceController; open: boolean; onClick: () => void; onEnableSound: () => void }) {
  const soundBlocked = controller.audioBlocked || ambience.audioBlocked

  return (
    <div className="fixed right-4 bottom-6 z-50 sm:right-7 sm:bottom-8">
      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          size="icon-lg"
          variant="ghost"
          data-ambience-toggle
          aria-label={ambience.isPlaying ? 'Turn ambience off' : 'Turn ambience on'}
          className="size-14 shrink-0 rounded-full bg-[var(--pomodoro-control)] text-[var(--primary-foreground)] shadow-[0_16px_30px_-18px_rgb(0_0_0_/_0.95)] transition-transform hover:scale-105 hover:bg-[var(--pomodoro-control)]/90 hover:text-[var(--primary-foreground)]"
          disabled={!ambience.available}
          onClick={ambience.toggle}
        >
          {ambience.isPlaying ? <VolumeX aria-hidden="true" /> : <Music2 aria-hidden="true" />}
        </Button>
        <div className="relative">
          {!open && (soundBlocked || controller.alarmActive) ? (
            <div className="absolute top-1/2 right-full mr-2 flex -translate-y-1/2 items-center gap-2" aria-label="Pomodoro audio and alarm actions">
              {soundBlocked && <Button type="button" size="sm" variant="outline" onClick={onEnableSound}>Enable sound</Button>}
              {controller.alarmActive && <>
                <Button type="button" size="sm" variant="secondary" className="bg-[var(--pomodoro-ink)] font-semibold text-[var(--pomodoro-panel)] shadow-[0_16px_30px_-18px_rgb(0_0_0_/_0.95)] hover:bg-[var(--pomodoro-ink)]/90 hover:text-[var(--pomodoro-panel)]" onClick={controller.stopAlarm}>Stop</Button>
                <Button type="button" size="sm" className="bg-[var(--pomodoro-control)] text-[var(--primary-foreground)] shadow-[0_16px_30px_-18px_rgb(0_0_0_/_0.95)] hover:bg-[var(--pomodoro-control)]/90" onClick={controller.snoozeAlarm}>Snooze</Button>
              </>}
            </div>
          ) : !open && controller.isRunning ? (
            <div aria-live="polite" className="absolute top-1/2 right-full mr-2 flex -translate-y-1/2 items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--pomodoro-ink)_14%,transparent)] bg-[var(--pomodoro-panel)] px-3 py-2 text-right shadow-[0_16px_30px_-18px_rgb(0_0_0_/_0.95)]">
              <span className="text-sm font-semibold tabular-nums text-[var(--pomodoro-ink)]">{controller.remainingLabel}</span>
              <span className="max-w-24 truncate text-xs text-[var(--pomodoro-muted)]">{controller.modeLabel}</span>
            </div>
          ) : null}
          <Button
            type="button"
            size="icon-lg"
            data-pomodoro-launcher
            aria-expanded={open}
            aria-label={open ? 'Close Pomodoro timer' : controller.alarmActive ? 'Open Pomodoro timer with active alarm' : 'Open Pomodoro timer'}
            className={cn(
              'relative aspect-square size-16 shrink-0 overflow-hidden rounded-full border-[3px] border-[var(--pomodoro-ring)] bg-[var(--pomodoro-ring)] p-0 shadow-[0_16px_30px_-18px_rgb(0_0_0_/_0.95)] transition-transform hover:scale-105 hover:bg-[var(--pomodoro-ring)]',
              controller.alarmActive && 'pomodoro-alarm-pulse',
            )}
            onClick={onClick}
          >
            <span className="pomodoro-tomato-face absolute inset-[7%] overflow-hidden rounded-full">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex justify-center">
                {LAUNCHER_TICK_MARKS.map((tick) => (
                  <span className="absolute inset-0 flex justify-center" key={tick} style={{ transform: `rotate(${tick * 22.5}deg)` }}>
                    <span className="mt-[3%] block h-[11%] w-[3%] rounded-full bg-[var(--pomodoro-tick)]" />
                  </span>
                ))}
              </span>
              <TomatoCalyx className="top-[13%] h-[38%] w-[68%]" />
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PomodoroTimer({ controller, onClose, onOpenSettings }: { controller: PomodoroController; onClose: () => void; onOpenSettings: () => void }) {
  const { mode, duration, preciseDuration, isRunning, hasStarted, remainingSeconds, indicatorDurationMinutes, alarmActive, setDurationValue, handleModeChange, handleReset, handlePlayPause, handlePreciseDurationChange, commitPreciseDuration, stopAlarm, snoozeAlarm } = controller
  const indicatorAngle = hasStarted ? getCountdownAngle(remainingSeconds, indicatorDurationMinutes) : getIndicatorAngle(duration)

  return (
    <Card className="pomodoro-panel relative my-auto w-full max-w-3xl overflow-hidden rounded-none border-0 px-1 py-1 lg:my-0 lg:rounded-[2rem] lg:border">
      {alarmActive && (
        <div
          aria-labelledby="pomodoro-alarm-title"
          aria-modal="true"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[color-mix(in_oklab,var(--pomodoro-panel)_82%,transparent)] p-6 text-center backdrop-blur-sm"
          role="alertdialog"
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--pomodoro-muted)]">Session complete</p>
            <h2 id="pomodoro-alarm-title" className="font-heading text-2xl font-semibold tracking-tight text-[var(--pomodoro-ink)] sm:text-3xl">Time for a transition</h2>
          </div>
          <div className="flex w-full max-w-sm gap-3">
            <Button type="button" variant="secondary" className="min-w-0 flex-1 bg-[var(--pomodoro-ink)] font-semibold text-[var(--pomodoro-panel)] shadow-[0_8px_24px_-16px_rgb(0_0_0_/_0.9)] hover:bg-[var(--pomodoro-ink)]/90 hover:text-[var(--pomodoro-panel)]" onClick={stopAlarm}>Stop</Button>
            <Button type="button" className="min-w-0 flex-1 bg-[var(--pomodoro-control)] text-[var(--primary-foreground)] hover:bg-[var(--pomodoro-control)]/90" onClick={snoozeAlarm}>Snooze</Button>
          </div>
        </div>
      )}
      <CardHeader className="relative w-full gap-2 px-5 pb-0 pt-6 text-left sm:px-8 sm:pt-7">
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 sm:top-5 sm:right-5">
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Close Pomodoro panel" className="rounded-full bg-[var(--pomodoro-panel-raised)] text-[var(--pomodoro-ink)] hover:bg-[var(--pomodoro-panel-raised)] hover:text-[var(--pomodoro-ink)] focus-visible:ring-[var(--pomodoro-control)]/50" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Open Pomodoro settings" className="rounded-full bg-[var(--pomodoro-panel-raised)] text-[var(--pomodoro-ink)] hover:bg-[var(--pomodoro-panel-raised)] hover:text-[var(--pomodoro-ink)] focus-visible:ring-[var(--pomodoro-control)]/50" onClick={onOpenSettings}>
            <Settings aria-hidden="true" />
          </Button>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--pomodoro-muted)]">Pomodoro</p>
        <CardTitle className="font-heading text-2xl font-semibold tracking-tight text-[var(--pomodoro-ink)] sm:text-3xl">Set your session length</CardTitle>
        <p className="max-w-xl text-base leading-relaxed text-[var(--pomodoro-muted)]">Customize your focus and break sessions to fit your study routine.</p>
        <ToggleGroup value={[mode]} onValueChange={handleModeChange} aria-label="Pomodoro timer mode" className="w-full gap-1 bg-transparent p-0 sm:w-fit">
          {Object.entries(TIMER_MODES).map(([value, timerMode]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl px-3.5 py-2.5 text-base font-medium text-[var(--pomodoro-muted)] transition-colors hover:bg-[var(--pomodoro-panel-raised)] hover:text-[var(--pomodoro-ink)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--pomodoro-control)]/50 aria-pressed:bg-[var(--pomodoro-panel-raised)] aria-pressed:text-[var(--pomodoro-ink)] sm:flex-none"
            >
              {timerMode.modeLabel}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>

      <CardContent className="flex w-full flex-col items-stretch gap-5 px-5 pb-6 pt-4 sm:gap-6 sm:px-8 sm:pb-7">
        <TomatoDial duration={duration} indicatorAngle={indicatorAngle} label={TIMER_MODES[mode].label} timerSeconds={remainingSeconds} onDurationChange={setDurationValue} />

        <div className="flex w-full max-w-3xl flex-col gap-5">
          <div className="flex w-full gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-w-0 flex-1 border-[color-mix(in_oklab,var(--pomodoro-ink)_15%,transparent)] bg-[var(--pomodoro-panel-raised)] text-[var(--pomodoro-ink)] hover:bg-[var(--pomodoro-panel-raised)] hover:text-[var(--pomodoro-ink)] dark:bg-[var(--pomodoro-panel-raised)] dark:hover:bg-[var(--pomodoro-panel-raised)]"
              onClick={handlePlayPause}
            >
              {isRunning ? <Pause aria-hidden="true" data-icon="inline-start" /> : <Play aria-hidden="true" data-icon="inline-start" />}
              {isRunning ? 'Pause' : 'Play'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-0 flex-1 border-[color-mix(in_oklab,var(--pomodoro-ink)_15%,transparent)] bg-muted/60 text-[var(--pomodoro-muted)] hover:bg-muted hover:text-[var(--pomodoro-ink)]"
              onClick={handleReset}
            >
              <RotateCcw aria-hidden="true" data-icon="inline-start" />
              Reset
            </Button>
          </div>

          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-base font-semibold text-[var(--pomodoro-ink)]">Session length</p>
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  aria-label="Session duration in minutes"
                  className="h-11 w-20 text-center font-normal text-base tabular-nums text-[var(--pomodoro-ink)] placeholder:text-[var(--pomodoro-muted)]"
                  id="pomodoro-duration-input"
                  inputMode="numeric"
                  max={MAX_DURATION_MINUTES}
                  min={MIN_DURATION_MINUTES}
                  onBlur={commitPreciseDuration}
                  onChange={(event) => handlePreciseDurationChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
                  type="number"
                  value={preciseDuration}
                />
                <span className="text-base font-normal tabular-nums text-[var(--pomodoro-ink)]">minutes</span>
              </div>
            </div>
            <Slider
              aria-label="Session length"
              className="pomodoro-slider py-3"
              id="pomodoro-duration-slider"
              max={MAX_DURATION_MINUTES}
              min={MIN_DURATION_MINUTES}
              onValueChange={(value) => setDurationValue(Array.isArray(value) ? value[0] ?? duration : value)}
              step={1}
              value={[duration]}
            />
            <div className="flex justify-between text-base text-[var(--pomodoro-muted)]">
              <span>1 minute</span>
              <span>120 minutes</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
