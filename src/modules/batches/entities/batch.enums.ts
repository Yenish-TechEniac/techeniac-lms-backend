export enum BatchStatus {
  DRAFT = 'DRAFT',
  LIVE = 'LIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum BatchMemberRole {
  MENTOR = 'MENTOR',
  MENTEE = 'MENTEE',
}

export enum BatchReasonToLeave {
  ROLE_CHANGE = 'ROLE_CHANGE',
  BATCH_TRANSFER = 'BATCH_TRANSFER',
  REMOVED = 'REMOVED',
  BATCH_COMPLETED = 'BATCH_COMPLETED',
}
