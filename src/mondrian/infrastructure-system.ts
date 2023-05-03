export type Queue = {
  enqueue: (value: unknown) => Promise<void>
}

export type Resource =
  | {
      type: 'QUEUE'
    }
  | {
      type: 'SQS_QUEUE'
    }
  | {
      type: 'MONGODB_DATABASE'
    }

export type Infrastructure = {}

const resources = {
  incoming: {
    type: 'QUEUE',
  },
  outgoing: {
    type: 'SQS_QUEUE',
  },
  dbMain: {
    type: 'MONGODB_DATABASE',
  },
}
