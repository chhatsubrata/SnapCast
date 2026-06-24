/**
 * Root component. Routes between the floating widget and the full-window pages
 * based on the navigation store. The widget is the default surface; pages slide
 * in over it via Framer Motion.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useWidgetStore } from '@store/widgetStore'
import { AppProviders } from '@providers/AppProviders'
import { FloatingWidget } from '@widgets/FloatingWidget'
import { AnalyticsPage } from '@pages/AnalyticsPage'
import { SettingsPage } from '@pages/SettingsPage'
import { WizardPage } from '@pages/WizardPage'
import { EventsPage } from '@pages/EventsPage'

export default function App(): React.JSX.Element {
  const view = useWidgetStore((s) => s.view)

  return (
    <AppProviders>
      <div className="h-screen w-screen" style={{ transform: 'scale(var(--app-scale, 1))', transformOrigin: 'top center' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full w-full"
          >
            {view === 'widget' && <FloatingWidget />}
            {view === 'analytics' && <AnalyticsPage />}
            {view === 'settings' && <SettingsPage />}
            {view === 'wizard' && <WizardPage />}
            {view === 'events' && <EventsPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppProviders>
  )
}
