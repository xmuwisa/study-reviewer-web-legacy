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

type CollectionDeleteDialogProps = {
  kind: 'category' | 'topic'
  name?: string
  count?: number
  topicCount?: number
  entryCount?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => boolean
}

export function CollectionDeleteDialog({
  kind,
  name,
  count,
  topicCount = 0,
  entryCount,
  open,
  onOpenChange,
  onConfirm,
}: CollectionDeleteDialogProps) {
  const isCategory = kind === 'category'
  const isBulk = typeof count === 'number'
  const collectionLabel = isCategory ? 'category' : 'topic'
  const collectionLabelPlural = isCategory ? 'categories' : 'topics'
  const nestedSummary = isCategory
    ? `${topicCount} ${topicCount === 1 ? 'topic' : 'topics'} and ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
    : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`

  function handleConfirm() {
    if (onConfirm()) onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isBulk ? `Delete ${count} ${collectionLabelPlural}?` : `Delete ${isCategory ? 'category' : 'topic'}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>This will permanently remove <strong className="font-semibold text-foreground">{count} selected {collectionLabelPlural}</strong> and their associated {isCategory ? 'topics and entries' : 'entries'}. This action cannot be undone.</>
            ) : (
              <>This will permanently remove <strong className="font-semibold text-foreground">{name}</strong> and its {nestedSummary}. This action cannot be undone.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm}>{isBulk ? `Delete ${count} ${count === 1 ? collectionLabel : collectionLabelPlural}` : `Delete ${isCategory ? 'category' : 'topic'}`}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
