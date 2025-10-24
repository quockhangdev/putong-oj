import type { ContestEntityView } from '@backend/types/entity'
import type { Cell } from 'exceljs'
import type { Ranklist, RawRanklist } from '@/types'
import { contestLabeling } from './formate'
import { contestType } from '@backend/utils/constants'

const PENALTY = 20 // Penalty for failed submissions: 20 minutes

export function normalize (ranklist: RawRanklist, contest: ContestEntityView): Ranklist {
  const list: Ranklist = [] // Result

  Object.keys(ranklist).forEach((uid) => {
    const row = ranklist[uid]
    let solved = 0 // Number of problems accepted
    let penalty = 0 // Penalty time (minutes), only counted when AC
    for (const pid of contest.list) {
      if (row[pid] == null) continue // No submissions for this problem
      const submission = row[pid]
      if (submission.acceptedAt) {
        if (contest.option.type === contestType.ICPC) {
          solved++ // For ICPC, count number of problems solved
        } else {
          solved += 100 // For OI, count as 100 points
        }
        penalty += Math.max(0, Math.floor((submission.acceptedAt - contest.start) / 1000 / 60))
        penalty += submission.failed * PENALTY
      } else if (contest.option.type === contestType.OI && submission.partial) {
        solved += submission.partial // For OI, add partial score
        penalty += submission.failed * PENALTY
      }
    }
    list.push({
      rank: -1, // Placeholder rank; will be recalculated later
      uid,
      solved,
      penalty,
      ...row,
    })
  })

  // Sort: solved desc, then penalty asc, then uid asc
  list.sort((x, y) => {
    if (x.solved !== y.solved) {
      return y.solved - x.solved
    }
    if (x.penalty !== y.penalty) {
      return x.penalty - y.penalty
    }
    return x.uid.localeCompare(y.uid)
  })

  // Recalculate ranks
  let currentRank = 0
  let calculated = 0
  let lastSolved = -1
  let lastPenalty = -1
  list.forEach((row) => {
    calculated++
    if (row.solved !== lastSolved || row.penalty !== lastPenalty) {
      currentRank = calculated
      lastSolved = row.solved
      lastPenalty = row.penalty
    }
    row.rank = currentRank
  })

  // Now compute earliest accepted time for each problem
  const quickest: Record<number, number> = {} // Earliest accepted time per problem
  for (const pid of contest.list) {
    quickest[pid] = Number.POSITIVE_INFINITY
  }

  list.forEach((row) => {
    for (const pid of contest.list) {
      if (row[pid]?.acceptedAt) {
        quickest[pid] = Math.min(
          quickest[pid],
          row[pid].acceptedAt,
        )
      }
    }
  })

  list.forEach((row) => {
    for (const pid of contest.list) {
      if (!row[pid]?.acceptedAt) continue
      if (quickest[pid] === row[pid].acceptedAt) { // This is the earliest accepted submission
        row[pid].isPrime = true // Mark it
      }
    }
  })

  return list
}

export async function exportSheet (
  contest: ContestEntityView,
  ranklist: Ranklist,
): Promise<void> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Ranklist')

  worksheet.columns = [
    { header: 'Rank', width: 6 },
    { header: 'Username', width: 16 },
    { header: 'Nickname', width: 16 },
    { header: 'Solved', width: 8 },
    { header: 'Penalty', width: 8 },
    ...contest.list.map((_, i) => ({
      header: contestLabeling(i + 1, contest.option?.labelingStyle),
      width: 10,
    })),
  ]

  const applyStyle = (
    cell: Cell,
    options: {
      bold?: boolean
      color?: string
      border?: boolean
      fill?: string
    },
  ) => {
    const { bold, color, border, fill } = options

    if (bold || color) {
      cell.font = {
        bold: bold || false,
        color: color ? { argb: color } : undefined,
      }
    }

    if (border) {
      cell.border = Object.fromEntries(
        [ 'top', 'left', 'bottom', 'right' ]
          .map(side => [ side, { style: 'thin' } ]),
      )
    }

    if (fill) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fill },
      }
    }
  }

  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell) => {
    applyStyle(cell, {
      bold: true,
      border: true,
      fill: 'D9D9D9',
    })
  })

  ranklist.forEach((row) => {
    const excelRow = worksheet.addRow([
      row.rank,
      row.uid,
      row.nick || '',
      row.solved,
      row.penalty,
      ...contest.list.map((pid) => {
        const status = row[pid]
        if (!status) return '-'
        if (!status.acceptedAt) return `-${status.failed}`
        let time = '-'
        if (status.acceptedAt >= contest.start) {
          time = String(Math.floor((status.acceptedAt - contest.start) / 1000 / 60))
        }
        return `+${status.failed > 0 ? status.failed : ''} (${time})`
      }),
    ])

    contest.list.forEach((pid, index) => {
      const cell = excelRow.getCell(index + 6)
      const status = row[pid]

      if (!status) return
      if (status.acceptedAt) {
        applyStyle(cell, {
          bold: true,
          color: status.isPrime ? '0000FF' : '008000',
          border: true,
        })
      } else if (status.failed > 0) {
        applyStyle(cell, { color: 'FF0000', border: true })
      }
    })

    excelRow.eachCell((cell) => {
      if (!cell.border) {
        applyStyle(cell, { border: true })
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([ buffer ], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${contest.title} - Ranklist.xlsx`
  link.click()
}
