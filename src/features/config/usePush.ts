import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'preact/hooks';
import { previewConfigPush, pushConfig } from '@/api/endpoints';
import { useToast } from '@/ui';

/** How long the config page polls faster after a push, while gateways apply it. */
export const SETTLE_MS = 60_000;

/** Who a push of this version would reach. Always fresh: it changes as gateways come and go. */
export function usePushPreview(modelId: string, version: number, open: boolean) {
  return useQuery({
    queryKey: ['push-preview', modelId, version],
    queryFn: () => previewConfigPush(modelId, version),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Push a version to a model, then refresh what depends on it. Toasts live in hook options. */
export function usePushConfig(modelId: string, onPushed: () => void) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (version: number) => pushConfig(modelId, version),
    onSuccess: async (result, version) => {
      toast({
        message: `Pushing v${version} to ${result.jobs} ${modelId} gateways`,
        tone: 'ok',
      });
      onPushed();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['model-fleet', modelId] }),
        client.invalidateQueries({ queryKey: ['devices'] }),
      ]);
    },
    onError: (error) => toast({ message: `Not pushed: ${error.message}`, tone: 'danger' }),
  });
}

/** True for a minute after `start()`: the page polls sync counts faster while it is. */
export function useSettling(): [boolean, () => void] {
  const [settling, setSettling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = () => {
    clearTimeout(timer.current);
    setSettling(true);
    timer.current = setTimeout(() => setSettling(false), SETTLE_MS);
  };
  return [settling, start];
}
