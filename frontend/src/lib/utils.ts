import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : ''
}

export function isImage(contentType: string, name: string): boolean {
  return (
    contentType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(
      getFileExtension(name)
    )
  )
}

export function isVideo(contentType: string, name: string): boolean {
  return (
    contentType.startsWith('video/') ||
    ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(getFileExtension(name))
  )
}

export function isAudio(contentType: string, name: string): boolean {
  return (
    contentType.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(getFileExtension(name))
  )
}

export function isPDF(contentType: string, name: string): boolean {
  return contentType === 'application/pdf' || getFileExtension(name) === 'pdf'
}

export function isText(contentType: string, name: string): boolean {
  return (
    contentType.startsWith('text/') ||
    ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'csv', 'log'].includes(
      getFileExtension(name)
    )
  )
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
