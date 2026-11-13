// The clock the board shows: the place's own time zone, never the machine's, so a reader
// who picked Tokyo sees Tokyo's 时辰 even when the Mac still sits in Nanjing.

/**
 * The hour of the day in `timeZone`, as a fraction (13.5 is 13:30).
 * @param {string} timeZone an IANA zone, 'Asia/Shanghai' when unknown
 * @param {number} [at] milliseconds since the epoch
 * @returns {number} 0..24
 */
export function hourIn(timeZone, at = Date.now()) {
  const zone = timeZone || 'Asia/Shanghai'
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(at))
  const pick = key => Number(parts.find(part => part.type === key)?.value ?? 0)
  return pick('hour') % 24 + pick('minute') / 60
}

/**
 * The date line the title bar shows, in the place's own zone.
 * @param {string} timeZone an IANA zone
 * @param {number} [at] milliseconds since the epoch
 * @returns {string}
 */
export function dateIn(timeZone, at = Date.now()) {
  const zone = timeZone || 'Asia/Shanghai'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(at))
}
