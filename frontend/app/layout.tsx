import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rate Tracker',
  description: 'Interest rate comparison dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
