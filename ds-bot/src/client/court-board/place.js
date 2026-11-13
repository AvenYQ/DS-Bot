// Where the Emperor is right now: the Mac's own location when he allows it, the city he
// picked, or Nanjing. Only coordinates (rounded to about a kilometre) leave the machine,
// to Open-Meteo for the weather and BigDataCloud for the city's name. The last fix stays
// in memory only; the one thing written down is the city the reader picked.

const MANUAL_KEY = 'ds-bot:court-place'
const DENIED_KEY = 'ds-bot:court-geo-denied'
// A cache some earlier build wrote to disk; cleared whenever the fix is dropped.
const LEGACY_CACHE_KEY = 'ds-bot:court-place-system'
const CACHE_MS = 30 * 60 * 1000
let cachedFix = null
const GEO_OPTIONS = { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
const CITY_LOOKUP = 'https://api.bigdatacloud.net/data/reverse-geocode-client'
const CITY_SEARCH = 'https://geocoding-api.open-meteo.com/v1/search'

/** What the board shows when nothing else is known. */
export const DEFAULT_PLACE = Object.freeze({
  city: '南京',
  lat: 32.06,
  lon: 118.8,
  timeZone: 'Asia/Shanghai',
  source: 'default',
})

const round2 = value => Math.round(Number(value) * 100) / 100

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows refuse the write; the session still works with what is in memory.
  }
}

function removeKey(storage, key) {
  try {
    storage?.removeItem(key)
  } catch {
    // Nothing to do.
  }
}

function readFlag(storage, key) {
  try {
    return storage?.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(storage, key, on) {
  try {
    storage?.setItem(key, on ? '1' : '0')
  } catch {
    // The refusal is remembered for this session at least.
  }
}

function systemTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_PLACE.timeZone
  } catch {
    return DEFAULT_PLACE.timeZone
  }
}

/** A place the reader picked: it must name a city and carry usable coordinates. */
function normalisePlace(raw) {
  if (!raw || typeof raw !== 'object') return null
  const city = typeof raw.city === 'string' ? raw.city.trim() : ''
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  const timeZone = typeof raw.timeZone === 'string' ? raw.timeZone.trim() : ''
  if (city === '' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { city, lat: round2(lat), lon: round2(lon), timeZone: timeZone || systemTimeZone() }
}

// A cached fix may have lost its city name (BigDataCloud was down); keep the coordinates.
function normaliseCache(raw) {
  if (!raw || typeof raw !== 'object') return null
  const lat = Number(raw.lat)
  const lon = Number(raw.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  const city = typeof raw.city === 'string' ? raw.city.trim() : ''
  const timeZone = typeof raw.timeZone === 'string' && raw.timeZone ? raw.timeZone : systemTimeZone()
  return { city, lat: round2(lat), lon: round2(lon), timeZone }
}

/** The city the reader picked, or null. */
export function readManualPlace({ storage = defaultStorage() } = {}) {
  return normalisePlace(readJson(storage, MANUAL_KEY))
}

/** Remember the city the reader picked; returns the stored place, or null when unusable. */
export function setManualPlace(place, { storage = defaultStorage() } = {}) {
  const normal = normalisePlace(place)
  if (!normal) return null
  writeJson(storage, MANUAL_KEY, normal)
  return { ...normal, source: 'manual' }
}

/** Go back to following the Mac's location. */
export function clearManualPlace({ storage = defaultStorage() } = {}) {
  removeKey(storage, MANUAL_KEY)
}

/** Ask for the location again after the reader pressed "use my location". */
export function forgetLocationDenial({ storage = defaultStorage() } = {}) {
  removeKey(storage, DENIED_KEY)
}

/** Throw away the cached fix, so the next resolve asks the Mac again. */
export function clearPlaceCache({ storage = defaultStorage() } = {}) {
  cachedFix = null
  removeKey(storage, LEGACY_CACHE_KEY)
}

function locate(geolocation) {
  return new Promise((resolve) => {
    let settled = false
    const settle = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    try {
      geolocation.getCurrentPosition(
        position => settle({ latitude: position?.coords?.latitude, longitude: position?.coords?.longitude }),
        error => settle({ error: Number(error?.code) || 0 }),
        GEO_OPTIONS,
      )
    } catch {
      settle({ error: 0 })
    }
  })
}

async function reverseCity(lat, lon, fetchImpl) {
  if (typeof fetchImpl !== 'function') return ''
  try {
    const response = await fetchImpl(`${CITY_LOOKUP}?latitude=${lat}&longitude=${lon}&localityLanguage=zh`)
    if (!response?.ok) return ''
    const body = await response.json()
    const name = body?.city ?? body?.locality ?? body?.principalSubdivision ?? ''
    return typeof name === 'string' ? name.trim() : ''
  } catch {
    return ''
  }
}

/**
 * Where the Emperor is: the city he picked, else the Mac's location, else Nanjing.
 * A refused location is remembered, so the board asks the system only once.
 * @param {object} [options] injected for tests
 * @param {boolean} [options.fresh] ask the Mac again even when a recent fix is cached
 * @returns {Promise<{city: string, lat: number, lon: number, timeZone: string,
 *   source: 'system'|'manual'|'default'}>}
 */
export async function resolvePlace({
  storage = defaultStorage(),
  geolocation = globalThis.navigator?.geolocation,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  fresh = false,
} = {}) {
  const manual = readManualPlace({ storage })
  if (manual) return { ...manual, source: 'manual' }

  if (!fresh && cachedFix && now - cachedFix.at >= 0 && now - cachedFix.at < CACHE_MS) {
    const place = normaliseCache(cachedFix)
    if (place) return { ...place, source: 'system' }
  }

  if (!readFlag(storage, DENIED_KEY) && typeof geolocation?.getCurrentPosition === 'function') {
    const found = await locate(geolocation)
    if (found && found.error === undefined && Number.isFinite(found.latitude) && Number.isFinite(found.longitude)) {
      const lat = round2(found.latitude)
      const lon = round2(found.longitude)
      const city = await reverseCity(lat, lon, fetchImpl)
      const place = { city, lat, lon, timeZone: systemTimeZone(), source: 'system' }
      cachedFix = { ...place, at: now }
      return place
    }
    // 1 is PERMISSION_DENIED; a timeout or a missing fix is worth another try next time.
    if (found?.error === 1) writeFlag(storage, DENIED_KEY, true)
  }

  return { ...DEFAULT_PLACE }
}

/**
 * City names for the little chooser, from Open-Meteo's keyless geocoder.
 * @param {string} query what the reader typed
 * @returns {Promise<Array<{city: string, region: string, lat: number, lon: number, timeZone: string}>>}
 */
export async function searchPlaces(query, { fetchImpl = globalThis.fetch, language = 'zh', count = 6 } = {}) {
  const name = typeof query === 'string' ? query.trim() : ''
  if (name === '' || typeof fetchImpl !== 'function') return []
  try {
    const url = `${CITY_SEARCH}?name=${encodeURIComponent(name)}&count=${count}&language=${language}&format=json`
    const response = await fetchImpl(url)
    if (!response?.ok) return []
    const body = await response.json()
    const results = Array.isArray(body?.results) ? body.results : []
    return results.map(item => ({
      city: String(item?.name ?? '').trim(),
      region: String(item?.admin1 ?? '').trim(),
      lat: round2(item?.latitude),
      lon: round2(item?.longitude),
      timeZone: String(item?.timezone ?? '').trim() || systemTimeZone(),
    })).filter(place => place.city !== '' && Number.isFinite(place.lat) && Number.isFinite(place.lon))
  } catch {
    return []
  }
}
