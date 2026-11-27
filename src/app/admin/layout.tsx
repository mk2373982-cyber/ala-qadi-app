import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The admin panel must never appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
