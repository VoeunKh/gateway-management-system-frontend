import { useQuery } from '@tanstack/react-query';
import { listModels } from './endpoints';

/** The five gateway models; rarely changes, so it stays fresh for 10 minutes. */
export function useModels() {
  return useQuery({ queryKey: ['models'], queryFn: listModels, staleTime: 10 * 60_000 });
}
