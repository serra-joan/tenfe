// Simple in-memory cache for trip updates (TTL: 20s, same as vehicle positions cache)
let _cache: { data: TripUpdate[], expiry: number } | null = null

// Returns an array of trip updates with trip_id and delay (seconds) information for R1 line
export async function getTripUpdates() {
    const now = Date.now()
    if (_cache && now < _cache.expiry) return _cache.data

    try {
        const tripsUpdates: TripUpdate[] = []
        const data: TripUpdatesResponse = await (await fetch('https://gtfsrt.renfe.com/trip_updates.json')).json()
        
        if (data.entity && data.entity.length > 0) {
            data.entity.forEach((e) => {
                if (e.tripUpdate.trip.tripId.includes('R1')) {
                    tripsUpdates.push({
                        trip_id: e.tripUpdate.trip.tripId,
                        delay: e.tripUpdate.delay
                    })
                }
            })
        }

        _cache = { data: tripsUpdates, expiry: now + 20_000 }
        return tripsUpdates

    } catch (error) {
        console.error('Error fetching trip updates:', error)
        return []
    }
}