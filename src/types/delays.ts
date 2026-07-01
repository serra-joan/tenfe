// Types for delay statistics

type DelayHourSlot = {
  n: number    // number of averaged samples recorded
  sum: number  // cumulative sum of average delays (seconds)
}

type DelayData = {
  hours: DelayHourSlot[]  // index 0–23 = hour of day
  lastUpdated: number     // ms timestamp of last KV write
}

type DelayStats = {
  hour: number
  avgDelay: number  // average delay in seconds
  n: number         // number of samples
}

type DelaysResponse = {
  R1: DelayStats[]
  R11: DelayStats[]
}
