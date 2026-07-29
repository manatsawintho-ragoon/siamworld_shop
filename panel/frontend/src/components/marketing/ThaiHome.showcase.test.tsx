// @vitest-environment jsdom
/**
 * The feature showcase advances on its own every few seconds, so every visitor
 * walks the whole slide set. The mockups behind those slides call hooks, and
 * they were being invoked as `Mock()` instead of rendered as `<Mock />`, which
 * put their hooks in the page's hook list. The admin mockup uses one hook more
 * than the other four, so arriving at it changed the hook count between renders
 * and React aborted the page - reported in production as a bare `Error`,
 * because next-intl replaces anything thrown inside `useTranslations` and drops
 * the message in production builds.
 *
 * This walks the carousel the way a visitor does and fails if any slide takes
 * the page down.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../messages/th.json';
// vi.mock calls below are hoisted above this import, so ThaiHome picks them up.
import ThaiHome from '@/components/marketing/ThaiHome';

// The page's own chrome and network are not what this test is about.
vi.mock('@/components/Navbar', () => ({ default: () => null }));
vi.mock('@/components/AuthCodeExchange', () => ({ default: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...rest }: { children?: React.ReactNode; href?: string }) => (
    <a {...rest}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({ alt, ...rest }: { alt?: string; src?: string }) => <img alt={alt} {...rest} />,
}));
// No backend in a unit test: every call rejects and the page keeps its
// defaults, which is also what a visitor gets when the API is unreachable.
vi.mock('@/lib/api', () => ({
  default: { get: () => Promise.reject(new Error('no backend in test')) },
}));

const NEXT_SLIDE = messages.home.nextSlide;
const SLIDE_COUNT = 5;

let host: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root = createRoot(host);
    root.render(
      <NextIntlClientProvider locale="th" messages={messages} timeZone="Asia/Bangkok">
        <ThaiHome />
      </NextIntlClientProvider>
    );
  });
}

function clickNextSlide() {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${NEXT_SLIDE}"]`);
  if (!button) throw new Error('next-slide control not found');
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom ships neither, and the mock scaler and framer-motion both ask for them.
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopObserver;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = NoopObserver;
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
});

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host.remove();
});

describe('ThaiHome feature showcase', () => {
  it('survives a full pass through every slide', () => {
    render();
    for (let i = 1; i <= SLIDE_COUNT; i++) {
      expect(() => clickNextSlide(), `advancing to slide ${i}`).not.toThrow();
    }
  });

  it('renders the admin mockup - the slide with the extra hook', () => {
    render();
    // The admin mockup is the fifth slide; four advances land on it.
    for (let i = 0; i < 4; i++) clickNextSlide();
    expect(host.textContent).toContain('yourshop.siamsite.shop/admin');
  });
});
