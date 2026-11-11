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

// What each sky costs the renderer: how grey it is, how far the eye reaches, and the
// fall of rain or snow. `fall.count` is for the high quality; low quality halves it.
const LOOKS = {
  clear: { overcast: 0, fogNear: 170, fogFar: 380, fall: null },
  cloudy: { overcast: 0.35, fogNear: 150, fogFar: 330, fall: null },
  fog: { overcast: 0.5, fogNear: 55, fogFar: 210, fall: null },
  rain: { overcast: 0.75, fogNear: 90, fogFar: 260, fall: { kind: 'rain', count: 1600, speed: 55, size: 0.32, opacity: 0.55 } },
  storm: { overcast: 0.9, fogNear: 70, fogFar: 230, fall: { kind: 'rain', count: 2200, speed: 78, size: 0.3, opacity: 0.65 } },
  snow: { overcast: 0.55, fogNear: 80, fogFar: 250, fall: { kind: 'snow', count: 1800, speed: 4.2, size: 0.45, opacity: 0.95, sway: 0.7 } },
}

/**
 * What the renderer paints for a weather kind: greyness, sight range and the fall.
 * @returns {{overcast: number, fogNear: number, fogFar: number,
 *   fall: null | {kind: 'rain'|'snow', count: number, speed: number, size: number, opacity: number, sway?: number}}}
 */
export function weatherLook(weather) {
  const look = LOOKS[weather?.kind] ?? LOOKS.clear
  return look.fall ? { ...look, fall: { ...look.fall } } : { ...look }
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
