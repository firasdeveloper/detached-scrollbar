import type { DetachedScrollbarOptions } from './types';

/**
 * A fully custom scrollbar that is decoupled from the element it scrolls.
 *
 * Unlike native scrollbars, a DetachedScrollbar can live anywhere in the DOM,
 * be styled with plain CSS, and control one or more content elements through
 * a shared scroll ratio (0–1).
 *
 * @example
 * ```ts
 * const scrollbar = new DetachedScrollbar({
 *   track: '.my-track',
 *   thumb: '.my-thumb',
 *   content: '.my-content',
 *   viewport: '.my-viewport',
 * });
 *
 * // Programmatic scroll
 * scrollbar.scrollTo(0.5);
 *
 * // Clean up
 * scrollbar.destroy();
 * ```
 */
export class DetachedScrollbar {
  private track: HTMLElement;
  private thumb: HTMLElement;
  private contentEls: HTMLElement[];
  private viewport: HTMLElement;

  private direction: 'horizontal' | 'vertical';
  private keyboardSteps: number;
  private trackClick: boolean;
  private autoResize: boolean;
  private resizeDebounce: number;

  private onScrollCb?: (ratio: number) => void;
  private onDragStartCb?: () => void;
  private onDragEndCb?: () => void;

  private _ratio = 0;
  private _dragStep = 0;
  private _lastPointer = 0;
  private _isDragging = false;
  private _resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  // Bound handlers for clean removal
  private _onDown: (e: MouseEvent | TouchEvent) => void;
  private _onMove: (e: MouseEvent | TouchEvent) => void;
  private _onUp: () => void;
  private _onKey: (e: KeyboardEvent) => void;
  private _onTrackClick: (e: MouseEvent) => void;
  private _onResize: () => void;

  constructor(options: DetachedScrollbarOptions) {
    this.track = resolveElement(options.track);
    this.thumb = resolveElement(options.thumb);
    this.viewport = resolveElement(options.viewport);
    this.contentEls = resolveContentElements(options.content);

    this.direction = options.direction ?? 'horizontal';
    this.keyboardSteps = options.keyboardSteps ?? 50;
    this.trackClick = options.trackClick ?? true;
    this.autoResize = options.autoResize ?? true;
    this.resizeDebounce = options.resizeDebounce ?? 100;

    this.onScrollCb = options.onScroll;
    this.onDragStartCb = options.onDragStart;
    this.onDragEndCb = options.onDragEnd;

    // Bind handlers
    this._onDown = this.handleDown.bind(this);
    this._onMove = this.handleMove.bind(this);
    this._onUp = this.handleUp.bind(this);
    this._onKey = this.handleKey.bind(this);
    this._onTrackClick = this.handleTrackClick.bind(this);
    this._onResize = this.handleResize.bind(this);

    this.init();
  }

  // ── Public API ───────────────────────────────────────────

  /** Current scroll position as a ratio from 0 to 1. */
  get ratio(): number {
    return this._ratio;
  }

  /** Whether the user is currently dragging the thumb. */
  get isDragging(): boolean {
    return this._isDragging;
  }

  /**
   * Scroll to a specific position.
   * @param ratio - A value between 0 (start) and 1 (end).
   */
  scrollTo(ratio: number): void {
    this._ratio = ratio;
    this.clampAndApply();
  }

  /**
   * Scroll so that a pixel offset in the content is centered in the viewport.
   * @param offset - The pixel position within the content to center on.
   */
  scrollToOffset(offset: number): void {
    const vSize = this.viewportSize();
    const cSize = this.contentSize();
    const target = offset - vSize / 2;
    this._ratio = target / (cSize - vSize);
    this.clampAndApply();
  }

  /**
   * Recalculate thumb size and reposition everything.
   * Call this after the content or layout changes.
   */
  update(): void {
    this.sizeThumb();
    this.applyPosition();
  }

  /** Focus the thumb element for keyboard control. */
  focus(): void {
    this.thumb.focus();
  }

  /** Remove all event listeners and clean up. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.thumb.removeEventListener('mousedown', this._onDown as EventListener);
    this.thumb.removeEventListener('touchstart', this._onDown as EventListener);
    this.thumb.removeEventListener('keydown', this._onKey as EventListener);

    document.removeEventListener('mousemove', this._onMove as EventListener);
    document.removeEventListener('touchmove', this._onMove as EventListener);
    document.removeEventListener('mouseup', this._onUp);
    document.removeEventListener('touchend', this._onUp);

    if (this.trackClick) {
      this.track.removeEventListener('click', this._onTrackClick);
    }

    if (this.autoResize) {
      window.removeEventListener('resize', this._onResize);
    }

    if (this._resizeTimer !== null) {
      clearTimeout(this._resizeTimer);
    }
  }

  // ── Internals ────────────────────────────────────────────

  private init(): void {
    // Ensure the thumb is focusable
    if (!this.thumb.hasAttribute('tabindex')) {
      this.thumb.setAttribute('tabindex', '0');
    }
    if (!this.thumb.hasAttribute('role')) {
      this.thumb.setAttribute('role', 'slider');
      this.thumb.setAttribute('aria-valuemin', '0');
      this.thumb.setAttribute('aria-valuemax', '100');
      this.thumb.setAttribute('aria-valuenow', '0');
    }
    if (!this.thumb.hasAttribute('aria-label')) {
      this.thumb.setAttribute('aria-label', 'Scrollbar');
    }

    // Pointer events on thumb
    this.thumb.addEventListener('mousedown', this._onDown as EventListener);
    this.thumb.addEventListener('touchstart', this._onDown as EventListener, { passive: false });
    this.thumb.addEventListener('keydown', this._onKey as EventListener);

    // Track click
    if (this.trackClick) {
      this.track.addEventListener('click', this._onTrackClick);
    }

    // Resize
    if (this.autoResize) {
      window.addEventListener('resize', this._onResize);
    }

    this.sizeThumb();
  }

  // ── Measurement helpers ──────────────────────────────────

  private isHorizontal(): boolean {
    return this.direction === 'horizontal';
  }

  private trackSize(): number {
    return this.isHorizontal() ? this.track.offsetWidth : this.track.offsetHeight;
  }

  private thumbSize(): number {
    return this.isHorizontal() ? this.thumb.offsetWidth : this.thumb.offsetHeight;
  }

  private viewportSize(): number {
    return this.isHorizontal() ? this.viewport.offsetWidth : this.viewport.offsetHeight;
  }

  private contentSize(): number {
    const el = this.contentEls[0];
    return this.isHorizontal() ? el.scrollWidth : el.scrollHeight;
  }

  // ── Thumb sizing ─────────────────────────────────────────

  private sizeThumb(): void {
    const visible = this.viewportSize() / this.contentSize();
    const size = this.trackSize() * Math.min(visible, 1);
    if (this.isHorizontal()) {
      this.thumb.style.width = size + 'px';
    } else {
      this.thumb.style.height = size + 'px';
    }
    this._dragStep = this.trackSize() / this.keyboardSteps;
  }

  // ── Position application ─────────────────────────────────

  private applyPosition(): void {
    const thumbPos = this._ratio * (this.trackSize() - this.thumbSize());
    const contentPos = -this._ratio * (this.contentSize() - this.viewportSize());

    if (this.isHorizontal()) {
      this.thumb.style.left = thumbPos + 'px';
      for (const el of this.contentEls) {
        el.style.left = contentPos + 'px';
      }
    } else {
      this.thumb.style.top = thumbPos + 'px';
      for (const el of this.contentEls) {
        el.style.top = contentPos + 'px';
      }
    }

    this.thumb.setAttribute('aria-valuenow', String(Math.round(this._ratio * 100)));
    this.onScrollCb?.(this._ratio);
  }

  private clampAndApply(): void {
    if (this._ratio < 0) this._ratio = 0;
    if (this._ratio > 1) this._ratio = 1;
    this.applyPosition();
  }

  // ── Pointer drag ─────────────────────────────────────────

  private handleDown(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.thumb.focus();
    this._isDragging = true;
    this._lastPointer = this.pointerPos(e);

    document.addEventListener('mousemove', this._onMove as EventListener);
    document.addEventListener('touchmove', this._onMove as EventListener, { passive: false });
    document.addEventListener('mouseup', this._onUp);
    document.addEventListener('touchend', this._onUp);

    this.onDragStartCb?.();
  }

  private handleMove(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    const pos = this.pointerPos(e);
    const delta = this._lastPointer - pos;
    this._lastPointer = pos;

    const newPos = this.currentThumbPos() - delta;
    this._ratio = newPos / (this.trackSize() - this.thumbSize());
    this.clampAndApply();
  }

  private handleUp(): void {
    this._isDragging = false;

    document.removeEventListener('mousemove', this._onMove as EventListener);
    document.removeEventListener('touchmove', this._onMove as EventListener);
    document.removeEventListener('mouseup', this._onUp);
    document.removeEventListener('touchend', this._onUp);

    this.onDragEndCb?.();
  }

  // ── Keyboard ─────────────────────────────────────────────

  private handleKey(e: KeyboardEvent): void {
    const backKey = this.isHorizontal() ? 'ArrowLeft' : 'ArrowUp';
    const fwdKey = this.isHorizontal() ? 'ArrowRight' : 'ArrowDown';
    const step = this._dragStep / (this.trackSize() - this.thumbSize());

    if (e.key === backKey) {
      e.preventDefault();
      this._ratio -= step;
      this.clampAndApply();
    } else if (e.key === fwdKey) {
      e.preventDefault();
      this._ratio += step;
      this.clampAndApply();
    } else if (e.key === 'Home') {
      e.preventDefault();
      this._ratio = 0;
      this.clampAndApply();
    } else if (e.key === 'End') {
      e.preventDefault();
      this._ratio = 1;
      this.clampAndApply();
    }
  }

  // ── Track click ──────────────────────────────────────────

  private handleTrackClick(e: MouseEvent): void {
    if (e.target === this.thumb || this.thumb.contains(e.target as Node)) return;
    const rect = this.track.getBoundingClientRect();
    const clickPos = this.isHorizontal()
      ? e.clientX - rect.left
      : e.clientY - rect.top;
    this._ratio = clickPos / this.trackSize();
    this.clampAndApply();
  }

  // ── Resize ───────────────────────────────────────────────

  private handleResize(): void {
    if (this._resizeTimer !== null) clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      this.sizeThumb();
      this.applyPosition();
    }, this.resizeDebounce);
  }

  // ── Utilities ────────────────────────────────────────────

  private pointerPos(e: MouseEvent | TouchEvent): number {
    if ('clientX' in e) {
      return this.isHorizontal() ? e.clientX : e.clientY;
    }
    const touch = (e as TouchEvent).touches[0];
    return this.isHorizontal() ? touch.clientX : touch.clientY;
  }

  private currentThumbPos(): number {
    return this.isHorizontal() ? this.thumb.offsetLeft : this.thumb.offsetTop;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function resolveElement(input: string | HTMLElement): HTMLElement {
  if (typeof input === 'string') {
    const el = document.querySelector<HTMLElement>(input);
    if (!el) throw new Error(`DetachedScrollbar: element not found for selector "${input}"`);
    return el;
  }
  return input;
}

function resolveContentElements(
  input: string | HTMLElement | (string | HTMLElement)[]
): HTMLElement[] {
  const items = Array.isArray(input) ? input : [input];
  return items.map(resolveElement);
}
