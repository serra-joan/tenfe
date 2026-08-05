// Types for trains elements

type StopLatLon = { 
    lat: number
    lon: number 
}
type Stop = { 
    stop_id: string
    trip_id: string
    arrival_time: string
    departure_time: string
    stop_sequence?: number
}
type StopJSON = {
    R1: Stop[]
    R11: Stop[]
    RG1: Stop[]
}
type TripRaw = {
  route_id: string,
  service_id: string,
  trip_id: string,
  wheelchair_accessible: number | string,
  block_id: string,
  shape_id: string
}
type TripPayload = { 
    tripId: string
    route_id?: string
    service_id?: string,
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
  next_stop?: string
  delay: number
  currentStatus: string
}
type TrainElement = { 
    id: string
    vehicle: Vehicle
    stops?: { id: string; name: string, arrival_time: string; departure_time: string; latlon: StopLatLon | null }[]
}
type PlannedTrain = {
    id: string
    vehicle: Vehicle
    departure_time: string
}