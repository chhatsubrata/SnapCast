/**
 * Secure preload bridge.
 *
 * Runs in an isolated context with Node integration disabled. It exposes a
 * SINGLE, minimal, whitelisted surface (`window.api`) over contextBridge. No
 * ipcRenderer, Node primitives, or arbitrary channels leak to the renderer.
 *
 * Every method is derived from the shared {@link IpcRequestMap} / {@link IpcEventMap}
 * contracts, so the renderer gets full type-safety while the channel whitelist
 * prevents the page from invoking anything outside the contract.
 */

import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_EVENT_CHANNELS,
  IPC_REQUEST_CHANNELS,
  type IpcEventChannel,
  type IpcEventMap,
  type IpcRequestChannel,
  type IpcRequestMap
} from '@shared/ipc'
import type { ClientApi } from '@shared/preload-api'

const requestSet = new Set<string>(IPC_REQUEST_CHANNELS)
const eventSet = new Set<string>(IPC_EVENT_CHANNELS)

const api = {
  /** Invoke a request channel. Rejects if the channel is not whitelisted. */
  invoke<C extends IpcRequestChannel>(
    channel: C,
    args?: IpcRequestMap[C]['args']
  ): Promise<IpcRequestMap[C]['result']> {
    if (!requestSet.has(channel)) {
      return Promise.reject(new Error(`Blocked invoke on non-whitelisted channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, args)
  },

  /**
   * Subscribe to a push channel. Returns an unsubscribe function. The raw
   * IpcRendererEvent is intentionally stripped so the renderer only sees data.
   */
  on<C extends IpcEventChannel>(channel: C, callback: (payload: IpcEventMap[C]) => void): () => void {
    if (!eventSet.has(channel)) {
      throw new Error(`Blocked subscription on non-whitelisted channel: ${channel}`)
    }
    const listener = (_event: Electron.IpcRendererEvent, payload: IpcEventMap[C]): void =>
      callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
} satisfies ClientApi

export type PreloadApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose preload API', error)
  }
} else {
  // Fallback for the (non-recommended) non-isolated case.
  // @ts-expect-error - define on window for dev parity
  window.api = api
}
