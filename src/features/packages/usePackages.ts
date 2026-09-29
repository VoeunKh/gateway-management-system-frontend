import { useQuery } from '@tanstack/react-query';
import { getFleetPackages } from '@/api/endpoints';

/** What a model's gateways run, package by package, against what each firmware ships. */
export function useFleetPackages(modelId: string | undefined) {
  return useQuery({
    queryKey: ['packages', modelId],
    queryFn: () => getFleetPackages(modelId ?? ''),
    enabled: Boolean(modelId),
  });
}
