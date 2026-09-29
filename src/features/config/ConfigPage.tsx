import { useState } from 'preact/hooks';
import { useLocation, useSearch } from 'wouter-preact';
import { useModels } from '@/api/useModels';
import { useUsers } from '@/api/useUsers';
import { Can } from '@/auth/guards';
import { useSession } from '@/auth/session';
import { Button, EmptyState, ErrorState, ModelPicker, Skeleton, useToast } from '@/ui';
import { FleetSummary } from './FleetSummary';
import { PushDialog } from './PushDialog';
import { VersionEditor } from './VersionEditor';
import { VersionList } from './VersionList';
import { VersionPanel } from './VersionPanel';
import { useConfigVersions, useModelFleet } from './useConfig';
import { useSettling } from './usePush';

/** Model and version live in the URL, so a view can be shared. */
function useSelection(defaultModel: string | undefined) {
  const params = new URLSearchParams(useSearch());
  const [, navigate] = useLocation();
  const model = params.get('model') ?? defaultModel;
  const v = Number(params.get('v'));
  const select = (next: { model?: string; v?: number }) => {
    const query = new URLSearchParams();
    const m = next.model ?? model;
    if (m) query.set('model', m);
    if (next.v) query.set('v', String(next.v));
    navigate(`/config?${query.toString()}`, { replace: true });
  };
  return { model, version: Number.isInteger(v) && v > 0 ? v : undefined, select };
}

function useAuthorName() {
  const { user, role } = useSession();
  const users = useUsers(role === 'admin');
  return (id: string | undefined) => {
    if (!id) return null;
    if (id === user?.id) return 'you';
    return users.data?.find((u) => u.id === id)?.name ?? null;
  };
}

export function ConfigPage() {
  const models = useModels();
  const { model, version, select } = useSelection(models.data?.[0]?.id);
  const versions = useConfigVersions(model);
  const [settling, startSettling] = useSettling();
  const fleet = useModelFleet(model, settling);
  const authorName = useAuthorName();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pushing, setPushing] = useState(false);

  if (models.isPending)
    return (
      <section class="page">
        <Skeleton lines={6} label="Loading models" />
      </section>
    );
  if (models.isError || !model) {
    return (
      <section class="page">
        <h1>Configuration</h1>
        <ErrorState
          message={models.error?.message ?? 'No models found.'}
          onRetry={() => void models.refetch()}
        />
      </section>
    );
  }

  const list = versions.data ?? [];
  const latest = list[0];
  const selected = list.find((v) => v.version === version) ?? latest;
  const newVersion = (
    <Can perm="config">
      <Button variant="primary" onClick={() => setEditing(true)} disabled={editing}>
        New version
      </Button>
    </Can>
  );

  const inSync =
    fleet.data !== undefined && fleet.data.target === selected?.version && fleet.data.drifted === 0;
  const pushButton = selected && (
    <Can perm="config">
      <Button
        onClick={() => setPushing(true)}
        disabled={inSync}
        title={inSync ? `v${selected.version} is the target and every gateway has it` : undefined}
      >
        {`Push v${selected.version} to ${model}`}
      </Button>
    </Can>
  );

  let body;
  if (versions.isPending) body = <Skeleton lines={8} label="Loading versions" />;
  else if (versions.isError)
    body = <ErrorState message={versions.error.message} onRetry={() => void versions.refetch()} />;
  else if (editing) {
    body = (
      <VersionEditor
        key={model}
        modelId={model}
        latest={latest}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          toast({ message: `Saved ${model} config v${saved.version}`, tone: 'ok' });
          select({ v: saved.version });
        }}
      />
    );
  } else if (!selected) {
    body = (
      <EmptyState title="No config versions yet" action={newVersion}>
        Write the first version for {model}.
      </EmptyState>
    );
  } else {
    body = (
      <div class="config-layout">
        <VersionList
          versions={list}
          selected={selected.version}
          target={fleet.data?.target}
          authorName={authorName}
          onSelect={(v) => select({ v })}
        />
        <VersionPanel modelId={model} version={selected} authorName={authorName} />
      </div>
    );
  }

  return (
    <section class="page">
      <header class="config-head">
        <h1>Configuration</h1>
        {!editing && selected && (
          <div class="config-head__actions">
            {pushButton}
            {newVersion}
          </div>
        )}
      </header>
      <ModelPicker
        models={models.data}
        value={model}
        onChange={(m) => {
          setEditing(false);
          select({ model: m });
        }}
      />
      <FleetSummary modelId={model} />
      {body}
      {selected && (
        <PushDialog
          open={pushing}
          modelId={model}
          version={selected.version}
          onClose={() => setPushing(false)}
          onPushed={startSettling}
        />
      )}
    </section>
  );
}
