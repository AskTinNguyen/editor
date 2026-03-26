export type SceneCommandResult =
  | { status: 'ok'; commandType: string }
  | { status: 'error'; commandType: string; error: string }

export type SceneCommandBatchResult = {
  status: 'ok' | 'error'
  commandType: 'batch-commands'
  results: (SceneCommandResult | SceneCommandBatchResult)[]
}
