import { ReactNode } from 'react';
import '../styles.css';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>MLB Score Notifier</h1>
        <p>お好みのチームが得点したらすぐに通知します。</p>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
};
