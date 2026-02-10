type TripUpdate = {
    trip_id: string,
    delay: number
}

type TripUpdatesResponse = {
    entity: {
        tripUpdate: {
            trip: {
                tripId: string
            },
            delay: number
        }
    }[]
}