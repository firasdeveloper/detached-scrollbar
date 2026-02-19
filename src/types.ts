/**
 * Configuration options for DetachedScrollbar.
 */
export interface DetachedScrollbarOptions {
  /**
   * The scrollbar track element (the full-width rail area).
   * Accepts a CSS selector string or an HTMLElement reference.
   */
  track: string | HTMLElement;

  /**
   * The draggable thumb element within the track.
   * Accepts a CSS selector string or an HTMLElement reference.
   */
  thumb: string | HTMLElement;

  /**
   * The scrollable content element (wider/taller than the viewport).
   * Accepts a CSS selector string or an HTMLElement reference.
   * Can also be an array of elements that all scroll together.
   */
  content: string | HTMLElement | (string | HTMLElement)[];

  /**
   * The viewport element that clips the content (overflow: hidden).
   * Accepts a CSS selector string or an HTMLElement reference.
   */
  viewport: string | HTMLElement;

  /**
   * Scroll direction.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical';

  /**
   * Number of discrete steps for keyboard arrow keys across the full range.
   * A higher number means finer control.
   * @default 50
   */
  keyboardSteps?: number;

  /**
   * Whether clicking on the track (outside the thumb) jumps to that position.
   * @default true
   */
  trackClick?: boolean;

  /**
   * Whether to automatically recalculate on window resize.
   * @default true
   */
  autoResize?: boolean;

  /**
   * Debounce delay in ms for resize recalculations.
   * @default 100
   */
  resizeDebounce?: number;

  /**
   * Called on every scroll position change.
   * @param ratio - The current scroll position as a value between 0 and 1.
   */
  onScroll?: (ratio: number) => void;

  /**
   * Called when the user starts dragging the thumb.
   */
  onDragStart?: () => void;

  /**
   * Called when the user stops dragging the thumb.
   */
  onDragEnd?: () => void;
}
