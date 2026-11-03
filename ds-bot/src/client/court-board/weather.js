// Nanjing's weather for the court board: the sky over the palace follows the city's.
// Open-Meteo needs no key; when it cannot be reached the board simply keeps fair skies.
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=32.06&longitude=118.8&current=temperature_2m,weather_code&timezone=Asia%2FShanghai'

/**
 * What the scene paints for a WMO weather code, and the word for it.
 * @returns {{kind: 'clear'|'cloudy'|'fog'|'rain'|'snow'|'storm', word: string}}
 */
export function weatherOf(code) {
  if (code === 0 || code === 1) return { kind: 'clear', word: '晴' }
  if (code === 2) return { kind: 'cloudy', word: '多云' }
  if (code === 3) return { kind: 'cloudy', word: '阴' }
  if (code === 45 || code === 48) return { kind: 'fog', word: '雾' }
  if ((code >= 51 && code <= 57)) return { kind: 'rain', word: '毛毛雨' }
  if (code === 61 || code === 80) return { kind: 'rain', word: '小雨' }
  if (code === 63 || code === 81 || code === 66) return { kind: 'rain', word: '中雨' }
  if (code === 65 || code === 82 || code === 67) return { kind: 'rain', word: '大雨' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'snow', word: code === 75 || code === 86 ? '大雪' : '小雪' }
  if (code >= 95) return { kind: 'storm', word: '雷雨' }
  return { kind: 'clear', word: '' }
}

/** The weather now, or null when the service cannot be reached. */
export async function fetchWeather(fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(URL)
    if (!response.ok) return null
    const body = await response.json()
    const current = body?.current
    if (typeof current?.weather_code !== 'number') return null
    return { ...weatherOf(current.weather_code), temp: Math.round(current.temperature_2m) }
  } catch {
    return null
  }
}
