// Types for trains elements

type StopLatLon = { 
    lat: number
    lon: number 
}
type Stop = { 
    stop_id: string
    arrival_time: string
    departure_time: string
    trip_id: string
}
type TripPayload = { 
    tripId: string
    route_id?: string
    wheelchair_accessible?: number | string
}
type Vehicle = {
  stopId: string
  stopName?: string
  position: { latitude: number; longitude: number }
  trip: TripPayload
  stops?: { id: string; name: string; arrival_time: string; departure_time: string; latlon?: StopLatLon }[]
  start_station?: string
  end_station?: string
  delay: number
  currentStatus: string
}
type TrainElement = { 
    id: string
    vehicle: Vehicle
    stops?: Stop[]
}