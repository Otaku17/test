/**
 * appMode.ts — version desktop (Wails)
 * Toujours 'desktop', pas de détection nécessaire.
 */
export type AppMode = 'desktop' | 'pwa' | 'web';
export const getAppMode      = (): AppMode => 'desktop';
export const isDesktop       = () => true;
export const isPWA           = () => false;
export const isWeb           = () => false;
export const getModeBadge    = () => 'APP';
export const getModeBadgeClass = (): 'app' | 'pwa' | 'web' => 'app';
