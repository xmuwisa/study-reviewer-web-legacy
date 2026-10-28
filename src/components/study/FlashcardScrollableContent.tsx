import { ChevronsDown } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FlashcardScrollableContentProps = {
  active?: boolean
  ariaLabel: string
  children: ReactNode
  className?: string
}

export function FlashcardScrollableContent({ active = true, ariaLabel, children, className }: FlashcardScrollableContentProps) {
  const scrollportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const pointerStartScrollTopRef = useRef<number | null>(null)
  const didScrollRef = useRef(false)
  const wasAtBottomRef = useRef(false)
  const [showScrollHint, setShowScrollHint] = useState(false)

  const updateScrollHint = useCallback(() => {
    const scrollport = scrollportRef.current
    const content = contentRef.current
    if (!active || !scrollport || !content) {
      setShowScrollHint(false)
      return
    }

    const scrollportBottom = scrollport.getBoundingClientRect().bottom
    const contentBottom = content.lastElementChild?.getBoundingClientRect().bottom ?? scrollportBottom
    const hasMoreContent = contentBottom > scrollportBottom + 1
    const isAtBottom = scrollport.scrollTop + scrollport.clientHeight >= scrollport.scrollHeight - 1
    if (isAtBottom) wasAtBottomRef.current = true
    setShowScrollHint(hasMoreContent && !isAtBottom)
  }, [active])

  useLayoutEffect(() => {
    const scrollport = scrollportRef.current
    const content = contentRef.current
    if (!active || !scrollport || !content) {
      setShowScrollHint(false)
      return
    }

    updateScrollHint()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollHint)
    resizeObserver?.observe(scrollport)
    resizeObserver?.observe(content)
    scrollport.addEventListener('scroll', updateScrollHint, { passive: true })
    window.addEventListener('resize', updateScrollHint)

    return () => {
      resizeObserver?.disconnect()
      scrollport.removeEventListener('scroll', updateScrollHint)
      window.removeEventListener('resize', updateScrollHint)
    }
  }, [active, updateScrollHint])

  useLayoutEffect(() => {
    const scrollport = scrollportRef.current
    if (!active || showScrollHint || !wasAtBottomRef.current || !scrollport) return

    scrollport.scrollTop = scrollport.scrollHeight
    wasAtBottomRef.current = false
    updateScrollHint()
  }, [active, showScrollHint, updateScrollHint])

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const scrollport = scrollportRef.current
    if (!scrollport || scrollport.scrollHeight <= scrollport.clientHeight + 1) return

    pointerStartScrollTopRef.current = scrollport.scrollTop
    didScrollRef.current = false
    event.stopPropagation()
  }

  function handlePointerUp() {
    const scrollport = scrollportRef.current
    if (scrollport && pointerStartScrollTopRef.current !== null && scrollport.scrollTop !== pointerStartScrollTopRef.current) {
      didScrollRef.current = true
    }
    pointerStartScrollTopRef.current = null
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!didScrollRef.current) return
    didScrollRef.current = false
    event.stopPropagation()
  }

  return (
    <>
      <div
        ref={scrollportRef}
        className={cn('flex min-h-0 w-full flex-1 flex-col overflow-y-auto', showScrollHint ? 'pb-14' : 'pb-4')}
        onClick={handleClick}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div ref={contentRef} className={cn('flex w-full shrink-0 flex-col', className)}>
          {children}
        </div>
      </div>
      {showScrollHint && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flashcard-scroll-hint absolute right-4 bottom-6 bg-transparent text-foreground shadow-none hover:bg-transparent hover:text-foreground"
          aria-label={ariaLabel}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            scrollportRef.current?.scrollTo({ top: scrollportRef.current.scrollHeight, behavior: 'smooth' })
          }}
        >
          <ChevronsDown aria-hidden="true" data-icon="inline-start" className="size-7" />
        </Button>
      )}
    </>
  )
}
