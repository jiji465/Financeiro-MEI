import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-11 w-full items-center gap-1 rounded-lg bg-zinc-100 p-1 text-zinc-600 md:h-10 md:w-auto',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-full flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-superficie data-[state=active]:text-texto data-[state=active]:shadow-xs md:flex-none',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 outline-none', className)} {...props} />;
}
