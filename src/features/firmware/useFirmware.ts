import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockFirmware, listFirmware, unblockFirmware, uploadFirmware } from '@/api/endpoints';
import type { Schemas } from '@/api/endpoints';
import { useToast } from '@/ui';

type Image = Schemas['FirmwareImage'];

/** Every image, or one model's. Rarely changes, so no polling. */
export function useFirmwareImages(model?: string) {
  return useQuery({ queryKey: ['firmware', model ?? 'all'], queryFn: () => listFirmware(model) });
}

export interface UploadVariables {
  form: FormData;
  onProgress: (fraction: number) => void;
}

/** Upload a signed image; toasts and cache refresh live in the hook's own options. */
export function useUploadFirmware(onDone: () => void) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ form, onProgress }: UploadVariables) => uploadFirmware(form, { onProgress }),
    onSuccess: async (image) => {
      toast({ message: `Uploaded ${image.model_id} ${image.version}`, tone: 'ok' });
      onDone();
      await client.invalidateQueries({ queryKey: ['firmware'] });
    },
  });
}

/** Block (with a reason) or unblock an image. */
export function useBlockFirmware(onDone?: () => void) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ image, reason }: { image: Image; reason?: string }) =>
      image.blocked ? unblockFirmware(image.id) : blockFirmware(image.id, reason),
    onSuccess: async (image) => {
      toast({
        message: `${image.model_id} ${image.version} ${image.blocked ? 'blocked' : 'unblocked'}`,
        tone: 'ok',
      });
      onDone?.();
      await client.invalidateQueries({ queryKey: ['firmware'] });
    },
    onError: (error) => toast({ message: error.message, tone: 'danger' }),
  });
}
