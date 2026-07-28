import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * pdfjs (via react-pdf, used by the magazine and prospectus viewers) reaches for
 * canvas APIs that jsdom does not implement. Importing a page that renders a PDF
 * would otherwise fail at module load with "DOMMatrix is not defined" — before
 * any assertion runs.
 *
 * These stubs exist only so the module can be imported; they are not a working
 * canvas implementation, so a test that genuinely needs to render PDF content
 * should mock react-pdf instead.
 */
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixStub {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(_init?: string | number[]) {}
    scale() { return this; }
    translate() { return this; }
    multiply() { return this; }
  }
  Object.assign(globalThis, {
    DOMMatrix: DOMMatrixStub,
    Path2D: class {},
    ImageData: class {},
  });
}

afterEach(() => {
  cleanup();
});

