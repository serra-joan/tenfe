const REFRESH_TIME = 30

const { restartRefreshCountdown, setErrorMessage, setLoading } = window.CommonFunctions
const search = document.getElementById('station-search')
const results = document.getElementById('station-results')
const message = document.getElementById('stations-message')
const trainsContainer = document.getElementById('station-trains')
const modal = document.getElementById('modal-train-timeline')
const modalClose = document.getElementById('modal-train-close')
const modalFollowLink = document.getElementById('modal-follow-link')

let stations = []
let activeStation = null
let trains = []
let countdownInterval = null

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const stationData = await fetch('/files/output/estacions.json').then(response => response.json())
        stations = stationData.records.map(record => ({ code: String(record[1]), name: record[2], municipality: record[7], province: record[8] }))
        const stationCode = new URLSearchParams(window.location.search).get('estacio')
        if (stationCode) selectStation(stations.find(station => station.code === stationCode) || null)
    } catch (error) {
        console.error('Error loading stations:', error)
        setErrorMessage()
    }

    search.addEventListener('input', showMatches)
    search.addEventListener('focus', showMatches)
    search.addEventListener('keydown', event => { if (event.key === 'Escape') hideMatches() })
    document.addEventListener('click', event => { if (!event.target.closest('.station-search-area')) hideMatches() })
    modalClose.addEventListener('click', closeModalTimeline)
    modal.addEventListener('click', event => {
        if (event.target === modal || event.target.id === 'modal-train-backdrop') closeModalTimeline()
    })
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModalTimeline()
    })
    modalFollowLink.addEventListener('click', copyFollowLink)
})

function showMatches() {
    const query = normalize(search.value)
    if (!query) return hideMatches()

    const matches = stations.filter(station => normalize(`${station.name} ${station.municipality}`).includes(query)).slice(0, 8)
    results.innerHTML = matches.length ? matches.map(station => `<button type="button" data-station-code="${station.code}" class="station-option w-full rounded-lg px-3 py-2 text-left hover:bg-gray-800 cursor-pointer"><span class="block font-semibold">${escapeHtml(station.name)}</span><span class="block text-sm text-gray-400">${escapeHtml(station.municipality)}, ${escapeHtml(station.province)}</span></button>`).join('') : '<p class="px-3 py-2 text-sm text-gray-400">No s\'han trobat estacions.</p>'
    results.classList.remove('hidden')
    results.querySelectorAll('.station-option').forEach(button => button.addEventListener('click', () => selectStation(stations.find(station => station.code === button.dataset.stationCode))))
}

function hideMatches() { results.classList.add('hidden') }

async function selectStation(station) {
    activeStation = station
    trains = []
    hideMatches()
    trainsContainer.innerHTML = ''
    const url = new URL(window.location.href)

    if (!station) {
        search.value = ''
        message.textContent = 'Cerca i selecciona una estació per veure els propers trens.'
        url.searchParams.delete('estacio')
        window.history.replaceState({}, '', url)
        return
    }

    search.value = station.name
    message.textContent = 'Carregant els trens que passaran per aquesta estació...'
    url.searchParams.set('estacio', station.code)
    window.history.replaceState({}, '', url)
    await loadTrains()
    if (!window.stationRefreshInterval) window.stationRefreshInterval = setInterval(loadTrains, REFRESH_TIME * 1000)
}

async function loadTrains() {
    if (!activeStation) return
    setLoading(true)
    setErrorMessage('', true)
    countdownInterval = restartRefreshCountdown(REFRESH_TIME, countdownInterval)
    try {
        trains = await fetch('/api/trains.json').then(response => response.json())
        renderTrains()
        const modalTrainId = new URLSearchParams(window.location.search).get('modalTrain')
        if (modalTrainId && modal.classList.contains('hidden')) openModalTimeline(modalTrainId)
    } catch (error) {
        console.error('Error loading train data:', error)
        setErrorMessage()
    }
    setLoading(false)
}

function renderTrains() {
    const passingTrains = trains.map(train => {
        const stationIndex = train.stops?.findIndex(stop => String(stop.id) === activeStation.code) ?? -1
        const currentIndex = train.stops?.findIndex(stop => String(stop.id) === String(train.vehicle.stopId)) ?? -1
        return { train, stationIndex, currentIndex, stop: train.stops?.[stationIndex] }
    }).filter(item => item.stationIndex !== -1 && (item.currentIndex === -1 || item.stationIndex >= item.currentIndex)).sort((a, b) => timeToMinutes(a.stop.arrival_time) - timeToMinutes(b.stop.arrival_time))

    if (!passingTrains.length) {
        message.textContent = 'No hi ha trens actius que hagin de passar per aquesta estació.'
        trainsContainer.innerHTML = ''
        return
    }

    message.textContent = ''
    trainsContainer.innerHTML = `
        <table class="w-full text-xs md:text-sm">
            <thead class="sticky top-0 bg-gray-950">
                <tr class="border-b border-gray-700 text-gray-400">
                    <th class="text-left py-1.5 md:py-2 px-1.5 md:px-2">Línia</th>
                    <th class="text-left py-1.5 md:py-2 px-1.5 md:px-2">Destí</th>
                    <th class="text-left py-1.5 md:py-2 px-1.5 md:px-2">Últ. parada</th>
                    <th class="text-left py-1.5 md:py-2 px-1.5 md:px-2">Seg. parada</th>
                    <th class="text-center py-1.5 md:py-2 px-1.5 md:px-2">Retard</th>
                    <th class="text-left py-1.5 md:py-2 px-1.5 md:px-2">Estat</th>
                </tr>
            </thead>
            <tbody>${passingTrains.map(({ train, stationIndex, currentIndex, stop }) => {
        const line = getLine(train.id)
        const delay = train.vehicle.delay || 0
        const state = stationIndex === currentIndex ? 'A l\'estació' : stationIndex === currentIndex + 1 ? 'Propera parada' : 'En ruta'
        const delayMinutes = Math.round(delay / 60)
        const status = train.vehicle.currentStatus === 'INCOMING_AT' ? 'En marxa' : 'Aturat'
        return `
            <tr data-train-id="${escapeHtml(train.id)}" class="station-train border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer">
                <td class="py-1.5 md:py-2 px-4 md:px-2"><div class="flex items-center gap-2 md:gap-1.5"><img src="/images/lines/${line.toLowerCase()}.webp" class="w-4 h-4 md:w-5 md:h-5 rounded" alt="${line}" /><span class="font-bold">${line}</span></div></td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">${escapeHtml(train.vehicle.end_station || 'N/A')}</td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">${escapeHtml(train.vehicle.stopName || 'N/A')}</td>
                <td class="py-1.5 md:py-2 px-3 md:px-2">${escapeHtml(train.vehicle.next_stop || '-')}</td>
                <td class="py-1.5 md:py-2 px-3 md:px-2 text-center">${delay > 0 ? `<span class="inline-flex items-center justify-center gap-0.5 px-1.5 md:px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 text-[10px] md:text-xs font-medium whitespace-nowrap"><img src="/icons/clock.svg" class="w-2.5 h-2.5 md:w-3 md:h-3" alt="" />${delayMinutes}min</span>` : '<span class="text-gray-500">-</span>'}</td>
                <td class="py-1.5 md:py-2 px-1.5 md:px-2"><span class="text-[10px] md:text-xs ${status === 'En marxa' ? 'text-green-400' : 'text-gray-400'}">${state} · ${status}</span></td>
            </tr>
        `
    }).join('')}</tbody>
        </table>`
    trainsContainer.querySelectorAll('.station-train').forEach(button => {
        button.addEventListener('click', () => openModalTimeline(button.dataset.trainId))
    })
}

function openModalTimeline(trainId) {
    const train = trains.find(item => item.id === trainId)
    if (!train) return

    const line = getLine(train.id)
    const delay = train.vehicle.delay || 0
    document.getElementById('modal-train-line-image').src = `/images/lines/${line.toLowerCase()}.webp`
    document.getElementById('modal-train-title').textContent = train.vehicle.end_station || 'Destí desconegut'
    document.getElementById('modal-train-subtitle').textContent = `Últ. act.: ${formatDate(train.vehicle.timestamp)}`
    document.getElementById('modal-train-id').textContent = `ID: ${train.id}`
    document.getElementById('modal-train-delay').innerHTML = delay > 0 ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-900/50 text-red-400 text-xs font-medium"><img src="/icons/clock.svg" class="w-3 h-3" alt="" />${Math.round(delay / 60)}min de retard</span>` : ''

    renderTimeline(train)
    const url = new URL(window.location.href)
    url.searchParams.set('modalTrain', train.id)
    modalFollowLink.dataset.followlink = url.toString()
    window.history.replaceState({}, '', url)
    modal.classList.remove('hidden')
    requestAnimationFrame(() => document.querySelector(`#current-stop-${CSS.escape(train.id)}`)?.scrollIntoView({ block: 'start' }))
}

function renderTimeline(train) {
    const delay = train.vehicle.delay || 0
    const stops = train.stops?.map(stop => {
        const isCurrent = String(stop.id) === String(train.vehicle.stopId)
        const expectedTime = delay > 0 ? addDelay(stop.arrival_time, delay) : ''
        return `<li ${isCurrent ? `id="current-stop-${escapeHtml(train.id)}"` : ''} class="flex items-start text-sm px-2 py-2 ${isCurrent ? 'font-bold bg-yellow-600/70 rounded-md' : ''}"><div class="flex flex-col w-10 text-right select-none"><span class="${expectedTime ? 'line-through' : ''}">${stop.arrival_time}</span>${expectedTime ? `<span class="text-red-400">${expectedTime}</span>` : ''}</div><div class="relative w-4.5 ms-4 flex items-start justify-center"><div class="w-3 h-3 bg-gray-200 rounded-full border border-gray-500 z-10 mt-1"></div></div><span class="ms-2">${escapeHtml(stop.name)}</span></li>`
    }).join('') || '<p>No hi ha informació de parades disponible.</p>'
    document.getElementById('modal-train-timeline-content').innerHTML = `<ol class="relative"><div class="absolute left-18 top-0 bottom-0 w-0.5 bg-gray-600"></div>${stops}</ol>`
}

function closeModalTimeline() {
    modal.classList.add('hidden')
    const url = new URL(window.location.href)
    url.searchParams.delete('modalTrain')
    window.history.replaceState({}, '', url)
}

async function copyFollowLink() {
    const followLink = modalFollowLink.dataset.followlink
    if (!followLink) return
    await navigator.clipboard.writeText(followLink)
    const label = modalFollowLink.querySelector('span')
    label.textContent = 'Link copiat!'
    label.classList.add('text-green-400')
    setTimeout(() => {
        label.textContent = 'Compartir tren'
        label.classList.remove('text-green-400')
    }, 4000)
}

function formatDate(timestamp) {
    return new Intl.DateTimeFormat('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Europe/Madrid' }).format(new Date(timestamp * 1000))
}

function getLine(trainId) {
    if (trainId.includes('RG1-')) return 'RG1'
    if (trainId.includes('R11-')) return 'R11'
    return 'R1'
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}

function addDelay(time, delay) {
    const totalMinutes = timeToMinutes(time) + Math.round(delay / 60)
    return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`
}
function normalize(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]) }
