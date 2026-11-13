import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_PLACE,
  clearManualPlace,
  clearPlaceCache,
  forgetLocationDenial,
  readManualPlace,
  resolvePlace,
  searchPlaces,
  setManualPlace,
} from '../src/client/court-board/place.js'
import { fetchWeather } from '../src/client/court-board/weather.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: key => { delete data[key] },
  }
}

// The outcomes are handed out in order; the last one repeats.
function fakeGeolocation(outcomes) {
  const state = { calls: 0 }
  return {
    get calls() { return state.calls },
    getCurrentPosition(ok, fail) {
      const next = outcomes[Math.min(state.calls, outcomes.length - 1)]
      state.calls += 1
      if (next.error) fail({ code: next.error })
      else ok({ coords: { latitude: next.lat, longitude: next.lon } })
    },
  }
}

function fakeFetch(routes) {
  const seen = []
  const fetcher = async (url) => {
    seen.push(String(url))
    const hit = routes.find(route => String(url).startsWith(route.match))
    if (!hit) return { ok: false, json: async () => ({}) }
    return { ok: true, json: async () => hit.body }
  }
  fetcher.seen = seen
  return fetcher
}

const CITY = { match: 'https://api.bigdatacloud.net/data/reverse-geocode-client', body: { city: '南京市', locality: '玄武区' } }
const SEARCH = {
  match: 'https://geocoding-api.open-meteo.com/v1/search',
  body: { results: [{ name: '南京', admin1: '江苏', latitude: 32.0603, longitude: 118.7969, timezone: 'Asia/Shanghai' }] },
}
const WEATHER = {
  match: 'https://api.open-meteo.com/v1/forecast',
  body: { current: { weather_code: 61, temperature_2m: 12.4 } },
}

test('the Mac\'s location becomes a city, with coordinates rounded to about a kilometre', async () => {
  const storage = memoryStorage()
  const geolocation = fakeGeolocation([{ lat: 32.06033, lon: 118.79688 }])
  const fetchImpl = fakeFetch([CITY])
  const place = await resolvePlace({ storage, geolocation, fetchImpl, now: 1000 })
  assert.equal(place.source, 'system')
  assert.equal(place.city, '南京市')
  assert.equal(place.lat, 32.06)
  assert.equal(place.lon, 118.8)
  assert.ok(typeof place.timeZone === 'string' && place.timeZone.length > 0)
  assert.match(fetchImpl.seen[0], /latitude=32\.06&longitude=118\.8/)
  assert.match(fetchImpl.seen[0], /localityLanguage=zh/)
})

test('a city lookup that fails keeps the coordinates and leaves the name to the board', async () => {
  const place = await resolvePlace({
    storage: memoryStorage(),
    geolocation: fakeGeolocation([{ lat: 31.3, lon: 120.6 }]),
    fetchImpl: fakeFetch([]),
    now: 1000,
  })
  assert.equal(place.source, 'system')
  assert.equal(place.city, '')
  assert.equal(place.lat, 31.3)
})

test('a refused location is remembered, so the board asks the system only once', async () => {
  const storage = memoryStorage()
  const refused = fakeGeolocation([{ error: 1 }])
  const first = await resolvePlace({ storage, geolocation: refused, fetchImpl: fakeFetch([CITY]), now: 1000 })
  assert.equal(first.source, 'default')
  assert.deepEqual(first, { ...DEFAULT_PLACE })
  const working = fakeGeolocation([{ lat: 32.06, lon: 118.8 }])
  const second = await resolvePlace({ storage, geolocation: working, fetchImpl: fakeFetch([CITY]), now: 2000 })
  assert.equal(second.source, 'default')
  assert.equal(working.calls, 0, 'the refusal is remembered')
  forgetLocationDenial({ storage })
  const third = await resolvePlace({ storage, geolocation: working, fetchImpl: fakeFetch([CITY]), now: 3000 })
  assert.equal(third.source, 'system')
  assert.equal(working.calls, 1, 'the reader asked again from the chooser')
})

test('a timeout is not a refusal: the next open tries again', async () => {
  const storage = memoryStorage()
  const first = await resolvePlace({ storage, geolocation: fakeGeolocation([{ error: 3 }]), fetchImpl: fakeFetch([CITY]), now: 1000 })
  assert.equal(first.source, 'default')
  const working = fakeGeolocation([{ lat: 32.06, lon: 118.8 }])
  const second = await resolvePlace({ storage, geolocation: working, fetchImpl: fakeFetch([CITY]), now: 2000 })
  assert.equal(second.source, 'system')
  assert.equal(working.calls, 1)
})

test('a good fix is cached for half an hour, so the board does not ask again at once', async () => {
  const storage = memoryStorage()
  const geolocation = fakeGeolocation([{ lat: 32.06, lon: 118.8 }])
  const first = await resolvePlace({ storage, geolocation, fetchImpl: fakeFetch([CITY]), now: 1000 })
  assert.equal(first.source, 'system')
  const second = await resolvePlace({ storage, geolocation, fetchImpl: fakeFetch([CITY]), now: 1000 + 29 * 60 * 1000 })
  assert.equal(second.source, 'system')
  assert.equal(geolocation.calls, 1, 'the cached fix is reused')
  const third = await resolvePlace({ storage, geolocation, fetchImpl: fakeFetch([CITY]), now: 1000 + 31 * 60 * 1000 })
  assert.equal(third.source, 'system')
  assert.equal(geolocation.calls, 2, 'a stale fix is asked for again')
  clearPlaceCache({ storage })
})

test('a city the reader picked wins over the Mac, and can be cleared', async () => {
  const storage = memoryStorage()
  const stored = setManualPlace({ city: '苏州', lat: 31.304, lon: 120.595, timeZone: 'Asia/Shanghai' }, { storage })
  assert.deepEqual(stored, { city: '苏州', lat: 31.3, lon: 120.6, timeZone: 'Asia/Shanghai', source: 'manual' })
  const geolocation = fakeGeolocation([{ lat: 32.06, lon: 118.8 }])
  const place = await resolvePlace({ storage, geolocation, fetchImpl: fakeFetch([CITY]), now: 1000 })
  assert.equal(place.source, 'manual')
  assert.equal(place.city, '苏州')
  assert.equal(geolocation.calls, 0, 'a picked city needs no location')
  assert.equal(readManualPlace({ storage }).city, '苏州')
  clearManualPlace({ storage })
  const after = await resolvePlace({ storage, geolocation, fetchImpl: fakeFetch([CITY]), now: 2000 })
  assert.equal(after.source, 'system')
})

test('a picked city that is not usable is refused', () => {
  assert.equal(setManualPlace({ city: '', lat: 1, lon: 1 }, { storage: memoryStorage() }), null)
  assert.equal(setManualPlace({ city: 'x', lat: 200, lon: 1 }, { storage: memoryStorage() }), null)
  assert.equal(setManualPlace(null, { storage: memoryStorage() }), null)
})

test('without a location API the board falls back to Nanjing', async () => {
  const place = await resolvePlace({ storage: memoryStorage(), geolocation: undefined, fetchImpl: fakeFetch([]), now: 1000 })
  assert.deepEqual(place, { ...DEFAULT_PLACE })
})

test('the city search finds Chinese names with coordinates and a time zone', async () => {
  const found = await searchPlaces('南京', { fetchImpl: fakeFetch([SEARCH]) })
  assert.deepEqual(found, [{ city: '南京', region: '江苏', lat: 32.06, lon: 118.8, timeZone: 'Asia/Shanghai' }])
  assert.deepEqual(await searchPlaces('', { fetchImpl: fakeFetch([SEARCH]) }), [])
  assert.deepEqual(await searchPlaces('南京', { fetchImpl: fakeFetch([]) }), [])
})

test('the weather is read at the place\'s coordinates and time zone', async () => {
  const fetchImpl = fakeFetch([WEATHER])
  const weather = await fetchWeather({ lat: 31.3, lon: 120.6, timeZone: 'Asia/Shanghai' }, fetchImpl)
  assert.deepEqual(weather, { kind: 'rain', word: '小雨', temp: 12 })
  const url = fetchImpl.seen[0]
  assert.match(url, /latitude=31\.3&longitude=120\.6/)
  assert.match(url, /timezone=Asia%2FShanghai/)
})

test('the weather without a place still reads Nanjing', async () => {
  const fetchImpl = fakeFetch([WEATHER])
  await fetchWeather({}, fetchImpl)
  assert.match(fetchImpl.seen[0], /latitude=32\.06&longitude=118\.8&current=temperature_2m,weather_code&timezone=Asia%2FShanghai/)
})
