export const DESIRED_LINES = ['R1', 'R11', 'RG1'] as const

export type DesiredLine = typeof DESIRED_LINES[number]

export function isDesiredLine(value: string): value is DesiredLine {
    return (DESIRED_LINES as readonly string[]).includes(value)
}

export function extractLineFromRouteId(routeId: string): DesiredLine | null {
    const match = routeId.match(/\d+([A-Z]+\d+)$/)
    const candidate = match ? match[1] : routeId
    return isDesiredLine(candidate) ? candidate : null
}

export function extractLineFromTrainId(trainId: string): DesiredLine | null {
    const idMatch = trainId.match(/(?:^|[-_])(RG1|R11|R1)(?:[-_]|$)/)
    return idMatch ? (idMatch[1] as DesiredLine) : null
}