const REFRESH_TIME = 30 // seconds

// Initialize map on initPaintress
let map

// Marker cluster
let markers

// Icons
const imageR1 = 'images/lines/r1.webp'
const imageRG1 = 'images/lines/rg1.webp'
const imageDefault = 'images/lines/rodalies.webp'

// Fetch train data from proxy server
document.addEventListener('DOMContentLoaded', async () => {
   // Initialize map and marker cluster
    map = L.map('map', {
        center: [41.53324928604702, 2.445498794906298],
        zoom: 12
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    markers = L.markerClusterGroup({
        maxClusterRadius: 40,
        showCoverageOnHover: false
    })

    // Initial load
    initPaintress() 

    // Set refresh timer
    // setInterval(initPaintress, REFRESH_TIME * 1000)
})

// Fetch realtime train data and update map
async function initPaintress() {
    // Clear error message
    setErrorMessage('', true)

    // Get incidents data
    const incidents = await getIncidents()
    
    // Set time left
    const refreshTimeEl = document.getElementById('refreshTime')

    if (refreshTimeEl) {
        let timeLeft = REFRESH_TIME
        const interval = setInterval(() => {
            timeLeft--
            refreshTimeEl.textContent = timeLeft

            if (timeLeft <= 0) clearInterval(interval)
        }, 1000)
    }

    const trainIdToFocus = getUrlParameter()
    let trainFocusLocation = []

    // Clear existing markers
    markers.clearLayers()

    try {
        const data = await fetch('/api/trains.json').then(res => res.json())

        if (data && data.length > 0) {
            data.forEach(entity => {
                // Some trains may not have position data, skip those
                if (!entity.vehicle.position.latitude || !entity.vehicle.position.longitude) {
                    console.warn(`Train ${entity.id ?? 'unknown'} has no position data, skipping.`)
                    return
                }
                
                // If it's the train to focus, save its location
                let focusOn = false
                if (trainIdToFocus && entity.id === trainIdToFocus) {
                    focusOn = true
                    trainFocusLocation = [
                        entity.vehicle.position.latitude,
                        entity.vehicle.position.longitude
                    ]
                }

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
                .bindPopup(formatPopup(entity, incidentsList), { width: "550px" })

                // On popup open
                marker.on('popupopen', () => {
                    const popupEl = marker.getPopup().getElement()
                    if (!popupEl) return

                    // Scroll to current stop
                    const current = popupEl.querySelector(`#current-stop-${entity.id}`)
                    if (current) current.scrollIntoView({ block: 'start' }) // Scroll to current stop

                    // Draw route on map
                    const latlonList = popupEl.querySelectorAll(`li[data-latlon]`)
                    if (latlonList && latlonList.length > 0) drawTrainRoutes(marker, latlonList)
                })

                markers.addLayer(marker)
            })
            
            map.addLayer(markers)

            // Focus on a train if ID is provided or show error if not found
            if (trainIdToFocus && trainFocusLocation.length === 2) map.setView(trainFocusLocation, 15)
            else if (trainIdToFocus) setErrorMessage(`No s'ha pogut trobar el tren ${trainIdToFocus}. Pot ser que la API no l'estigui mostrant o que el ID sigui incorrecte. Proba en uns segons.`)
        }

    } catch (error) {
        console.error('Error loading train data:', error)
        setErrorMessage()
    }
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
            const msg = target.nextElementSibling
            
            if (msg) {
                msg.classList.remove('hidden')
                setTimeout(() => {
                    msg.classList.add('hidden')
                }, 4000)
            }
        })
            
    }
})

// Focus on a train by ID
function getUrlParameter() {
    const params = new URLSearchParams(window.location.search)
    return params.get('trainId') || null
}

// Build custom icon for train marker
function iconBuilder(id, status, incidentsList, hasDelay, focusOn = false) {
    let image = imageDefault
    let extraClass = ''
   
    // Image
    if (id.includes('R1-')) image = imageR1
    else if (id.includes('RG1-')) image = imageRG1

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

// Errors message
function setErrorMessage(message = "Alguna cosa ha anat malament. Torna-ho a intentar més tard.", clear = false) {
    const errorMessage = document.getElementById('txtErrorMessage')
                
    if (errorMessage) {
        errorMessage.textContent = message

        if (clear) errorMessage.classList.add('hidden')
        else errorMessage.classList.remove('hidden')
    }
}

// Format popup content
function formatPopup(data, incidentsList) {
    const status = data.vehicle.currentStatus
    let stopsList = `<ol class="relative mt-2 py-2">
        <div class="absolute left-14 top-0 bottom-0 w-0.5 bg-gray-300"></div>`

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
                <li ${isCurrent ? `id="current-stop-${data.id}"` : ''} class="flex items-start px-2 py-4 ${isCurrent ? 'font-bold bg-yellow-100 rounded-md py-1' : ''}" data-latlon="${stop.latlon ? `${stop.latlon.lat},${stop.latlon.lon}` : ''}">
                    <div class=" flex-col w-6 text-right select-none">
                        <span class="${delayArrivalTime ? 'line-through' : ''}">${stop.arrival_time}</span>
                        ${delayArrivalTime ? `<span class="text-red-600">${delayArrivalTime}</span>` : ''}
                    </div>
                    <div class="relative w-4.5 ms-4 flex items-start justify-center">
                        <div class="w-3 h-3 bg-black rounded-full border border-gray-700 z-10 mt-1 ${status === 'INCOMING_AT' && isCurrent ? 'animate-moving-down' : ''}"></div>
                    </div>
                    <span class="ms-2">${stop.name}</span>
                </li>
            `
        })

    }else stopsList += `<p>No hi ha informació de parades disponible.</p>`
    
    stopsList += `</ol>`

    return `
            <div class="mb-2" data-trainid="${data.id}">
                <h3 class="text-lg font-bold">Destinació: ${data.vehicle.end_station || 'N/A'}</h3>
                <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <small>Tren ID: ${data.id}</small>
                    <small>Última actualització: ${formatDate(data.vehicle.timestamp)}</small>
                </div>

                <div class="flex space-x-2 items-center">
                    <div class="btnShare flex items-center space-x-2 cursor-pointer px-2 py-1 rounded-full border border-gray-300 hover:bg-gray-100 w-max">
                        <span>Compartir tren</span>
                        <img src="icons/share.svg" class="w-4 h-4 rounded-md" />
                    </div>

                    <small class="hidden text-blue-400">Link copiat!</small>
                </div>
            </div>

            <h3 class="mt-4 font-semibold">Parades:</h3>
            <div id="stops-${data.id}" class="max-h-40 overflow-y-auto">
                ${stopsList}
            </div>

            ${incidentsList && incidentsList.length > 0 ? incidentsList.map(incident => {
                if (!incident) return ''
                return `<div class="container-incidents flex flex-row items-start space-x-3 mt-5 p-3 bg-red-100 border border-red-400 rounded-md">
                            <div class="flex-none w-10 h-10 flex items-center justify-center rounded-full bg-red-200">
                                <img src="icons/alert.svg" class="w-5 h-5 inline-block" />
                            </div>
                            <span class="text-sm text-red-700 ">${incident}</span>
                        </div>`
            }).join('') : ''}
    `
}
