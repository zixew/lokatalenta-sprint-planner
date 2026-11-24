import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-[#0F766E] text-white border border-[#0F766E] hover:bg-[#115E59] hover:border-[#115E59] disabled:opacity-50',
  secondary:
    'bg-white dark:bg-[#161B22] text-[#18181B] dark:text-slate-100 border border-[#E5E3DC] dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50',
  danger:
    'bg-[#E11D48] text-white border border-[#E11D48] hover:bg-rose-700 disabled:opacity-50',
  ghost:
    'bg-transparent text-zinc-700 dark:text-slate-300 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50',
};

const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-xs',
  md: 'min-h-[44px] sm:min-h-[38px] px-3.5 py-2 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 ease-out active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0D1117] ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
