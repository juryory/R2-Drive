import { Download, Trash2, Pencil, Link, MoreVertical, Eye } from 'lucide-react'
import { useState } from 'react'
import { FileSystemItem, FileItem } from '../types'
import { cn, formatBytes, formatDate, isImage } from '../lib/utils'
import FileIcon from './FileIcon'
import { api } from '../lib/api'

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

function ActionMenu({
  item,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onCopyLink,
}: {
  item: FileSystemItem
  onOpen: () => void
  onDownload?: () => void
  onDelete: () => void
  onRename: () => void
  onCopyLink?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition opacity-0 group-hover:opacity-100"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 animate-fade-in" style={{ top: '100%' }}>
            {item.type === 'file' && (
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen() }}>
                <Eye className="w-4 h-4 text-slate-400" />预览
              </button>
            )}
            {item.type === 'file' && onDownload && (
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onDownload() }}>
                <Download className="w-4 h-4 text-slate-400" />下载
              </button>
            )}
            {item.type === 'file' && onCopyLink && (
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onCopyLink() }}>
                <Link className="w-4 h-4 text-slate-400" />复制链接
              </button>
            )}
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onRename() }}>
              <Pencil className="w-4 h-4 text-slate-400" />重命名
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}>
              <Trash2 className="w-4 h-4" />删除
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function FileList({
  items, selectedKeys, onSelect, onOpen, onDownload, onDelete, onRename, onCopyLink,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
          <tr>
            <th className="w-10 pl-4 py-2" />
            <th className="text-left text-xs font-medium text-slate-500 py-2 px-3">名称</th>
            <th className="text-left text-xs font-medium text-slate-500 py-2 px-3 hidden sm:table-cell w-24">大小</th>
            <th className="text-left text-xs font-medium text-slate-500 py-2 px-3 hidden md:table-cell w-40">修改时间</th>
            <th className="w-10 pr-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const isFile = item.type === 'file'
            const file = isFile ? (item as FileItem) : null
            const selected = selectedKeys.has(item.key)
            const showThumbnail = file && isImage(file.contentType, file.name)

            return (
              <tr
                key={item.key}
                className={cn(
                  'group cursor-pointer transition-colors',
                  selected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'
                )}
                onClick={() => onOpen(item)}
              >
                {/* 复选框 */}
                <td className="pl-4 py-2.5 w-10">
                  <div
                    className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center transition',
                      'opacity-0 group-hover:opacity-100',
                      selected && 'opacity-100 bg-blue-600 border-blue-600'
                    )}
                    onClick={(e) => { e.stopPropagation(); onSelect(item.key) }}
                  >
                    {selected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5l-1 1L5 10.5l6-7.5z" />
                      </svg>
                    )}
                  </div>
                </td>

                {/* 文件名 */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {showThumbnail ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                        <img
                          src={api.getPreviewUrl(file!.key)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <FileIcon
                        name={item.name}
                        contentType={isFile ? file!.contentType : ''}
                        isFolder={item.type === 'folder'}
                        className="w-9 h-9 shrink-0"
                      />
                    )}
                    <span className="text-sm text-slate-800 font-medium truncate">{item.name}</span>
                  </div>
                </td>

                {/* 大小 */}
                <td className="py-2.5 px-3 text-sm text-slate-500 hidden sm:table-cell">
                  {file ? formatBytes(file.size) : '—'}
                </td>

                {/* 时间 */}
                <td className="py-2.5 px-3 text-sm text-slate-500 hidden md:table-cell">
                  {file ? formatDate(file.uploaded) : '—'}
                </td>

                {/* 操作 */}
                <td className="pr-4 py-2.5 w-10">
                  <ActionMenu
                    item={item}
                    onOpen={() => onOpen(item)}
                    onDownload={isFile ? () => onDownload(file!) : undefined}
                    onDelete={() => onDelete(item)}
                    onRename={() => onRename(item)}
                    onCopyLink={isFile ? () => onCopyLink(file!) : undefined}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
