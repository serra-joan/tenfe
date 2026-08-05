/**
 * Executa els scripts d'extracció en ordre:
 *   1. extract_routes.js
 *   2. extract_trips.js
 *   3. extract_stop_times.js  (depèn dels dos anteriors)
 * 
 * EXEC: node scripts/run_extracts.js
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function runScript (scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- Executant ${scriptName} ---`)
    const child = spawn('node', [path.join(__dirname, scriptName)], { stdio: 'inherit' })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${scriptName} ha acabat amb codi ${code}`))
    })
    child.on('error', reject)
  })
}

async function main () {
  await runScript('extract_routes.js')
  await runScript('extract_trips.js')
  await runScript('extract_stop_times.js')
  await runScript('extract_calendar.js')
  console.log('\nTots els scripts han acabat correctament.')
}

main().catch(err => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
