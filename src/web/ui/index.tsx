import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import './ui.css';

/**
 * The component inventory. Protected by hook (ADR-009).
 * Screens compose from this file; screens do not design new components.
 */

export function AppBar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="app-bar">
      <h1 className="app-bar__title">{title}</h1>
      {actions ? <div className="row">{actions}</div> : null}
    </header>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="stack">{children}</div>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'quiet' | 'danger';
};

export function Button({ variant = 'default', className, ...rest }: ButtonProps) {
  const variantClass = variant === 'default' ? '' : ` button--${variant}`;
  return <button className={`button${variantClass}${className ? ` ${className}` : ''}`} {...rest} />;
}

export function Field({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input className="field__input" {...rest} />
    </label>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function Notice({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <p className={`notice${tone === 'danger' ? ' notice--danger' : ''}`} role="status">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  children,
  hint,
}: {
  title: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <div className="empty__body">{children}</div>
      {hint ? <p className="empty__hint">{hint}</p> : null}
    </div>
  );
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="definition-list">
      {items.map(([term, value]) => (
        <div key={term} style={{ display: 'contents' }}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
