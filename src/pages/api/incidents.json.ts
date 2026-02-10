export const prerender = false;

const TARGET = 'https://gtfsrt.renfe.com/alerts.json'
const BASE_HEADERS = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Cache-Control': 'public, s-maxage=30, stale-while-revalidate=0, must-revalidate'
}

export async function GET () {
    let incidetnsFiltered: IncidentElement[] = []

    try {
        const r = await fetch(TARGET)
        const data = await r.json()

        // Only R1
        if (data.entity && data.entity.length > 0) {
            // Filter and set data
            data.entity.map((e: IncidentRawElement) => {
                const informedEntity = e.alert?.informedEntity || []

                // Check if the alert is related to R1 line (can be routes not from R1, because one incident can affect several routes)
                if (informedEntity.some((entity: InformedEntity) => entity.routeId && entity.routeId.includes('R1'))) {
                    const incident: IncidentElement = {}

                    // Get routes
                    incident.routes = informedEntity.map(routeId => routeId.routeId)
                                                    .filter((r): r is string => r !== undefined)
                                        
                    // Get desciption
                    const descriptionText = e.alert.descriptionText.translation || []
                    if (descriptionText[1] && descriptionText[1].language === 'ca') {
                        incident.description = descriptionText[1].text

                    }else if (descriptionText[0]) {
                        incident.description = descriptionText[0].text
                    
                    }else {
                        incident.description = 'No error message available'
                    }
                
                    // Set incident to filtered array
                    incidetnsFiltered.push(incident)
                }else {
                    return null
                }
            })
        }

        // Return filtered data
        return new Response(
            JSON.stringify(incidetnsFiltered), 
            {
                headers: {
                    ...BASE_HEADERS,
                    'Cache-Control': 's-maxage=3600, stale-while-revalidate=3600'
                }
            }
        )
    
    }catch (error) {
         console.error('Error fetching or processing data:', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch or process data' }), { status: 500, headers: BASE_HEADERS })
    }
}