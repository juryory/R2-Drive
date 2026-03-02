import { useState, useEffect, FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { FileSystemItem } from '../types'
import { cn } from '../lib/utils'

interface Props {
  item: FileSystemItem
  onClose: () => void
  onRename: (newName: string) => void
}

export default function RenameDialog({ item, onClose, onRename }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setName(item.name)
    setError('')
  }, [item])

  function validate(value: string): string {
    if (!value.trim()) return '请输入名称'
    if (/[/\\:*?"<>|]/.test(value)) return '名称不能包含特殊字符 / \\ : * ? " < > |'
    if (value === '.' || value === '..') return '无效名称'
    return ''
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validate(name)
    if (err) { setError(err); return }
    if (name.trim() === item.name) { onClose(); return }
    onRename(name.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <Pencil className="w-5 h-5 text-slate-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">重命名</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              autoFocus
              onFocus={(e) => {
                // 选中文件名（不含扩展名）
                const dotIndex = e.target.value.lastIndexOf('.')
                if (dotIndex > 0 && item.type === 'file') {
                  e.target.setSelectionRange(0, dotIndex)
                } else {
                  e.target.select()
                }
              }}
              className={cn(
                'w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition',
                error
                  ? 'border-red-300 focus:ring-red-300'
                  : 'border-slate-200 focus:ring-blue-400'
              )}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
            >
              确定
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
