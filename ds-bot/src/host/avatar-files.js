// Avatar photos too large to sit in state.json, which is written whole on every save.
// Such a photo is kept as a file named by the hash of its bytes, and the Bot keeps a
// short document-relative link to it; the browser loads the file from AVATAR_ROUTE
// with its session cookie, like every other /api request.
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { avatarBytes } from './avatar.js'
import { MAX_AVATAR_IMAGE, ROUTE } from './constants.js'
import { replaceFile } from './files.js'

export const AVATAR_ROUTE = `${ROUTE}/avatar`
const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
const MIMES = Object.fromEntries(Object.entries(EXTENSIONS).map(([mime, ext]) => [ext, mime]))
// The link as a Bot keeps it: relative, so a Web UI under a mounted base path finds it.
export const AVATAR_LINK = /^api\/bot\/avatar\?id=([0-9a-f]{64})\.(png|jpg|webp|gif)$/
export const avatarLink = (hash, ext) => `${AVATAR_ROUTE.slice(1)}?id=${hash}.${ext}`

export function install(rt) {
  const root = typeof rt.home === 'string' ? join(rt.home, 'avatars') : undefined
  const own = root === undefined ? undefined : join(root, 'bots')
  // Library photos are named the same way, so a link can point at one before it is copied.
  const library = root === undefined ? undefined : join(root, 'files')
  const there = path => stat(path).then(info => info.isFile(), () => false)

  const findFile = async (name) => {
    for (const dir of [own, library]) {
      if (dir !== undefined && await there(join(dir, name))) return join(dir, name)
    }
    return undefined
  }

  const keep = async (name, bytes) => {
    await mkdir(own, { recursive: true })
    const path = join(own, name)
    if (await there(path)) return
    const temp = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temp, bytes)
    await replaceFile(temp, path)
  }

  // What a Bot keeps for a photo: a small one stays a data URL, a large one becomes a
  // file and a link. A link to a library photo gets a copy of its own, so the Bot keeps
  // its photo when the library loses it.
  const storeAvatarImage = async (image) => {
    if (typeof image !== 'string') return image
    const link = AVATAR_LINK.exec(image)
    if (link) {
      if (own === undefined) throw new Error('This host keeps no Bot data folder, so it cannot keep a large photo.')
      const name = `${link[1]}.${link[2]}`
      if (await there(join(own, name))) return image
      const source = await findFile(name)
      if (source === undefined) throw new Error('That photo is gone. Choose it again.')
      await mkdir(own, { recursive: true })
      await copyFile(source, join(own, name))
      return image
    }
    if (!/^data:/i.test(image) || image.length <= MAX_AVATAR_IMAGE) return image
    if (own === undefined) throw new Error('This host keeps no Bot data folder, so it cannot keep a large photo.')
    const { bytes, mime } = avatarBytes(image)
    const hash = createHash('sha256').update(bytes).digest('hex')
    await keep(`${hash}.${EXTENSIONS[mime]}`, bytes)
    return avatarLink(hash, EXTENSIONS[mime])
  }

  rt.storeAvatarImage = storeAvatarImage
  rt.avatarFileOf = async (image) => {
    const link = AVATAR_LINK.exec(String(image ?? ''))
    return link ? findFile(`${link[1]}.${link[2]}`) : undefined
  }

  const ctx = rt.ctx
  if (ctx?.connection?.fetch?.register === undefined) return
  ctx.effect(() => ctx.connection.fetch.register({
    path: AVATAR_ROUTE,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const id = new URL(request.url).searchParams.get('id') ?? ''
      const match = /^([0-9a-f]{64})\.(png|jpg|webp|gif)$/.exec(id)
      const path = match ? await findFile(id) : undefined
      if (path === undefined) return new Response('Not found', { status: 404 })
      const bytes = await readFile(path)
      // Named by its hash, a file never changes, so the browser keeps it.
      return new Response(bytes, { status: 200, headers: { 'content-type': MIMES[match[2]], 'cache-control': 'private, max-age=31536000, immutable' } })
    },
  }), 'ds-bot: avatar route')
}
