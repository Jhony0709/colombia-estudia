/**
 * Accessibility utilities.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * These are the ONLY sources for:
 * - Live region announcements (useAnnounce)
 * - Focus management (FocusManager, useReturnFocus)
 * - Reading preferences (useReadingPreferences)
 * - Skip link (SkipLink)
 * - Visually hidden (VisuallyHidden)
 */

export { AnnounceProvider, useAnnounce } from './announce';
export { FocusManager, useReturnFocus } from './focus-manager';
export {
  AccessibilityPreferencesProvider,
  useReadingPreferences,
  type ReadingPreferences,
} from './preferences-provider';
export { SkipLink } from './skip-link';
export { VisuallyHidden } from './visually-hidden';
