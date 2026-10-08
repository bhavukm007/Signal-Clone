import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <label className="input-field" htmlFor={inputId}>
      {label && <span className="field-label">{label}</span>}
      <input id={inputId} className={`text-input ${className}`} {...props} />
      {error && (
        <span className="input-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
