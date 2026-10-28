import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type EntryDeleteDialogProps = {
  question?: string
  count?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => boolean
}

export function EntryDeleteDialog({ question, count, open, onOpenChange, onConfirm }: EntryDeleteDialogProps) {
  function handleConfirm() {
    if (onConfirm()) onOpenChange(false)
  }

  const isBulk = typeof count === 'number'
  const entryLabel = count === 1 ? 'entry' : 'entries'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isBulk ? `Delete ${count} ${entryLabel}?` : 'Delete entry?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>This will permanently remove <strong className="font-semibold text-foreground">{count} selected {entryLabel}</strong> from this topic. This action cannot be undone.</>
            ) : (
              <>This will permanently remove <strong className="font-semibold text-foreground">{question}</strong> from this topic. This action cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm}>{isBulk ? `Delete ${count} ${entryLabel}` : 'Delete entry'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
