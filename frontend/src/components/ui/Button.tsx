import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  children: ReactNode;
}

export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'primary-button'
      : variant === 'quiet'
        ? 'icon-button'
        : variant === 'danger'
          ? 'primary-button danger-button'
          : 'secondary-button';
  return (
    <button className={`${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
