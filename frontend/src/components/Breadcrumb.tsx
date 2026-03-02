import { ChevronRight, Home } from 'lucide-react'

interface Props {
  currentPath: string
  onNavigate: (path: string) => void
}

export default function Breadcrumb({ currentPath, onNavigate }: Props) {
  const parts = currentPath
    ? currentPath.replace(/\/$/, '').split('/').filter(Boolean)
    : []

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition shrink-0"
      >
        <Home className="w-4 h-4" />
        <span>全部文件</span>
      </button>

      {parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/') + '/'
        const isLast = index === parts.length - 1

        return (
          <span key={path} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="w-4 h-4 text-slate-300" />
            {isLast ? (
              <span className="text-slate-800 font-medium">{part}</span>
            ) : (
              <button
                onClick={() => onNavigate(path)}
                className="text-slate-500 hover:text-blue-600 transition"
              >
                {part}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
