import { env } from 'node:process'

export default {
  title: 'CTU Online Judge',
  buildSHA: env.NODE_BUILD_SHA || 'unknown',
  buildTime: Number.parseInt(env.NODE_BUILD_TIME as string) || Date.now(),
} as const
