import { useState, useRef, ReactNode, DragEvent } from 'react'
import { cn } from '../lib/utils'
import { Upload } from 'lucide-react'

interface Props {
  onFileDrop: (files: File[]) => void
  className?: string
  children: ReactNode
}

export default function UploadZone({ onFileDrop, className, children }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  function handleDragEnter(e: DragEvent) {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFileDrop(files)
    }
  }

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-[1px] border-2 border-dashed border-blue-400 rounded-xl m-2 animate-fade-in pointer-events-none">
          <div className="bg-blue-600 rounded-full p-4 shadow-lg mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <p className="text-blue-700 font-semibold text-lg">松开即可上传</p>
          <p className="text-blue-500 text-sm mt-1">支持多文件同时上传</p>
        </div>
      )}
    </div>
  )
}
