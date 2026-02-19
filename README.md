# detached-scrollbar

A custom scrollbar that can be fully styled and placed anywhere in the DOM, decoupled from the element it scrolls.

- **Zero dependencies** — vanilla TypeScript, no runtime libraries
- **Tiny** — ~2 KB minified + gzipped
- **Horizontal & vertical** — one API for both directions
- **Multi-content** — one scrollbar can control multiple elements in sync
- **Accessible** — `role="slider"`, `aria-valuenow`, keyboard support (arrows, Home, End)
- **Touch-ready** — mouse, touch, and keyboard out of the box
- **Framework-agnostic** — works with React, Vue, Svelte, or plain HTML

## Install

```bash
npm install detached-scrollbar
```

Or with a CDN:

```html
<script type="module">
  import { DetachedScrollbar } from 'https://unpkg.com/detached-scrollbar/dist/index.js';
</script>
```

## Quick Start

### HTML

Create four elements: a **track**, a **thumb** inside it, a **viewport** with `overflow: hidden`, and the **content** inside it.

```html
<!-- The scrollbar (can live anywhere in the DOM) -->
<div class="track" id="track">
  <div class="thumb" id="thumb"></div>
</div>

<!-- The scrollable area -->
<div class="viewport" id="viewport">
  <div class="content" id="content">
    <!-- your wide or tall content here -->
  </div>
</div>
```

### CSS

The track and thumb are plain HTML elements — style them however you want. The key rules:

```css
/* Track: positioned container */
.track {
  height: 30px;
  position: relative;
}

/* Thumb: absolutely positioned within the track */
.thumb {
  height: 30px;
  position: absolute;
  left: 0;          /* horizontal — managed by the library */
  top: 0;
  cursor: grab;
  background: #00b0c7;
  border-radius: 40px;
}

/* Viewport: clips the content */
.viewport {
  overflow: hidden;
  position: relative;
}

/* Content: absolutely positioned, slides via left/top */
.content {
  position: absolute;
  width: max-content;  /* horizontal: wider than viewport */
}
```

### JavaScript / TypeScript

```ts
import { DetachedScrollbar } from 'detached-scrollbar';

const scrollbar = new DetachedScrollbar({
  track: '#track',
  thumb: '#thumb',
  content: '#content',
  viewport: '#viewport',
});
```

That's it. The library calculates the thumb width, wires up drag/touch/keyboard events, and keeps the thumb and content in sync.

## API

### `new DetachedScrollbar(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `track` | `string \| HTMLElement` | *required* | The scrollbar track element or CSS selector |
| `thumb` | `string \| HTMLElement` | *required* | The draggable thumb element or CSS selector |
| `content` | `string \| HTMLElement \| Array` | *required* | The content element(s) to scroll. Pass an array to sync multiple elements. |
| `viewport` | `string \| HTMLElement` | *required* | The viewport/clipping element or CSS selector |
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | Scroll direction |
| `keyboardSteps` | `number` | `50` | Number of arrow-key steps across the full range |
| `trackClick` | `boolean` | `true` | Click on track to jump to that position |
| `autoResize` | `boolean` | `true` | Recalculate on window resize |
| `resizeDebounce` | `number` | `100` | Resize debounce delay in ms |
| `onScroll` | `(ratio: number) => void` | — | Called on every position change (0–1) |
| `onDragStart` | `() => void` | — | Called when drag begins |
| `onDragEnd` | `() => void` | — | Called when drag ends |

### Instance Methods

| Method | Description |
|--------|-------------|
| `scrollTo(ratio)` | Scroll to a position between 0 (start) and 1 (end) |
| `scrollToOffset(px)` | Scroll so a pixel offset in the content is centered in the viewport |
| `update()` | Recalculate thumb size and positions (call after content/layout changes) |
| `focus()` | Focus the thumb for keyboard control |
| `destroy()` | Remove all event listeners and clean up |

### Instance Properties

| Property | Type | Description |
|----------|------|-------------|
| `ratio` | `number` | Current scroll position (0–1), read-only |
| `isDragging` | `boolean` | Whether the user is currently dragging, read-only |

## Examples

### Vertical scrollbar

```ts
const scrollbar = new DetachedScrollbar({
  track: '#v-track',
  thumb: '#v-thumb',
  content: '#v-content',
  viewport: '#v-viewport',
  direction: 'vertical',
});
```

For vertical, use `top` instead of `left` in your CSS for the thumb, and the content should be taller than the viewport (not wider).

### Multiple content elements

One scrollbar controlling two rows that scroll together:

```ts
const scrollbar = new DetachedScrollbar({
  track: '#track',
  thumb: '#thumb',
  content: ['#row1', '#row2'],
  viewport: '#viewport',
});
```

### Programmatic scroll with callbacks

```ts
const scrollbar = new DetachedScrollbar({
  track: '#track',
  thumb: '#thumb',
  content: '#content',
  viewport: '#viewport',
  onScroll: (ratio) => {
    console.log(`Scrolled to ${Math.round(ratio * 100)}%`);
  },
  onDragStart: () => document.body.classList.add('is-scrolling'),
  onDragEnd: () => document.body.classList.remove('is-scrolling'),
});

// Scroll to center a specific element
const targetLeft = myElement.offsetLeft + myElement.offsetWidth / 2;
scrollbar.scrollToOffset(targetLeft);
```

## How It Works

The scrollbar and the content share no native scroll relationship. They are linked by a single value: `ratio` — a number between 0 and 1.

```
ratio = 0    → content at start, thumb at left/top edge
ratio = 0.5  → content halfway, thumb at center
ratio = 1    → content at end, thumb at right/bottom edge
```

Two equations power the entire system:

```
thumbPosition   =  ratio × (trackSize − thumbSize)
contentPosition = −ratio × (contentSize − viewportSize)
```

Every operation — dragging, keyboard, programmatic scrolling, resize — reads or writes `ratio`, then applies these equations.

## Development

```bash
git clone https://github.com/firasdeveloper/detached-scrollbar.git
cd detached-scrollbar
npm install
npm run build
```

Open `demo/index.html` in a browser to see the demo page (it imports from `dist/`).

## License

[MIT](LICENSE)
