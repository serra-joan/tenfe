/**
 * Extrau totes les rutes del fitxer `routes.txt` i els guarda en un fitxer JSON.
 * @param LINES_TO_FILTER Array de linees a procesar
 * @param LABELS Etiquetes dels camps a extreure.
 * @param rawFilePath public/files/raw/routes.txt
 * @param outputDir public/files/output
 * 
 * EXEC: node src/scripts/extract_routes.js
 * 
 */
import fs from 'fs'
import path from 'path'
import readline from 'readline'

const LINES_TO_FILTER = ['R1']
const LABELS = ['route_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color']

// Rutes fitxers
const rawFilePath = path.join('public', 'files', 'raw', 'routes.txt')
const outputDir = path.join('public', 'files', 'output')

function ensureDir (dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function mapLineToObj (parts) {
  const obj = {}
  for (let i = 0; i < LABELS.length; i++) {
    let value = (parts[i] || '').trim()
      // Normalitzar nom llarg
      if (LABELS[i] === 'route_long_name') {
        value = value.replace(/ {2,}-\s*/g, ' - ')
        value = value.replace(/\s{2,}/g, ' ') // Elimina espais dobles extra
      }
      obj[LABELS[i]] = value
  }
  return obj
}

// FILTRE -> si `route_id` o `shape_id` conté la LINES_TO_FILTER (line)
function matchesLine (row, lineTrain) {
  if (!lineTrain) return false
  // Coincidència simple:
  if ((row.route_id && row.route_id.includes(lineTrain)) || (row.shape_id && row.shape_id.includes(lineTrain))) return true
  return false
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

  const filename = path.join(outputDir, `routes_filtered.json`)
  fs.writeFileSync(filename, JSON.stringify(dataToReturn, null, 2), 'utf-8')

  console.log(`Guardats ${Object.keys(dataToReturn).length} grups en ${filename}`)
  for (const lineTrain of Object.keys(dataToReturn)) {
    console.log(` - ${lineTrain}: ${dataToReturn[lineTrain].length} rutes`)
  }
}


// Init
extract().catch(err => {
    console.error('Error:', err.message || err)
    process.exit(1)
})

