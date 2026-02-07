/**
 * Extrau tots temps del fitxer `stop_times.txt` i els guarda en un fitxer JSON.
 * @param LINES_TO_FILTER Array de línies a processar.
 * @param LABELS Etiquetes dels camps a extreure.
 * @param rawFilePath public/files/raw/stop_times.txt
 * @param outputDir public/files/output
 * 
 * EXEC: node src/scripts/extract_stop_times.js
 * Nota: Per poder extraure aquestes dades es necessita primer el fitxer que conté els `trips` -> output/trips_filtered.json
 * 
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import TRIPS from '../../public/files/output/trips_filtered.json' with { type: 'json' }

const LINES_TO_FILTER = ['R1', 'RG1']
const LABELS = ['trip_id','arrival_time','departure_time', 'stop_id', 'stop_sequence']
// Agafar tots els IDs dels viatges (ja que la parada es relaciona amb el viatge)
const TRIPS_IDS = Object.keys(TRIPS).map(line => {
    return TRIPS[line].map(trip => trip.trip_id)
}).flat()

// Rutes fitxers
const rawFilePath = path.join('public', 'files', 'raw', 'stop_times.txt')
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

// FILTRE -> si `trip_id` és igual al `trip_id` de TRIPS_IDS
function matchesLine (row, lineTrain) {
  if (!row) return false
  const regex = new RegExp(`${lineTrain}$`)

  if (regex.test(row.trip_id) && TRIPS_IDS.includes(row.trip_id)) return true
  return false
}

async function extract () {
  ensureDir(outputDir)

  const dataToReturn = {}
  LINES_TO_FILTER.forEach(lineTrain => { dataToReturn[lineTrain] = [] })

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
    for (const lineTrain of LINES_TO_FILTER) {
        if (matchesLine(row, lineTrain)) {
          dataToReturn[lineTrain].push(row)
        } 
    }
  }

  const filename = path.join(outputDir, `stop_times_filtered.json`)
  fs.writeFileSync(filename, JSON.stringify(dataToReturn, null, 2), 'utf-8')

  console.log(`Guardat ${Object.keys(dataToReturn).length} grups en ${filename}`)
  for (const lineTrain of Object.keys(dataToReturn)) {
    console.log(` - ${lineTrain}: ${dataToReturn[lineTrain].length} rows`)
  }
}


// Init
extract()

