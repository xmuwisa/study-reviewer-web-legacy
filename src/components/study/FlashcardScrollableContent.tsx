import { ChevronsDown } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FlashcardScrollableContentProps = {
  ariaLabel: string
  children: ReactNode
  className?: string
}

export function FlashcardScrollableContent({ ariaLabel, children, className }: FlashcardScrollableContentProps) {
  const scrollportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const pointerStartScrollTopRef = useRef<number | null>(null)
  const didScrollRef = useRef(false)
  const [showScrollHint, setShowScrollHint] = useState(false)

  const updateScrollHint = useCallback(() => {
    const scrollport = scrollportRef.current
    if (!scrollport) {
      setShowScrollHint(false)
      return
    }

    const maxScrollTop = Math.max(scrollport.scrollHeight - scrollport.clientHeight, 0)
    setShowScrollHint(maxScrollTop > 1 && scrollport.scrollTop < maxScrollTop - 1)
  }, [])

  useLayoutEffect(() => {
    const scrollport = scrollportRef.current
    if (!scrollport) return

    updateScrollHint()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollHint)
    resizeObserver?.observe(scrollport)
    if (contentRef.current) resizeObserver?.observe(contentRef.current)
    scrollport.addEventListener('scroll', updateScrollHint, { passive: true })
    window.addEventListener('resize', updateScrollHint)

    return () => {
      resizeObserver?.disconnect()
      scrollport.removeEventListener('scroll', updateScrollHint)
      window.removeEventListener('resize', updateScrollHint)
    }
  }, [children, updateScrollHint])

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
    <div className="relative min-h-0 w-full flex-1">
      <div
        ref={scrollportRef}
        className="h-full min-h-0 overflow-y-auto"
        onClick={handleClick}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div ref={contentRef} className={cn('flex min-h-full w-full flex-col', className, showScrollHint && 'pb-14')}>
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
    </div>
  )
}
