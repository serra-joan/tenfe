// Types for incidents elements

type IncidentElement = {
    routes?: string[]
    description?: string
}

type IncidentRawElement = {
    alert: {
        informedEntity: InformedEntity[]
        descriptionText: {
            translation: { language: string, text: string }[]
        }
    }
}

type InformedEntity = {
    routeId?: string
}