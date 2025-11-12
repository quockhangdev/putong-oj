import type { contestLabelingStyle, contestRanklistVisibility, contestType } from '../utils/constants'
import type { Types } from 'mongoose'

export interface CourseRole {
  basic: boolean
  viewTestcase: boolean
  viewSolution: boolean
  manageProblem: boolean
  manageContest: boolean
  manageCourse: boolean
}

export interface ContestOption {
  labelingStyle: typeof contestLabelingStyle[keyof typeof contestLabelingStyle]
  ranklistVisibility: typeof contestRanklistVisibility[keyof typeof contestRanklistVisibility]
  type: typeof contestType[keyof typeof contestType]
}

export interface SessionProfile {
  uid: string
  privilege: number
  checksum: string
  verifyContest?: number[]
}

export interface PaginateOption {
  page: number
  pageSize: number
}

export interface SortOption {
  sort: 1 | -1
  sortBy: string
}

export interface DocumentId {
  _id: Types.ObjectId
}
