import { useState } from 'react'
import { MoreVertical, Download, Trash2, Pencil, Link, Eye } from 'lucide-react'
import { FileSystemItem, FileItem } from '../types'
import { cn, isImage, formatBytes } from '../lib/utils'
import FileIcon from './FileIcon'
import { api } from '../lib/api'

interface Props {
  item: FileSystemItem
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  onDownload?: () => void
  onDelete: () => void
  onRename: () => void
  onCopyLink?: () => void
}

export default function FileCard({
  item,
  selected,
  onSelect,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onCopyLink,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [imgError, setImgError] = useState(false)

  const isFile = item.type === 'file'
  const file = isFile ? (item as FileItem) : null
  const showThumbnail = file && isImage(file.contentType, file.name) && !imgError

  function handleMenuClick(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen((v) => !v)
  }

  function handleAction(e: React.MouseEvent, fn: () => void) {
    e.stopPropagation()
    setMenuOpen(false)
    fn()
  }

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-white transition-all cursor-pointer select-none',
        'hover:shadow-md hover:border-blue-200',
        selected
          ? 'border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-300'
          : 'border-slate-200'
      )}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      {/* 选择框 */}
      <div
        className={cn(
          'absolute top-2 left-2 z-10 transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
      >
        <div
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition',
            selected
              ? 'bg-blue-600 border-blue-600'
              : 'border-slate-300 bg-white hover:border-blue-400'
          )}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
              <path d="M10 3L5 8.5 2 5.5l-1 1L5 10.5l6-7.5z" />
            </svg>
          )}
        </div>
      </div>

      {/* 更多菜单按钮 */}
      <div
        className={cn(
          'absolute top-2 right-2 z-10 transition-opacity',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <button
          onClick={handleMenuClick}
          className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 hover:text-slate-700 shadow-sm transition"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* 下拉菜单 */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-2 top-9 z-30 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1 animate-fade-in">
            {isFile && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => handleAction(e, onOpen)}
              >
                <Eye className="w-4 h-4 text-slate-400" />预览
              </button>
            )}
            {isFile && onDownload && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => handleAction(e, onDownload)}
              >
                <Download className="w-4 h-4 text-slate-400" />下载
              </button>
            )}
            {isFile && onCopyLink && (
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={(e) => handleAction(e, onCopyLink)}
              >
                <Link className="w-4 h-4 text-slate-400" />复制链接
              </button>
            )}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={(e) => handleAction(e, onRename)}
            >
              <Pencil className="w-4 h-4 text-slate-400" />重命名
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={(e) => handleAction(e, onDelete)}
            >
              <Trash2 className="w-4 h-4" />删除
            </button>
          </div>
        </>
      )}

      {/* 缩略图 / 图标区域 */}
      <div className="h-32 flex items-center justify-center rounded-t-xl overflow-hidden bg-slate-50">
        {showThumbnail ? (
          <img
            src={api.getPreviewUrl(file!.key)}
            alt={file!.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <FileIcon
            name={item.name}
            contentType={isFile ? file!.contentType : ''}
            isFolder={item.type === 'folder'}
            className="w-12 h-12"
          />
        )}
      </div>

      {/* 文件名和信息 */}
      <div className="p-2.5">
        <p
          className="text-sm font-medium text-slate-800 truncate"
          title={item.name}
        >
          {item.name}
        </p>
        {file && (
          <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
        )}
      </div>
    </div>
  )
}
