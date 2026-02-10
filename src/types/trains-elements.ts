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
  trip: TripPayload
  stops?: { id: string; name: string; arrival_time: string; departure_time: string; latlon?: StopLatLon }[]
  nextStop?: { stop_id: string; stop_name: string; arrival_time: string }
  start_station?: string
  end_station?: string
  delay: number
}
type TrainElement = { 
    id: string
    vehicle: Vehicle
    stops?: Stop[]
}