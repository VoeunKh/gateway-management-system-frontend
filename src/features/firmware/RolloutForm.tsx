import { useState } from 'preact/hooks';
import type { Schemas } from '@/api/endpoints';
import { Can } from '@/auth/guards';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Button, Card, Field, IconPlay, SelectField } from '@/ui';
import { RolloutPlan } from './RolloutPlan';
import { DEFAULT_THRESHOLD, DEFAULT_WAVES, checkRolloutForm } from './rolloutRules';
import type { RolloutFormValues } from './rolloutRules';
import { useRolloutPreview, useStartRollout } from './useRollouts';

type Image = Schemas['FirmwareImage'];

const PREVIEW_DEBOUNCE_MS = 400;

/** The newest image a rollout may use: last in the list that is not blocked. */
const defaultVersion = (images: Image[]) => images.filter((i) => !i.blocked).at(-1)?.version ?? '';

export interface RolloutFormProps {
  models: Schemas['Model'][];
  images: Image[];
}

/** Plan a rollout: model, version, waves and failure limit, with a live preview of the plan. */
export function RolloutForm({ models, images }: RolloutFormProps) {
  const [model, setModel] = useState(models[0]?.id ?? '');
  const [picked, setPicked] = useState('');
  const [waves, setWaves] = useState(DEFAULT_WAVES);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const forModel = images.filter((i) => i.model_id === model);
  const version = forModel.some((i) => i.version === picked && !i.blocked)
    ? picked
    : defaultVersion(forModel);

  const values: RolloutFormValues = { model, version, waves, threshold };
  const checked = checkRolloutForm(values);
  // The preview is asked for once typing settles; a stable string key stands in for the object.
  const liveKey = checked.request ? JSON.stringify(checked.request) : '';
  const key = useDebouncedValue(liveKey, PREVIEW_DEBOUNCE_MS);
  const preview = useRolloutPreview(key ? (JSON.parse(key) as Schemas['RolloutRequest']) : null);
  // Until the answer for the current form arrives, the numbers shown are the previous ones.
  const stale = liveKey !== key || preview.isPlaceholderData;
  const start = useStartRollout();
  const canStart = Boolean(checked.request) && !stale && preview.isSuccess && preview.data.need > 0;

  return (
    <Card title="Start a rollout">
      <div class="form-grid">
        <SelectField
          label="Model"
          value={model}
          onChange={(id) => {
            setModel(id);
            setPicked('');
          }}
          options={models.map((m) => ({ value: m.id, label: m.id }))}
        />
        <SelectField
          label="Target firmware"
          value={version}
          onChange={setPicked}
          options={forModel.map((i) => ({
            value: i.version,
            disabled: i.blocked,
            label: i.blocked
              ? `${i.version} (blocked${i.blocked_reason ? `: ${i.blocked_reason}` : ''})`
              : `${i.version} (${i.channel})`,
          }))}
        />
        <Field
          label="Waves, % of gateways"
          value={waves}
          error={checked.wavesError}
          hint="Each wave finishes before the next starts."
          onInput={(event) => setWaves(event.currentTarget.value)}
        />
        <Field
          label="Pause if failures exceed (%)"
          type="number"
          min={1}
          max={100}
          value={threshold}
          error={checked.thresholdError}
          onInput={(event) => setThreshold(event.currentTarget.value)}
        />
      </div>
      <RolloutPlan enabled={Boolean(checked.request)} preview={preview} stale={stale} />
      <Can perm="rollout">
        <Button
          variant="primary"
          icon={<IconPlay />}
          disabled={!canStart}
          loading={start.isPending}
          onClick={() => checked.request && start.mutate(checked.request)}
        >
          Start rollout
        </Button>
      </Can>
    </Card>
  );
}
