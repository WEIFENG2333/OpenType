import { InputHTMLAttributes, forwardRef, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = '', ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-surface-400">{label}</label>}
      <input
        ref={ref}
        className={`w-full bg-surface-850 border border-surface-700 rounded-lg px-3.5 py-2 text-sm
          text-surface-200 placeholder-surface-600
          focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30
          transition-colors ${error ? 'border-red-500/50' : ''} ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-xs text-surface-600">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  ),
);

Input.displayName = 'Input';

// Password input with toggle visibility
interface PasswordInputProps extends Omit<InputProps, 'type'> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={`pr-10 font-mono ${className}`} {...props} />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-2.5 top-[calc(50%+2px)] -translate-y-1/2 text-surface-500 hover:text-surface-300 p-1"
          tabIndex={-1}
        >
          {visible ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
