const REFRESH_TIME = 30

let countdownInterval = null
const activeLines = new Set(['R1', 'R11', 'RG1'])

const imageR1 = '/images/lines/r1.webp'
const imageR11 = '/images/lines/r11.webp'
const imageRG1 = '/images/lines/rg1.webp'

const lineImages = {
    R1: imageR1,
    R11: imageR11,
    RG1: imageRG1
}

function getTrainIdFromUrl() {
    const params = new URLSearchParams(window.location.search)
    return params.get('trainId') || null
}

document.addEventListener('DOMContentLoaded', () => {
    loadData()
    setInterval(loadData, REFRESH_TIME * 1000)
})

async function loadData() {
    setLoading(true)
    setErrorMessage('', true)

    const refreshTimeEl = document.getElementById('refreshTime')
    if (refreshTimeEl) {
        let timeLeft = REFRESH_TIME
        if (countdownInterval) clearInterval(countdownInterval)
        countdownInterval = setInterval(() => {
            timeLeft--
            refreshTimeEl.textContent = timeLeft
            if (timeLeft <= 0) clearInterval(countdownInterval)
        }, 1000)
    }

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

function getLineFromId(id) {
    if (!id) return null
    if (id.includes('RG1-')) return 'RG1'
    if (id.includes('R11-')) return 'R11'
    if (id.includes('R1-')) return 'R1'
    return null
}

function toggleLine(line) {
    if (activeLines.has(line)) activeLines.delete(line)
    else activeLines.add(line)

    const btn = document.getElementById(`filter-${line}`)
    if (btn) btn.classList.toggle('line-filter-inactive', !activeLines.has(line))

    loadData()
}
window.toggleLine = toggleLine

function copyTrainUrl(trainId) {
    const url = new URL(window.location.href)
    url.searchParams.set('trainId', trainId)
    navigator.clipboard.writeText(url.toString()).then(() => {
        showToast('Link copiat per seguir el tren!')
    })
}

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

    const filteredTrains = trains.filter(train => {
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
                onclick="copyTrainUrl('${train.id}')"
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

function setErrorMessage(message = "Alguna cosa ha anat malament. Torna-ho a intentar més tard.", clear = false) {
    const errorMessage = document.getElementById('txtErrorMessage')
    if (errorMessage) {
        errorMessage.textContent = message
        if (clear) errorMessage.classList.add('hidden')
        else errorMessage.classList.remove('hidden')
    }
}

function setLoading(isLoading) {
    const loadingEl = document.getElementById('loading')
    if (loadingEl) {
        if (isLoading) loadingEl.classList.remove('hidden')
        else loadingEl.classList.add('hidden')
    }
}
