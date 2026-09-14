// Estado mínimo (zustand) só pra abrir/fechar o tour a partir de qualquer lugar do shell autenticado:
// automaticamente na primeira visita, ou manualmente pelo botão em Configurações.
import { create } from 'zustand';

interface TourState {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
}

export const useTourStore = create<TourState>()((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
}));
