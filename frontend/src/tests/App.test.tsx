import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import App from '../App';

/**
 * `App` owns its own Router but not its providers — `HelmetProvider` wraps it in
 * main.tsx. Mirror that here, or every page's <Seo> component throws on mount
 * because `Helmet` has no dispatcher context to register with.
 */
function renderApp() {
  return render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}

describe('App', () => {
  it('renders without crashing', () => {
    renderApp();
    expect(screen.getByRole('navigation')).toBeDefined();
  });
});
