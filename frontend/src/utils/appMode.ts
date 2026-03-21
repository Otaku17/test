/**
 * appMode.ts — desktop build (Wails)
 * Always returns 'desktop'. No runtime detection needed.
 */
export type AppMode = 'desktop' | 'pwa' | 'web';

export const getAppMode = (): AppMode => 'desktop';
export const isDesktop  = () => true;
export const isPWA      = () => false;
export const isWeb      = () => false;
