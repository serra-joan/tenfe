export const prerender = false

import type { APIContext } from 'astro'
import { getTripUpdates } from '@/scripts/get-trip-updates'
import stationsJSON from '@public/files/output/estacions.json' with { type: 'json' }
import trips from '@public/files/output/trips_filtered.json' with { type: 'json' }
import stop_times from '@public/files/output/stop_times_filtered.json' with { type: 'json' }

// Pre-build O(1) lookup maps at module level (built once, reused across requests)
const stationMap = new Map<string, any[]>(
    (stationsJSON.records as any[]).map(r => [String(r[1]), r])
)
const tripsMap: Record<string, Map<string, any>> = {
    R1: new Map((trips as any).R1.map((t: any) => [t.trip_id, t])),
    R11: new Map((trips as any).R11.map((t: any) => [t.trip_id, t]))
}
const stopTimesMap: Record<string, Map<string, Stop[]>> = { R1: new Map(), R11: new Map() }
for (const line of ['R1', 'R11'] as const) {
    for (const stop of (stop_times as StopJSON)[line]) {
        const arr = stopTimesMap[line].get(stop.trip_id) ?? []
        arr.push(stop)
        stopTimesMap[line].set(stop.trip_id, arr)
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

export async function GET(context: APIContext) {
    let trainsFiltered: TrainElement[] = []

    try {
        const r = await fetch(TARGET)
        const data = await r.json()

        // Only R1
        if (data.entity && data.entity.length > 0) {
            const tripUpdates = await getTripUpdates()

            // Filter and set data
            trainsFiltered = data.entity.filter((e: TrainElement) => {
                // Filter only R1 and R11 lines
                if (e.id.includes('R1-') || e.id.includes('R11-')) { 
                    const line = e.id.includes('R1-') ? 'R1' : 'R11'

                    e.vehicle.stopName = getStationNameById(e.vehicle.stopId)

                    // Add trip info
                    const trip = tripsMap[line].get(e.vehicle.trip.tripId)
                    if (trip) {
                        e.vehicle.trip = {
                            ...e.vehicle.trip,
                            route_id: trip.route_id,
                            wheelchair_accessible: parseInt(trip.wheelchair_accessible)
                        }

                        // Next stop info 
                        // Get all stops from tripId, then get the actual stopId, search in stop_times and with the 'arrival_time' search the next stop
                        const tripStopTimes = stopTimesMap[line].get(e.vehicle.trip.tripId) ?? []
                        const currentStopIndex = tripStopTimes.findIndex((stop: Stop) => stop.stop_id == e.vehicle.stopId)

                        // Set stops info
                        if(tripStopTimes.length !== 0) {
                            e.stops = tripStopTimes.map((stop: Stop) => ({
                                id: stop.stop_id,
                                name: getStationNameById(stop.stop_id),
                                arrival_time: formatStringTimeToHHMM(stop.arrival_time),
                                departure_time: formatStringTimeToHHMM(stop.departure_time),
                                latlon: getStationLatLonById(stop.stop_id)
                            }))
                        }

                        // If current status is INCOMMING_AT it means the train in on the index = (currentStopIndex - 1) stop
                        // We need to rectify the position and stopId to the real one, because the API gives the position of the next stop when the train is incoming
                        if (e.vehicle.currentStatus === 'INCOMING_AT' && currentStopIndex !== -1) {
                            const realStop = tripStopTimes[currentStopIndex - 1]

                            // Rectify position and stopId
                            if (realStop) {
                               const latlon = getStationLatLonById(realStop.stop_id)
                                e.vehicle.position = {
                                    latitude: latlon ? latlon.lat : e.vehicle.position.latitude,
                                    longitude: latlon ? latlon.lon : e.vehicle.position.longitude
                                }

                                e.vehicle.stopId = realStop.stop_id || e.vehicle.stopId

                            }
                        }
                        
                        // Add Start and End station
                        // Use the stop_times to find the first and last stop of the trip
                        if (tripStopTimes.length > 0) {
                            const firstStop = tripStopTimes[0]
                            const lastStop = tripStopTimes[tripStopTimes.length - 1]

                            const firstStation = getStationNameById(firstStop.stop_id)
                            const lastStation = getStationNameById(lastStop.stop_id)

                            e.vehicle.start_station = firstStation || 'Unknown'
                            e.vehicle.end_station = lastStation || 'Unknown'
                        }

                        // Add delay info from trip updates
                        const tripUpdate = tripUpdates.find(update => update.trip_id === e.vehicle.trip.tripId)
                        e.vehicle.delay = tripUpdate ? tripUpdate.delay : 0

                    }else {
                        // console.warn(`Warning: Trip not found for trip_id: ${e.vehicle.trip.tripId} on train ID: ${e.id}`)
                    }

                    return true
                }
                
                return false
            })

            // Record delays to KV (background, non-blocking)
            const runtime = context.locals.runtime
            if (runtime?.env?.DELAYS_KV) {
                runtime.ctx.waitUntil(
                    recordDelays(runtime.env.DELAYS_KV, trainsFiltered).catch(console.error)
                )
            }

            // Return filtered data
            return new Response(
                JSON.stringify(trainsFiltered),
                {
                    status: 200,
                    headers: {
                        ...BASE_HEADERS,
                        'Cache-Control': 's-maxage=20, stale-while-revalidate=20'
                    }
                }
            )

        }else return new Response(JSON.stringify({ error: 'No data available' }), { status: 404, headers: { ...BASE_HEADERS } })

    } catch (err) {
        console.error('Error fetching or processing data:', err)
        return new Response(JSON.stringify({ error: 'Failed to fetch or process data' }), { status: 500, headers: { ...BASE_HEADERS } })
    }
  
}


// Helper get station name
function getStationNameById(id: string): string {
    const station = stationMap.get(String(id))
    return station ? station[2] : 'Unknown' // [2] is the station name
}

// Helper to get the lat lon of a station by ID
function getStationLatLonById(id: string): StopLatLon | null {
    const station = stationMap.get(String(id))
    return station ? { lat: parseFloat(station[3]), lon: parseFloat(station[4]) } : null // [3] latitude, [4] longitude
}

// Helper to format time strings
function formatStringTimeToHHMM(timeStr: string): string {
    if (!timeStr) return 'N/A'
    const [hours, minutes] = timeStr.split(':')
    return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`
}

// ── Delay recording ──────────────────────────────────────────────────────────

const DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes between KV writes per line

async function recordDelays(kv: KVNamespace, trains: TrainElement[]) {
    const now = Date.now()
    const hour = new Date().getHours()

    const delaysByLine: Record<'R1' | 'R11', number[]> = { R1: [], R11: [] }

    for (const train of trains) {
        if (typeof train.vehicle.delay === 'number') {
            const line = train.id.includes('R11-') ? 'R11' : 'R1'
            delaysByLine[line].push(train.vehicle.delay)
        }
    }

    for (const line of ['R1', 'R11'] as const) {
        const delays = delaysByLine[line]
        if (delays.length === 0) continue

        const key = `delays:${line}`
        const existing: DelayData = (await kv.get<DelayData>(key, 'json')) ?? {
            hours: Array.from({ length: 24 }, () => ({ n: 0, sum: 0 })),
            lastUpdated: 0
        }

        if (now - existing.lastUpdated < DEBOUNCE_MS) continue

        const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length
        existing.hours[hour] = {
            n: existing.hours[hour].n + 1,
            sum: existing.hours[hour].sum + avgDelay
        }
        existing.lastUpdated = now

        await kv.put(key, JSON.stringify(existing))
    }
}