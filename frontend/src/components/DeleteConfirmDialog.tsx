import { Trash2, AlertTriangle } from 'lucide-react'
import { FileSystemItem } from '../types'

interface Props {
  items: FileSystemItem[]
  onConfirm: () => void
  onClose: () => void
}

export default function DeleteConfirmDialog({ items, onConfirm, onClose }: Props) {
  const hasFolder = items.some((i) => i.type === 'folder')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">确认删除</h2>
        </div>

        <p className="text-sm text-slate-600 mb-3">
          即将删除以下 <span className="font-medium text-slate-800">{items.length}</span> 个项目：
        </p>

        {/* 文件列表 */}
        <div className="max-h-36 overflow-y-auto bg-slate-50 rounded-xl p-3 mb-4 space-y-1">
          {items.map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm text-slate-700">
              <span>{item.type === 'folder' ? '📁' : '📄'}</span>
              <span className="truncate">{item.name}</span>
            </div>
          ))}
        </div>

        {hasFolder && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              文件夹及其所有内容将被永久删除，此操作不可撤销。
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  )
}
