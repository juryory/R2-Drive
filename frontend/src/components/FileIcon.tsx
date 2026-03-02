import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  File,
  Folder,
} from 'lucide-react'
import { getFileExtension } from '../lib/utils'

const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']
const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'php', 'rb', 'swift', 'kt', 'sh']
const spreadsheetExts = ['xls', 'xlsx', 'csv', 'ods']
const docExts = ['doc', 'docx', 'pdf', 'txt', 'md', 'odt', 'rtf', 'ppt', 'pptx']

interface Props {
  name: string
  contentType: string
  size?: number
  isFolder?: boolean
  className?: string
}

export default function FileIcon({ name, contentType, isFolder, className = 'w-10 h-10' }: Props) {
  if (isFolder) {
    return <Folder className={`${className} text-blue-400 fill-blue-100`} />
  }

  const ext = getFileExtension(name)

  if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(ext)) {
    return <FileImage className={`${className} text-emerald-500`} />
  }
  if (contentType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(ext)) {
    return <FileVideo className={`${className} text-purple-500`} />
  }
  if (contentType.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'].includes(ext)) {
    return <FileAudio className={`${className} text-pink-500`} />
  }
  if (archiveExts.includes(ext)) {
    return <FileArchive className={`${className} text-orange-500`} />
  }
  if (codeExts.includes(ext)) {
    return <FileCode className={`${className} text-cyan-500`} />
  }
  if (spreadsheetExts.includes(ext)) {
    return <FileSpreadsheet className={`${className} text-green-600`} />
  }
  if (docExts.includes(ext) || contentType.includes('document') || contentType.includes('text')) {
    return <FileText className={`${className} text-blue-500`} />
  }

  return <File className={`${className} text-slate-400`} />
}
