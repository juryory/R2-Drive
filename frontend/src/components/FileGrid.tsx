import { FileSystemItem, FileItem } from '../types'
import FileCard from './FileCard'

interface Props {
  items: FileSystemItem[]
  selectedKeys: Set<string>
  onSelect: (key: string) => void
  onOpen: (item: FileSystemItem) => void
  onDownload: (item: FileItem) => void
  onDelete: (item: FileSystemItem) => void
  onRename: (item: FileSystemItem) => void
  onCopyLink: (item: FileItem) => void
}

export default function FileGrid({
  items,
  selectedKeys,
  onSelect,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onCopyLink,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
        {items.map((item) => (
          <FileCard
            key={item.key}
            item={item}
            selected={selectedKeys.has(item.key)}
            onSelect={() => onSelect(item.key)}
            onOpen={() => onOpen(item)}
            onDownload={item.type === 'file' ? () => onDownload(item as FileItem) : undefined}
            onDelete={() => onDelete(item)}
            onRename={() => onRename(item)}
            onCopyLink={item.type === 'file' ? () => onCopyLink(item as FileItem) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
