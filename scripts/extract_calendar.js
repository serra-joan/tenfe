/**
 * Extrau els serveis actius per data del fitxer `calendar.txt` i els guarda en un fitxer JSON.
 * @param rawFilePath public/files/raw/calendar.txt
 * @param outputDir public/files/output
 *
 * EXEC: node scripts/extract_calendar.js
 */
import fs from 'fs'
import path from 'path'

const rawFilePath = path.join('public', 'files', 'raw', 'calendar.txt')
const outputDir = path.join('public', 'files', 'output')
const WEEKDAY_FLAGS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function ensureDir (dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function parseCsvLine (line) {
  return line.split(',').map(field => field.trim())
}

function ymdToUtcDate (ymd) {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8))))
}

function utcDateToYmd (date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

function addDays (date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

// Mapeja cada data a la llista de service_ids actius aquell dia
function getActiveServicesByDate () {
  const lines = fs.readFileSync(rawFilePath, 'utf8').trim().split('\n')
  const header = parseCsvLine(lines[0])
  const index = Object.fromEntries(header.map((name, i) => [name, i]))
  const activeByDate = {}

  for (const rawLine of lines.slice(1)) {
    if (!rawLine.trim()) continue
    const fields = parseCsvLine(rawLine)
    const serviceId = fields[index.service_id]
    const startDate = ymdToUtcDate(fields[index.start_date])
    const endDate = ymdToUtcDate(fields[index.end_date])

    for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
      const flag = WEEKDAY_FLAGS[date.getUTCDay()]
      if (fields[index[flag]] !== '1') continue
      const ymd = utcDateToYmd(date)
      if (!activeByDate[ymd]) activeByDate[ymd] = []
      activeByDate[ymd].push(serviceId)
    }
  }

  return Object.fromEntries(Object.keys(activeByDate).sort().map(date => [date, activeByDate[date]]))
}

async function extract () {
  ensureDir(outputDir)

  const activeByDate = getActiveServicesByDate()
  const filename = path.join(outputDir, 'calendar_filtered.json')
  fs.writeFileSync(filename, JSON.stringify(activeByDate, null, 2), 'utf-8')

  console.log(`Guardat ${Object.keys(activeByDate).length} dates en ${filename}`)
}

extract().catch(err => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
