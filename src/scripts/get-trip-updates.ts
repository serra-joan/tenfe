// Returns an array of trip updates with trip_id and delay (seconds) information for R1 line
export async function getTripUpdates() {
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

        return tripsUpdates

    } catch (error) {
        console.error('Error fetching trip updates:', error)
        return []
    }
}