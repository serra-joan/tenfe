# Links i paràmetres per obtenir la informació necessaria
_Les seccions en castellà estan copiades i enganxades de la web de renfe_

## Documentació (si es pot dir així)
Tota l'informació d'aquest .md ve de [https://data.renfe.com/dataset](https://data.renfe.com/dataset)

## API
En aquests moments no acabo d'entendre com funciona la seva API.
Url base API: [https://data.renfe.com/api/3](https://data.renfe.com/api/3)

## .JSON
S'actualitza cada 30s. Fitxers orientats a "cercanias".

### Ubicació en temps real
Proporciona la ubicación en tiempo real de los vehículos del servicio de cercanías, incluyendo posición GPS y estado (parado, en movimiento, etc.).
La información del andén (Platform) en el que el tren se va a posicionar se informa dentro del atributo “label” Ejemplo "label": "C1-23537-PLATF.(3)"
[Documentació](https://data.renfe.com/dataset/ubicacion-vehiculos)
[JSON](https://gtfsrt.renfe.com/vehicle_positions.json)

### Insidencies/alertes
Informa sobre incidencias o avisos del servicio de cercanías (accesibilidad, servicios prestados en autobus, incidencias en vía,...).
[Documentació](https://data.renfe.com/dataset/incidencias-avisos)
[JSON](https://gtfsrt.renfe.com/alerts.json)

### Horaris temps real
Contiene actualizaciones sobre horarios de viaje del servicio de cercanías (cancelaciones, cambios de hora, servicios añadidos, estaciones sin servicio) por cada viaje.
[Documentació](https://data.renfe.com/dataset/horarios-viaje-cercanias)
[JSON](https://gtfsrt.renfe.com/trip_updates.json)

## .ZIP de Horaris
Aquest .zip conté diversos .txt on hi ha molta informació extra (horaris, rutes, parades, etc.), els quals ocupen molt i es tracten amb els scripts de `/src/scripts/`.
[Fitxers necessaris](https://data.renfe.com/dataset/horarios-cercanias)

### Ruta de cada tren
Fitxers necessaris: `routes.txt` i `trips.txt`.
Hem de relacionar el `tripId` que ens dona el tren escollit amb el `trip_id` del fitxer `trips.txt`, un cop trobat agafem el `route_id` per relacionar amb aquest mateix del fitxer `routes.txt`.

Per poder obtenir les rutes necessàries, i no haver de tractar amb tot el .txt, podem utilitzar el `/src/scripts/extract_routes.js`:
```node src/scripts/extract_routes.js```

### Stops times (Hores d'arribada per parada)
Fitxers necessaris: `stop_time.txt` i `trips.txt`.
Prèviament hem hagut d'obtenir el `trips_filtered.json`:
```node src/scripts/extract_trips.js```

Un cop tinguem el filtratge, haurem de relacionar els `trip_id` de `trips_filtered.json` i `stop_times.txt`.
Per poder treballar amb un arxiu més lleuger, millor fer servir el `/src/scripts/extract_stops_times.js`:
```node src/scripts/extract_stop_times.js```

### Següent parada
Per poder saber la següent parada podem saber-ho a través dels `Stop Times`. Podem mirar el index de l'actual parada i mirar quina serà la següent.

### Incidències
Api necessaria: [https://gtfsrt.renfe.com/alerts.json](https://gtfsrt.renfe.com/alerts.json)

Necessitem obtenir el `routeId` en la llista de `alert.informedEntity` per poder saber si la nostra ruta està inclosa en l'incidència. Si esta en aquesta llista podem dir que el tren té el problema que posa en `alert.descriptionText.translation`.

### Hores d'arribada en cas de retards
Api necessaria: [https://gtfsrt.renfe.com/trip_updates.json](https://gtfsrt.renfe.com/trip_updates.json)

Haurem de relacionar el `tripId` de cada `entity` per saber si és de l'R1 i si estem mostrant el tren. Si és així, en `entity.tripUpdate.delay` tenim el temps de retard en segons. Aquest temps el podem aplicar en els `arrival_time` de cada parada per poder saber a quina hora s'espera l'arribada.