/**
 * The shape of `window.api` exposed by the preload bridge.
 *
 * Declared in shared code so BOTH the preload (which must satisfy it) and the
 * renderer (which consumes it) agree on the contract without the renderer
 * importing main/preload modules.
 */

import type {
  IpcEventChannel,
  IpcEventMap,
  IpcRequestChannel,
  IpcRequestMap
} from './ipc'

export interface ClientApi {
  invoke<C extends IpcRequestChannel>(
    channel: C,
    args?: IpcRequestMap[C]['args']
  ): Promise<IpcRequestMap[C]['result']>
  on<C extends IpcEventChannel>(
    channel: C,
    callback: (payload: IpcEventMap[C]) => void
  ): () => void
}
