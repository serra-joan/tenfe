/**
 * Extrau tots els viatges del fitxer `trips.txt` i els guarda en un fitxer JSON.
 * @param LINES_TO_FILTER Array de línies a processar.
 * @param LABELS Etiquetes dels camps a extreure.
 * @param rawFilePath public/files/raw/trips.txt
 * @param outputDir public/files/output
 * 
 * EXEC: node src/scripts/extract_trips.js
 * 
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const LINES_TO_FILTER = ['R1', 'R11', 'RG1']
const LABELS = ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'wheelchair_accessible', 'block_id', 'shape_id']

// Rutes fitxers
const rawFilePath = path.join('public', 'files', 'raw', 'trips.txt')
const outputDir = path.join('public', 'files', 'output')

function ensureDir (dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Mapeja una línia a un objecte segons les etiquetes (en ordre)
function mapLineToObj (parts) {
  const obj = {}
  for (let i = 0; i < LABELS.length; i++) {
    obj[LABELS[i]] = (parts[i] || '').trim()
  }
  return obj
}

// FILTRE -> si `route_id` o `shape_id` conté la LINES_TO_FILTER (line)
function matchesLine (row, lineTrain) {
    if (!lineTrain) return false
    const regex = new RegExp(`${lineTrain}$`)
    return regex.test(row.route_id)
}

async function extract () {
  ensureDir(outputDir)

  const groups = {}
  LINES_TO_FILTER.forEach(lineTrain => { groups[lineTrain] = [] })

  const fileStream = fs.createReadStream(rawFilePath)
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity })

  let isFirstLine = true
  for await (const rawLine of rl) {
    const line = rawLine.trim()
    if (!line) continue

    // Saltar capcelera si existeix
    if (isFirstLine) {
      isFirstLine = false
      const header = LABELS.join(',')
      if (line === header) continue
    }

    const parts = line.split(',')
    const row = mapLineToObj(parts)

    // Afegir al grup corresponent si coincideix
    let matched = false
    for (const lineTrain of LINES_TO_FILTER) {
      if (matchesLine(row, lineTrain)) {
        groups[lineTrain].push(row)
        matched = true
      }
    }
  }

  // Preparar resultat
  const dataToReturn = {}
  for (const lineTrain of LINES_TO_FILTER) {
    if (groups[lineTrain].length) dataToReturn[lineTrain] = groups[lineTrain]
  }

  const filename = path.join(outputDir, `trips_filtered.json`)
  fs.writeFileSync(filename, JSON.stringify(dataToReturn, null, 2), 'utf-8')

  console.log(`Guardat ${Object.keys(dataToReturn).length} grups en ${filename}`)
  for (const lineTrain of Object.keys(dataToReturn)) {
    console.log(` - ${lineTrain}: ${dataToReturn[lineTrain].length} viatges`)
  }
}


// Init
extract().catch(err => {
    console.error('Error:', err.message || err)
    process.exit(1)
})

