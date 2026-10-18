'use client'
import { useEffect, useRef, useState } from 'react'

// Round photo picker: tap the circle to add, then Change or Remove.
export default function PhotoPicker({ file, url, onFile, onRemove, size = 128 }: {
  file: File | null; url?: string; onFile: (f: File) => void; onRemove: () => void; size?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  const src = preview || url || ''

  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={() => input.current?.click()} aria-label={src ? 'Change photo' : 'Add photo'}
        style={{ width: size, height: size }}
        className={`rounded-full overflow-hidden flex items-center justify-center transition ${src ? 'border border-line' : 'border-2 border-dashed border-white/30 hover:border-white/60 bg-panel'}`}>
        {src
          ? <img src={src} alt="" className="w-full h-full object-cover" />
          : <span className="flex flex-col items-center text-mute text-sm gap-1"><span className="text-3xl">📷</span>Add photo</span>}
      </button>
      {src && (
        <div className="flex gap-5 text-sm">
          <button type="button" onClick={() => input.current?.click()} className="text-white font-semibold">Change</button>
          <button type="button" onClick={() => { if (input.current) input.current.value = ''; onRemove() }} className="text-mute hover:text-white">Remove</button>
        </div>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}
