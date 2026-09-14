import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-acento-600 text-white shadow-xs hover:bg-acento-700 active:bg-acento-800',
        secondary: 'bg-primary-50 text-primary-800 hover:bg-primary-100 active:bg-primary-200',
        outline:
          'border border-borda bg-superficie text-texto shadow-xs hover:bg-zinc-50 active:bg-zinc-100',
        ghost: 'text-texto hover:bg-zinc-100 active:bg-zinc-200',
        destructive: 'bg-perigo-600 text-white shadow-xs hover:bg-perigo-700',
        link: 'h-auto px-0 text-primary-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm md:h-10',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11 md:size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Renderiza o filho como elemento raiz (ex.: <Button asChild><Link/></Button>). */
  asChild?: boolean;
  /** Mostra spinner, desabilita e marca aria-busy. */
  loading?: boolean;
  /** Ícone à esquerda do texto. */
  icon?: ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  icon,
  disabled,
  children,
  type,
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : icon}
          {children}
        </>
      )}
    </Comp>
  );
}
