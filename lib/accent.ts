// Artist accent colour utilities

export const DEFAULT_ACCENT = '#F56D00'

/** Get the resolved accent colour, falling back to Insound orange */
export function resolveAccent(colour: string | null | undefined): string {
  if (!colour || !/^#[0-9a-fA-F]{6}$/.test(colour)) return DEFAULT_ACCENT
  return colour
}

/** Apply --artist-accent CSS variable to a DOM element (or document root) */
export function setAccentVar(colour: string | null | undefined, el?: HTMLElement): void {
  const target = el || document.documentElement
  target.style.setProperty('--artist-accent', resolveAccent(colour))
}

/** Generate inline style object for React components */
export function accentStyle(colour: string | null | undefined): Record<string, string> {
  return { '--artist-accent': resolveAccent(colour) } as Record<string, string>
}
