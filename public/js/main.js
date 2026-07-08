const REFRESH_TIME = 30 // seconds

const {
    getTrainIdFromUrl,
    getLineFromId,
    restartRefreshCountdown,
    toggleLineFilter,
    setErrorMessage,
    setLoading
} = window.CommonFunctions

// Initialize map on initPaintress
let map

// Marker cluster
let markers

// Countdown interval reference (cleared on each refresh to avoid leaks)
let countdownInterval = null

// Filter state - all lines active by default
const activeLines = new Set(['R1', 'R11', 'RG1'])

// Cache last fetched data for re-rendering on filter toggle
let lastData = null
let lastIncidents = []

// Icons
const imageR1 = 'images/lines/r1.webp'
const imageR11 = 'images/lines/r11.webp'
const imageRG1 = 'images/lines/rg1.webp'
const imageDefault = 'images/lines/rodalies.webp'

// Fetch train data from proxy server
document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('map')) return

    // Initialize map and marker cluster
    map = L.map('map', {
        center: [41.53324928604702, 2.445498794906298],
        zoom: 12,
        zoomControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    markers = L.markerClusterGroup({
        maxClusterRadius: 40,
        showCoverageOnHover: false
    })

    // Initial load
    initPaintress() 

    // Set refresh timer
    setInterval(initPaintress, REFRESH_TIME * 1000)
})

// Fetch realtime train data and update map
async function initPaintress() {
    // Set loading view
    setLoading(true)

    // Clear error message
    setErrorMessage('', true)

    countdownInterval = restartRefreshCountdown(REFRESH_TIME, countdownInterval)

    try {
        const [incidents, data] = await Promise.all([
            getIncidents(),
            fetch('/api/trains.json').then(res => res.json())
        ])

        if (data && data.length > 0) {
            lastData = data
            lastIncidents = incidents

            renderMarkers(data, incidents)

            // Show error if focused train not found in data at all
            const trainIdToFocus = getTrainIdFromUrl()
            if (trainIdToFocus && !data.some(e => e.id === trainIdToFocus)) {
                setErrorMessage(`No s'ha pogut trobar el tren ${trainIdToFocus}. Si l'ID és correcte, el tren està aturat en l'última parada o no hi ha informació de posició disponible. Quan s'actualitzi, Renfe oferirà la informació i es mostrarà al mapa.`)
            }
        }

    } catch (error) {
        console.error('Error loading train data:', error)
        setErrorMessage()
    }

    // Remove loading view
    setLoading(false)
}

// Fetch incidents data
async function getIncidents() {
    try {
        const data = await fetch('/api/incidents.json').then(res => res.json())
        return data || []

    }catch (error) {
        console.error('Error loading incidents data:', error)
        return []
    }
}

// Toggle line visibility and re-render with cached data
function toggleLine(line) {
    toggleLineFilter(activeLines, line)

    if (lastData) renderMarkers(lastData, lastIncidents)
}
window.toggleLine = toggleLine

// Render markers filtered by activeLines
function renderMarkers(data, incidents) {
    markers.clearLayers()

    const trainIdToFocus = getTrainIdFromUrl()
    let trainFocusLocation = []

    data.forEach(entity => {
        if (!entity.vehicle.position || !entity.vehicle.position.latitude || !entity.vehicle.position.longitude) {
            console.warn(`Train ${entity.id ?? 'unknown'} has no position data, skipping.`)
            return
        }

        // Save focus location before filtering so navigation works even if line is toggled off
        if (trainIdToFocus && entity.id === trainIdToFocus) {
            trainFocusLocation = [entity.vehicle.position.latitude, entity.vehicle.position.longitude]
        }

        // Filter by active line
        const line = getLineFromId(entity.id)
        if (line && !activeLines.has(line)) return

        const focusOn = !!(trainIdToFocus && entity.id === trainIdToFocus)

        // Has incidents?
        let incidentsList = []
        if (incidents.length > 0) {
            incidents.forEach(incident => {
                if (incident.routes && incident.routes.some(route => entity.vehicle.trip.route_id && entity.vehicle.trip.route_id.includes(route))) {
                    incidentsList.push(`${incident.description}`)
                }
            })
        }

        // Has delay?
        let hasDelay = (entity.vehicle.delay && entity.vehicle.delay > 0)

        // Create marker
        const marker = L.marker([
            entity.vehicle.position.latitude,
            entity.vehicle.position.longitude
        ], { icon: iconBuilder(entity.id, entity.vehicle.currentStatus, (incidentsList.length > 0), hasDelay, focusOn) })
        .bindPopup(formatPopup(entity, incidentsList), { autoClose: false })

        marker.on('popupopen', () => {
            const popupEl = marker.getPopup().getElement()
            if (!popupEl) return

            const current = popupEl.querySelector(`#current-stop-${entity.id}`)
            if (current) current.scrollIntoView({ block: 'start' })

            const latlonList = popupEl.querySelectorAll(`li[data-latlon]`)
            if (latlonList && latlonList.length > 0) drawTrainRoutes(marker, latlonList)
        })

        markers.addLayer(marker)
    })

    map.addLayer(markers)

    if (trainIdToFocus && trainFocusLocation.length === 2) map.setView(trainFocusLocation, 15)
}

// Event copy follow link
document.addEventListener('click', (e) => {
    if (e.target.closest('.btnShare')) {
        const target = e.target.closest('.btnShare')
        const trainId = target.closest('[data-trainid]').getAttribute('data-trainid')
        if (!trainId) return

        const url = new URL(window.location.href)
        url.searchParams.set('trainId', trainId)

        // Copy to clipboard
        navigator.clipboard.writeText(url.toString()).then(() => {            
            const label = target.querySelector('span')
            
            // Revert text after 4 seconds
            if (label) {
                label.textContent = 'Link copiat!'
                label.classList.add('text-green-400')

                setTimeout(() => {
                    label.textContent = 'Compartir tren'
                    label.classList.remove('text-green-400')
                }, 4000)
            }
        })
            
    }
})

// Build custom icon for train marker
function iconBuilder(id, status, incidentsList, hasDelay, focusOn = false) {
    let image = imageDefault
    let extraClass = ''

    // Image by line
    if (id) {
        if (id.includes('R1-')) image = imageR1
        else if (id.includes('R11-')) image = imageR11
        else if (id.includes('RG1-')) image = imageRG1
    }

    // Status image
    if (status === 'INCOMING_AT') extraClass = 'animate-moving-left'

    return L.divIcon({
            className: '', // Deja vacío para usar solo Tailwind
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16],
            html: `
                <div class="relative p-1.5 w-10 h-10 ${extraClass}">
                    <img src="${image}" class="w-10 h-10 rounded-md shadow ${focusOn ? 'ring-4 ring-orange-500' : ''}" />
                    ${hasDelay || incidentsList ? 
                        `<div class="absolute flex space-x-0.5 -top-1 -left-1">
                            ${incidentsList ? `<img src="icons/alert.svg" class="w-5 h-5 rounded-full border-2 border-red-400 bg-red-100" />` : ''}
                            ${hasDelay ? `<img src="icons/clock.svg" class="w-5 h-5 rounded-full border-2 border-red-400 bg-red-100" />` : ''}
                        </div>` 
                    : ''}
                </div>
            `
        })
}

// Draw train routes on map
function drawTrainRoutes(marker, latlonList) {
    const routeCoords = []

    latlonList.forEach(li => {
        const latlon = li.getAttribute('data-latlon')
        if (latlon) {
            const [lat, lon] = latlon.split(',')
            routeCoords.push([parseFloat(lat), parseFloat(lon)])
        }
    })

    // Draw polyline
    const polyline = L.polyline(routeCoords, { color: 'blue', weight: 4, opacity: 0.7 })
    polyline.addTo(map)

    // Remove polyline on popup close
    marker.on('popupclose', () => {
        map.removeLayer(polyline)
    })
}

// Format timestamp to readable date (Madrid timezone, DD-MM-YYYY HH:MM:SS)
function formatDate(timestamp) {
    const d = new Date(timestamp * 1000)
    const opts = {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }
    const parts = new Intl.DateTimeFormat('es-ES', opts).formatToParts(d)
    const p = {}
    
    parts.forEach(({ type, value }) => { p[type] = value })
    return `${p.hour}:${p.minute}:${p.second}`
}

function sumDelayToTime(time, delay) {
    const [hours, minutes] = time.split(':').map(Number)
    const date = new Date()

    date.setHours(hours)
    date.setMinutes(minutes + Math.round(delay / 60))

    const delayedHours = String(date.getHours()).padStart(2, '0')
    const delayedMinutes = String(date.getMinutes()).padStart(2, '0')

    return `${delayedHours}:${delayedMinutes}`
}

// Format popup content
function formatPopup(data, incidentsList) {
    const status = data.vehicle.currentStatus
    let stopsList = `<ol class="relative mt-2 py-2">
        <div class="absolute left-14 top-0 bottom-0 w-0.5 bg-gray-600"></div>`

    if(data.stops) {
        const delay = data.vehicle.delay // seconds

        data.stops.forEach(stop => {
            const isCurrent = stop.id == data.vehicle.stopId
            let delayArrivalTime = null

            if (delay && delay > 0) {
                const delayMinutes = Math.round(delay / 60)
                // Sum delay to original arrival time
                delayArrivalTime = sumDelayToTime(stop.arrival_time, delay)
            }

            // `id="current-stop-${data.id}"` is used to scroll into view when popup opens
            stopsList += `
                <li ${isCurrent ? `id="current-stop-${data.id}"` : ''} class="flex items-start text-sm px-2 py-2 ${isCurrent ? 'font-bold bg-yellow-600/70 rounded-md py-1' : ''}" data-latlon="${stop.latlon ? `${stop.latlon.lat},${stop.latlon.lon}` : ''}">
                    <div class=" flex-col w-6 text-right select-none">
                        <span class="${delayArrivalTime ? 'line-through' : ''}">${stop.arrival_time}</span>
                        ${delayArrivalTime ? `<span class="text-red-400">${delayArrivalTime}</span>` : ''}
                    </div>
                    <div class="relative w-4.5 ms-4 flex items-start justify-center">
                        <div class="w-3 h-3 bg-gray-200 rounded-full border border-gray-500 z-10 mt-1 ${status === 'INCOMING_AT' && isCurrent ? 'animate-moving-down' : ''}"></div>
                    </div>
                    <span class="ms-2">${stop.name}</span>
                </li>
            `
        })

    }else stopsList += `<p>No hi ha informació de parades disponible.</p>`
    
    stopsList += `</ol>`

    return `
            <div class="mb-2" data-trainid="${data.id}">
                <h3 class="text-lg font-bold">${data.vehicle.end_station || 'N/A'}</h3>
                <div class="flex space-x-2 items-start">
                    <div class="btnShare flex items-center space-x-2 cursor-pointer px-4 py-2 rounded-xl border border-gray-600 hover:bg-gray-800 w-max">
                        <span class="text-md uppercase">Compartir tren</span>
                        <img src="icons/share.svg" class="w-5 h-5 invert rounded-md" />
                    </div>

                    <div class="flex-1 min-w-0 flex flex-col text-end text-sm text-gray-400 mb-2">
                        <small>Tren ID: ${data.id}</small>
                        <small>Últ. act.: ${formatDate(data.vehicle.timestamp)}</small>
                    </div>
                </div>
            </div>

            <h3 class="mt-4 font-semibold">Parades:</h3>
            <div id="stops-${data.id}" class="max-h-40 overflow-y-auto mb-2">
                ${stopsList}
            </div>

            ${
                incidentsList && incidentsList.length > 0 ? `
                    ${ '<div class="max-h-36 overflow-y-scroll text-xs md:max-h-56 md:text-sm md:overflow-y-auto">' +
                        incidentsList.map(incident => {
                            if (!incident) return ''
                            return `<div class="container-incidents h-16 flex flex-row items-start space-x-3 mt-2 p-3 bg-red-950 border border-red-800 rounded-md">
                                        <div class="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-red-900">
                                            <img src="icons/alert.svg" class="w-4 h-4 inline-block" />
                                        </div>
                                        <span class="text-red-400">${incident}</span>
                                    </div>`
                        }).join('') 
                    }` + '</div>'
                : ''
            }
    `
}
