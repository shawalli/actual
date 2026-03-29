import React from 'react';
import type { ReactNode } from 'react';

import { TestProviders } from '@desktop-client/mocks';

/**
 * Lightweight test wrapper that provides the Redux store (and QueryClient)
 * for components that only need the store context during testing.
 */
export function TestProvider({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>;
}
