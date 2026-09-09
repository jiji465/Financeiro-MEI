import * as VisuallyHiddenPrimitive from '@radix-ui/react-visually-hidden';
import { type ComponentProps } from 'react';

/** Conteúdo só para leitores de tela (rótulos de ícones, tabelas de gráficos). */
export function VisuallyHidden(props: ComponentProps<typeof VisuallyHiddenPrimitive.Root>) {
  return <VisuallyHiddenPrimitive.Root {...props} />;
}
