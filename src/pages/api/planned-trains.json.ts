export const prerender = false

import { DESIRED_LINES, type DesiredLine } from '@/scripts/line-utils'
import stationsJSON from '@public/files/output/estacions.json' with { type: 'json' }
import tripsJSON from '@public/files/output/trips_filtered.json' with { type: 'json' }
import stopTimesJSON from '@public/files/output/stop_times_filtered.json' with { type: 'json' }

type StationRecord = [unknown, string | number, string, string, string]
type Trip = {
    route_id: string
    trip_id: string
    wheelchair_accessible: string
}
type ScheduledStop = Stop & {
    line: DesiredLine
}
type VehiclePositionsResponse = {
    entity?: TrainElement[]
}

const stationMap = new Map<string, StationRecord>(
    (stationsJSON.records as StationRecord[]).map(station => [String(station[1]), station])
)
const trips = tripsJSON as Record<DesiredLine, Trip[]>
const stopTimes = stopTimesJSON as StopJSON
const tripsMap: Record<DesiredLine, Map<string, Trip>> = {
    R1: new Map(trips.R1.map(trip => [trip.trip_id, trip])),
    R11: new Map(trips.R11.map(trip => [trip.trip_id, trip])),
    RG1: new Map(trips.RG1.map(trip => [trip.trip_id, trip]))
}
const stopTimesMap: Record<DesiredLine, Map<string, Stop[]>> = { R1: new Map(), R11: new Map(), RG1: new Map() }
const stationStopsMap = new Map<string, ScheduledStop[]>()

for (const line of DESIRED_LINES) {
    for (const stop of stopTimes[line]) {
        const tripStops = stopTimesMap[line].get(stop.trip_id) ?? []
        tripStops.push(stop)
        stopTimesMap[line].set(stop.trip_id, tripStops)

        const stationStops = stationStopsMap.get(stop.stop_id) ?? []
        stationStops.push({ ...stop, line })
        stationStopsMap.set(stop.stop_id, stationStops)
    }
}

const TARGET = 'https://gtfsrt.renfe.com/vehicle_positions.json'
const BASE_HEADERS = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'interest-cohort=()'
}

export async function GET({ request }: { request: Request }) {
    const stationId = new URL(request.url).searchParams.get('stationId')

    if (!stationId || !stationMap.has(stationId)) {
        return new Response(JSON.stringify({ error: 'Invalid stationId' }), { status: 400, headers: BASE_HEADERS })
    }

    try {
        const response = await fetch(TARGET)
        const data = await response.json() as VehiclePositionsResponse
        const activeTripIds = new Set((data.entity ?? []).map(train => train.vehicle?.trip?.tripId).filter((tripId): tripId is string => Boolean(tripId)).map(getTripKey))
        const currentMinutes = getCurrentMinutes()
        const plannedTrains = (stationStopsMap.get(stationId) ?? [])
            .map(stop => createPlannedTrain(stop, activeTripIds, currentMinutes, getCurrentServiceDay()))
            .filter((train): train is TrainElement => train !== null)
            .sort((a, b) => getStationTime(a, stationId) - getStationTime(b, stationId))
            .slice(0, 10)

        return new Response(JSON.stringify(plannedTrains), {
            status: 200,
            headers: {
                ...BASE_HEADERS,
                'Cache-Control': 's-maxage=20, stale-while-revalidate=20'
            }
        })
    } catch (error) {
        console.error('Error fetching or processing planned trains:', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch or process planned trains' }), { status: 500, headers: BASE_HEADERS })
    }
}

function createPlannedTrain(stop: ScheduledStop, activeTripIds: Set<string>, currentMinutes: number, serviceDay: string): TrainElement | null {
    const trip = tripsMap[stop.line].get(stop.trip_id) as TripRaw | undefined
    const tripStops = stopTimesMap[stop.line].get(stop.trip_id) ?? []
    const firstStop = tripStops[0]
    const lastStop = tripStops[tripStops.length - 1]

    if (!trip || !trip.service_id.endsWith(serviceDay) || !firstStop || !lastStop || activeTripIds.has(getTripKey(stop.trip_id)) || getTimeInMinutes(firstStop.departure_time || firstStop.arrival_time) <= currentMinutes) {
        return null
    }

    const nextStop = tripStops[1]
    const position = getStationLatLonById(firstStop.stop_id)
    const relevantStops = [firstStop, nextStop, stop]
        .filter((tripStop): tripStop is Stop => Boolean(tripStop))
        .filter((tripStop, index, stops) => stops.findIndex(item => item.stop_id === tripStop.stop_id && item.stop_sequence === tripStop.stop_sequence) === index)

    return {
        id: `planned-${stop.line}-${trip.trip_id}`,
        vehicle: {
            stopId: firstStop.stop_id,
            stopName: getStationNameById(firstStop.stop_id),
            position: { latitude: position?.lat ?? 0, longitude: position?.lon ?? 0 },
            trip: {
                tripId: trip.trip_id,
                route_id: trip.route_id,
                wheelchair_accessible: trip.wheelchair_accessible
            },
            start_station: getStationNameById(firstStop.stop_id),
            end_station: getStationNameById(lastStop.stop_id),
            next_stop: nextStop ? getStationNameById(nextStop.stop_id) : undefined,
            delay: 0,
            currentStatus: 'SCHEDULED'
        },
        stops: relevantStops.map(tripStop => ({
            id: tripStop.stop_id,
            name: getStationNameById(tripStop.stop_id),
            arrival_time: formatStringTimeToHHMM(tripStop.arrival_time),
            departure_time: formatStringTimeToHHMM(tripStop.departure_time),
            latlon: getStationLatLonById(tripStop.stop_id)
        }))
    }
}

function getCurrentMinutes(): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Europe/Madrid'
    }).formatToParts()
    const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
    const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)

    return hour * 60 + minute
}

function getStationTime(train: TrainElement, stationId: string): number {
    const stop = train.stops?.find(trainStop => trainStop.id === stationId)
    return getTimeInMinutes(stop?.departure_time || stop?.arrival_time || '')
}

function getTimeInMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return (hours % 24) * 60 + minutes
}

function getTripKey(tripId: string): string {
    const match = tripId.match(/^\d+[A-Z]+(\d+(?:RG1|R11|R1))$/)
    return match ? match[1] : tripId
}

function getCurrentServiceDay(): string {
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Madrid' }).format(new Date())
    return { Mon: 'L', Tue: 'M', Wed: 'X', Thu: 'J', Fri: 'V', Sat: 'S', Sun: 'D' }[weekday] ?? ''
}

function getStationNameById(id: string): string {
    return stationMap.get(String(id))?.[2] ?? 'Unknown'
}

function getStationLatLonById(id: string): StopLatLon | null {
    const station = stationMap.get(String(id))
    return station ? { lat: parseFloat(station[3]), lon: parseFloat(station[4]) } : null
}

function formatStringTimeToHHMM(time: string): string {
    if (!time) return 'N/A'
    const [hours, minutes] = time.split(':')
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}
