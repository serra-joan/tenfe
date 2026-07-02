export const prerender = false;

const TARGET = 'https://gtfsrt.renfe.com/alerts.json'
const DESIRED_ROUTES = ['R1', 'RG1', 'R11']

// Extracts the route suffix from a given routeId string. The API returns identifiers like "51T0094R11", but the route codes are "R1", "R11", "RG1", etc. 
// The regex captures the pattern <digit><letter><digits> at the end of the string (e.g., "4R11"), and with .slice(1) we get only the route ("R11").
function getRouteSuffix(routeId: string): string {
    const match = routeId.match(/.*(\d[A-Z]\d+)$/)
    return match ? match[1].slice(1) : routeId
}

const BASE_HEADERS = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY', 
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'interest-cohort=()'
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

                // Check if the alert is related to any of the desired routes (exact match)
                if (informedEntity.some((entity: InformedEntity) => entity.routeId && DESIRED_ROUTES.includes(getRouteSuffix(entity.routeId)))) {
                    const incident: IncidentElement = {}

                    // Get routes (only desired ones)
                    incident.routes = informedEntity.map(routeId => routeId.routeId)
                                                    .filter((r): r is string => r !== undefined && DESIRED_ROUTES.includes(getRouteSuffix(r)))
                                        
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
                    'Cache-Control': 's-maxage=600, stale-while-revalidate=600' // 10 mins cache
                }
            }
        )
    
    }catch (error) {
         console.error('Error fetching or processing data:', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch or process data' }), { status: 500, headers: BASE_HEADERS })
    }
}