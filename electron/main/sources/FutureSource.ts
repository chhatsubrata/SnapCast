/**
 * Placeholder for future, opt-in integrations (e.g. a documented API exposed by
 * compatible productivity tools). It intentionally does nothing today and exists
 * to keep the source registry open for extension without changing call sites.
 *
 * Any real implementation here MUST remain non-invasive: consume only data that
 * a third party deliberately publishes. It must never hook, inject, or scrape.
 */

import { SourceType, type SourceConfig } from '@shared/types'
import type { ScreenshotListener, ScreenshotSource, VerifyResult } from './types'

export class FutureSource implements ScreenshotSource {
  readonly config: SourceConfig = { type: SourceType.FUTURE }

  async start(_listener: ScreenshotListener): Promise<void> {
    // Reserved for a future, explicitly-published integration feed.
  }

  async stop(): Promise<void> {}

  async verify(): Promise<VerifyResult> {
    return {
      detected: false,
      sampleCount: 0,
      message: 'Future integration provider is a placeholder and not yet active.'
    }
  }
}
