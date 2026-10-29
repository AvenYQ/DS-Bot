import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { TrashIcon } from './icons.js'
import { hostText, t } from './i18n.js'

// How many photos go in one request to the host.
const CHUNK = 20
// How many photos the window asks for at a time.
const PAGE = 24

// The host keeps an animated photo up to this size as a file of its own.
export const MAX_ANIMATED = 5 * 1024 * 1024

const fourCC = (bytes, at) => String.fromCharCode(...bytes.subarray(at, at + 4))

// Whether the bytes hold more than one frame: a GIF with a second image block, an
// animated WebP (the VP8X animation flag), or an APNG (an acTL chunk before the image).
export function isAnimated(bytes) {
  if (bytes.length < 16) return false
  if (fourCC(bytes, 0) === 'GIF8') {
    let frames = 0
    for (let at = 13; at < bytes.length - 2; at++) {
      // A graphic control extension starts every frame of an animation.
      if (bytes[at] === 0x21 && bytes[at + 1] === 0xf9 && bytes[at + 2] === 0x04 && ++frames > 1) return true
    }
    return false
  }
  if (fourCC(bytes, 0) === 'RIFF' && fourCC(bytes, 8) === 'WEBP') return fourCC(bytes, 12) === 'VP8X' && (bytes[20] & 0x02) !== 0
  if (bytes[0] === 0x89 && fourCC(bytes, 1).startsWith('PNG')) {
    for (let at = 8; at + 8 <= bytes.length;) {
      const length = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
      const type = fourCC(bytes, at + 4)
      if (type === 'acTL') return true
      if (type === 'IDAT') return false
      at += 12 + length
    }
  }
  return false
}

const readDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error ?? new Error(t('That image is too large')))
  reader.readAsDataURL(file)
})

// A still photo is center-cropped to a small square so state.json stays light. An
// animated one would lose its frames on a canvas, so it goes as it is, up to
// MAX_ANIMATED; the host keeps it as a file.
export async function avatarImage(file) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error(t('Choose a PNG, JPEG, WebP, or GIF image'))
  if (file.size > 25 * 1024 * 1024) throw new Error(t('Choose an image smaller than 25 MB'))
  if (file.type !== 'image/jpeg' && isAnimated(new Uint8Array(await file.arrayBuffer()))) {
    if (file.size > MAX_ANIMATED) throw new Error(t('Choose an animated image smaller than 5 MB'))
    return readDataUrl(file)
  }
  const bitmap = await createImageBitmap(file)
  const side = 160
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  const crop = Math.min(bitmap.width, bitmap.height)
  context.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, side, side)
  bitmap.close?.()
  for (const quality of [0.9, 0.75, 0.6]) {
    const url = canvas.toDataURL('image/webp', quality)
    if (url.startsWith('data:image/webp') && url.length < 150000) return url
  }
  const png = canvas.toDataURL('image/png')
  if (png.length < 150000) return png
  throw new Error(t('That image is too large'))
}

// Imports the photos in small batches. A batch the host refuses does not stop the
// ones after it: every photo of that batch is named, and nothing is sent twice.
export async function importPhotos(photos, actions) {
  const imported = []
  const duplicates = []
  const failed = []
  // A batch also stops at about 8 MB, so animated photos go a few at a time.
  const chunks = []
  for (const photo of photos) {
    const last = chunks.at(-1)
    const size = last?.reduce((sum, item) => sum + item.image.length, 0) ?? Infinity
    if (last === undefined || last.length >= CHUNK || size + photo.image.length > 8 * 1024 * 1024) chunks.push([photo])
    else last.push(photo)
  }
  for (const chunk of chunks) {
    try {
      const result = await actions.importAvatars(chunk)
      imported.push(...(result?.imported ?? []))
      duplicates.push(...(result?.duplicates ?? []))
      failed.push(...(result?.failed ?? []))
    } catch (failure) {
      // The batch did not land. Every photo in it is reported, so none of them is
      // silently lost, and the batch is not sent again.
      failed.push(...chunk.map(photo => ({ name: photo.name, message: failure?.message ?? String(failure) })))
    }
  }
  return { imported, duplicates, failed }
}

// One page of the library: the host keeps its answer small, so a window asks for the
// photos it shows and for the next ones when the user wants more.
export async function loadLibrary(actions, { offset = 0, limit = PAGE } = {}) {
  const value = await actions.avatarLibrary({ offset, limit })
  const items = value?.items ?? []
  return { items, total: value?.total ?? items.length, next: value?.next ?? offset + items.length }
}

// The avatar library: the photos the user imported once, kept by the host beside the
// team. The window asks for them when the picker opens, and imports new ones in a
// batch: a photo that cannot be read is named, and the others still land.
export function AvatarLibraryPanel({ actions, onPick }) {
  const [items, setItems] = useState(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async (from = 0, append = false) => {
    try {
      const page = await loadLibrary(actions, { offset: from })
      setItems(previous => (append ? [...(previous ?? []), ...page.items] : page.items))
      setTotal(page.total)
      setOffset(page.next)
    } catch (failure) {
      setError(failure?.message ?? String(failure))
    }
  }, [actions])
  useEffect(() => { void load() }, [load])

  const importFiles = async (files) => {
    if (files.length === 0) return
    setBusy(true)
    setError('')
    setReport(null)
    // Every photo is cropped and checked on its own, so one bad file does not stop the rest.
    const photos = []
    const failed = []
    for (const file of files) {
      try { photos.push({ name: file.name, image: await avatarImage(file) }) }
      catch (failure) { failed.push({ name: file.name, message: failure?.message ?? String(failure) }) }
    }
    const result = await importPhotos(photos, actions)
    setReport({ imported: result.imported, duplicates: result.duplicates, failed: [...failed, ...result.failed] })
    await load()
    setBusy(false)
  }

  const remove = async (entry) => {
    setBusy(true)
    setError('')
    try {
      await actions.deleteAvatar(entry.id)
      await load()
    } catch (failure) {
      setError(failure?.message ?? String(failure))
    } finally {
      setBusy(false)
    }
  }

  const shown = items?.length ?? 0
  return h('div', { className: 'bt-lib' },
    h('div', { className: 'bt-lib-bar' },
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: () => fileRef.current?.click() },
        busy ? t('Importing photos…') : t('Import photos')),
      h('input', {
        ref: fileRef, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, hidden: true,
        onChange: event => { const files = [...(event.target.files ?? [])]; event.target.value = ''; void importFiles(files) },
      })),
    error ? h('div', { className: 'bt-error', role: 'alert' }, error) : null,
    items === null ? h('div', { className: 'bt-note' }, t('Loading…')) : null,
    items?.length === 0 && !error ? h('div', { className: 'bt-note' }, t('No photos in the library yet.')) : null,
    items?.length ? h('div', { className: 'bt-lib-grid' }, items.map(entry => h('div', { key: entry.id, className: 'bt-lib-cell' },
      h('button', { type: 'button', className: 'bt-lib-pick', title: entry.name, 'aria-label': t('Use this photo'), onClick: () => onPick(entry) },
        h('img', { src: entry.image, alt: '' })),
      h('button', { type: 'button', className: 'bt-lib-del', 'aria-label': t('Remove photo from the library'), onClick: () => void remove(entry) },
        h(TrashIcon))))) : null,
    shown < total ? h('div', { className: 'bt-lib-more' },
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => void load(offset, true) }, t('Show more photos')),
      h('span', { className: 'bt-note' }, t('Showing {shown} of {total} photos', { shown, total }))) : null,
    report ? h('div', { className: 'bt-lib-report' },
      report.imported.length ? h('div', { className: 'bt-note' }, report.imported.length === 1 ? t('1 photo imported') : t('{count} photos imported', { count: report.imported.length })) : null,
      report.duplicates.length ? h('div', { className: 'bt-note' }, report.duplicates.length === 1 ? t('1 photo was already in the library') : t('{count} photos were already in the library', { count: report.duplicates.length })) : null,
      report.failed.map((item, index) => h('div', { key: index, className: 'bt-note bt-danger' },
        t('{name}: {reason}', { name: item.name || t('photo'), reason: hostText(item.message) })))) : null)
}

export const AVATAR_LIBRARY_CSS = `
.bt-lib{display:flex;flex-direction:column;gap:8px;width:100%}
.bt-lib-bar{display:flex;align-items:center;gap:8px}
.bt-lib-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-height:210px;overflow-y:auto}
.bt-lib-cell{position:relative}
.bt-lib-pick{display:block;width:100%;aspect-ratio:1;padding:0;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-hover);cursor:pointer;overflow:hidden}
.bt-lib-pick:hover{background:var(--bt-active)}
.bt-lib-pick img{display:block;width:100%;height:100%;object-fit:cover}
.bt-lib-del{position:absolute;right:0;top:0;width:28px;height:28px;padding:0;border:1px solid var(--bt-line-2);border-radius:50%;background:var(--bt-main);color:var(--bt-ink-2);display:flex;align-items:center;justify-content:center;cursor:pointer}
.bt-lib-del:hover{color:var(--bt-ink)}
.bt-lib-del svg{width:14px;height:14px}
.bt-lib-more{display:flex;align-items:center;gap:8px}
.bt-lib-report{display:flex;flex-direction:column;gap:4px}
`
