const REFRESH_TIME = 30

const {
    getTrainIdFromUrl,
    getLineFromId,
    restartRefreshCountdown,
    toggleLineFilter,
    setErrorMessage,
    setLoading
} = window.CommonFunctions

let countdownInterval = null
let filteredTrains = null
const activeLines = new Set(['R1', 'R11', 'RG1'])

const imageR1 = '/images/lines/r1.webp'
const imageR11 = '/images/lines/r11.webp'
const imageRG1 = '/images/lines/rg1.webp'

const lineImages = {
    R1: imageR1,
    R11: imageR11,
    RG1: imageRG1
}

const modal = document.getElementById('modal-train-timeline')
const btnModalClose = modal.querySelector('#modal-train-close')
const btnFollowLink = modal.querySelector('#modal-follow-link')

document.addEventListener('DOMContentLoaded', () => {
    loadData()
    setInterval(loadData, REFRESH_TIME * 1000)
})

if (btnModalClose) {
    btnModalClose.addEventListener('click', () => {
        closeModalTimeline()
    })
}
if (btnFollowLink) {
    btnFollowLink.addEventListener('click', () => {
        const followLink = btnFollowLink.dataset.followlink
        if (followLink) {
            // Copy to clipboard
            navigator.clipboard.writeText(followLink).then(() => {            
                const label = btnFollowLink.querySelector('span')
                
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
}

async function loadData() {
    setLoading(true)
    setErrorMessage('', true)

    countdownInterval = restartRefreshCountdown(REFRESH_TIME, countdownInterval)

    try {
        const [incidents, trains] = await Promise.all([
            fetch('/api/incidents.json').then(res => res.json()),
            fetch('/api/trains.json').then(res => res.json())
        ])

        renderTrains(trains, incidents)
        renderIncidents(incidents)
    } catch (error) {
        console.error('Error loading data:', error)
        setErrorMessage()
    }

    setLoading(false)
}

function toggleLine(line) {
    toggleLineFilter(activeLines, line)
    loadData()
}
window.toggleLine = toggleLine

function showToast(message) {
    let toast = document.getElementById('toast')
    if (!toast) {
        toast = document.createElement('div')
        toast.id = 'toast'
        toast.className = 'fixed bottom-4 right-4 px-4 py-2 bg-green-600 text-white rounded-lg shadow-lg transition-opacity duration-300 z-50'
        document.body.appendChild(toast)
    }
    toast.textContent = message
    toast.style.opacity = '1'
    setTimeout(() => {
        toast.style.opacity = '0'
    }, 2000)
}

function renderTrains(trains, incidents) {
    const tbody = document.getElementById('train-list-body')
    if (!tbody) return

    const trainIdToFocus = getTrainIdFromUrl()

    filteredTrains = trains.filter(train => {
        const line = getLineFromId(train.id)
        return line && activeLines.has(line)
    })

    if (filteredTrains.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-gray-500">
                    No hi ha trens actius en aquest moment.
                </td>
            </tr>
        `
        return
    }

    tbody.innerHTML = filteredTrains.map(train => {
        const line = getLineFromId(train.id)
        const image = lineImages[line] || '/images/lines/rodalies.webp'
        const delay = train.vehicle.delay || 0
        const delayMinutes = Math.round(delay / 60)
        const hasDelay = delay > 0

        const trainIncidents = incidents.filter(incident =>
            incident.routes && incident.routes.some(route =>
                train.vehicle.trip.route_id && train.vehicle.trip.route_id.includes(route)
            )
        )
        const hasIncidents = trainIncidents.length > 0

        const status = train.vehicle.currentStatus === 'INCOMING_AT' ? 'En marxa' : 'Aturat'
        const isFocused = trainIdToFocus && train.id === trainIdToFocus

        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${isFocused ? 'bg-yellow-600/70' : ''}"
                onclick="openModalTimeline('${train.id}')"
                title="Clic per copiar link del tren">
                <td class="py-1.5 md:py-2 px-4 md:px-2">
                    <div class="flex items-center gap-2 md:gap-1.5">
                        <img src="${image}" class="w-4 h-4 md:w-5 md:h-5 rounded" alt="${line}" />
                        <span class="font-bold">${line}</span>
                    </div>
                </td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">
                    ${train.vehicle.end_station || 'N/A'}
                </td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">
                    ${train.vehicle.stopName || 'N/A'}
                </td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">
                    ${train.vehicle.next_stop || '-'}
                </td>
                <td class="py-1.5 md:py-2 px-3 md:px-2 text-center">
                    ${hasDelay ? `
                        <span class="inline-flex items-center justify-center gap-0.5 px-1.5 md:px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 text-[10px] md:text-xs font-medium whitespace-nowrap">
                            <img src="/icons/clock.svg" class="w-2.5 h-2.5 md:w-3 md:h-3" alt="" />
                            ${delayMinutes}min
                        </span>
                    ` : `
                        <span class="text-gray-500">-</span>
                    `}
                </td>
                <td class="py-1.5 md:py-2 px-1.5 md:px-2">
                    <div class="flex items-center gap-1 md:gap-2">
                        <span class="text-[10px] md:text-xs ${status === 'En marxa' ? 'text-green-400' : 'text-gray-400'}">
                            ${status}
                        </span>
                        ${hasIncidents ? `
                            <img src="/icons/alert.svg" class="w-3 h-3 md:w-4 md:h-4" title="${trainIncidents.map(i => i.description).join(', ')}" alt="Incidència" />
                        ` : ''}
                    </div>
                </td>
            </tr>
        `
    }).join('')
}

function renderIncidents(incidents) {
    const container = document.getElementById('incidents-container')
    const list = document.getElementById('incidents-list')
    if (!container || !list) return

    if (!incidents || incidents.length === 0) {
        container.classList.add('hidden')
        return
    }

    container.classList.remove('hidden')
    list.innerHTML = incidents.map(incident => `
        <div class="flex items-start gap-3 p-3 bg-red-950 border border-red-800 rounded-md">
            <div class="flex-none w-8 h-8 flex items-center justify-center rounded-full bg-red-900">
                <img src="/icons/alert.svg" class="w-4 h-4" alt="" />
            </div>
            <span class="text-red-400 text-sm">${incident.description}</span>
        </div>
    `).join('')
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

// Sum delay (in seconds) to time (HH:MM) and return new time (HH:MM)
function sumDelayToTime(time, delay) {
    const [hours, minutes] = time.split(':').map(Number)
    const date = new Date()

    date.setHours(hours)
    date.setMinutes(minutes + Math.round(delay / 60))

    const delayedHours = String(date.getHours()).padStart(2, '0')
    const delayedMinutes = String(date.getMinutes()).padStart(2, '0')

    return `${delayedHours}:${delayedMinutes}`
}

// MODAL
function openModalTimeline(trainId) {
    if (!modal) return
    
    // Config modal
    const train = filteredTrains.find(t => t.id === trainId)
    if (!train) return

    // image
    const line = getLineFromId(trainId)
    const image = lineImages[line] || '/images/lines/rodalies.webp'
    const lineImageEl = document.getElementById('modal-train-line-image')
    if (lineImageEl) lineImageEl.src = image

    // title
    const titleEl = document.getElementById('modal-train-title')
    if (titleEl) titleEl.textContent = `${trainId}`

    // subtitle
    const subtitleEl = document.getElementById('modal-train-subtitle')
    if (subtitleEl) subtitleEl.textContent = `Últ. act.: ${formatDate(train.vehicle.timestamp)}`

    // follow link
    const followLinkEl = document.getElementById('modal-follow-link')
    if (followLinkEl) {
        const url = new URL(window.location.href)
        url.searchParams.set('trainId', trainId)
        followLinkEl.dataset.followlink = url.toString()
    }

    // render timeline
    renderTimeline(trainId)

    modal.classList.remove('hidden')
    requestAnimationFrame(() => scrollTimelineToCurrent(trainId))
}

function renderTimeline(trainId) {
    const train = filteredTrains.find(t => t.id === trainId)
    const stopsListEl = document.getElementById('modal-train-timeline-content')
    
    if (train?.stops) {
        const delay = train.vehicle.delay // seconds
        const status = train.vehicle.currentStatus
        let stopsList = `<ol class="relative">
        <div class="absolute left-14 top-0 bottom-0 w-0.5 bg-gray-600"></div>`

        train.stops.forEach(stop => {
            const isCurrent = stop.id == train.vehicle.stopId
            let delayArrivalTime = null

            if (delay && delay > 0) {
                // Sum delay to original arrival time
                delayArrivalTime = sumDelayToTime(stop.arrival_time, delay)
            }

            // `id="current-stop-${train.id}"` is used to scroll into view when popup opens
            stopsList += `
                <li ${isCurrent ? `id="current-stop-${train.id}"` : ''} class="flex items-start text-sm px-2 py-2 ${isCurrent ? 'font-bold bg-yellow-600/70 rounded-md py-1' : ''}" data-latlon="${stop.latlon ? `${stop.latlon.lat},${stop.latlon.lon}` : ''}">
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
       
        if (stopsListEl) {
            stopsListEl.innerHTML = stopsList + '</ol>'
        }

    } else {
        if (stopsListEl) stopsListEl.innerHTML = `<p>No hi ha informació de parades disponible.</p>`
    }
}

function scrollTimelineToCurrent(trainId) {
    const stopsListEl = document.getElementById('modal-train-timeline-content')
    if (!stopsListEl) return

    const current = stopsListEl.querySelector(`#current-stop-${trainId}`)
    if (!current) return

    current.scrollIntoView({ block: 'start', inline: 'nearest' })
}

function closeModalTimeline() {
    if (!modal) return
    modal.classList.add('hidden')
}
