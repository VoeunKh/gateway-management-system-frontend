import { useLocation, useSearch } from 'wouter-preact';
import { useModels } from '@/api/useModels';
import { EmptyState, ErrorState, ModelPicker, Skeleton } from '@/ui';
import { PackageSummaryLine, PackageTable } from './PackageTable';
import { summarize, toRows } from './rows';
import { useFleetPackages } from './usePackages';

/** The model lives in the URL, so a view can be shared. */
function useModelParam(defaultModel: string | undefined) {
  const params = new URLSearchParams(useSearch());
  const [, navigate] = useLocation();
  const model = params.get('model') ?? defaultModel;
  return { model, select: (id: string) => navigate(`/packages?model=${encodeURIComponent(id)}`) };
}

export function PackagesPage() {
  const models = useModels();
  const { model, select } = useModelParam(models.data?.[0]?.id);
  const fleet = useFleetPackages(model);

  const heading = (
    <>
      <h1>Packages</h1>
      <p class="muted">
        What each model's gateways have installed, next to what their firmware ships. Packages are
        reported from firmware v2 on.
      </p>
    </>
  );
  if (models.isPending) {
    return (
      <section class="page">
        {heading}
        <Skeleton lines={6} label="Loading models" />
      </section>
    );
  }
  if (models.isError || !model) {
    return (
      <section class="page">
        {heading}
        <ErrorState
          message={models.error?.message ?? 'No models found.'}
          onRetry={() => void models.refetch()}
        />
      </section>
    );
  }

  let body;
  if (fleet.isPending) body = <Skeleton lines={6} label="Loading packages" />;
  else if (fleet.isError) {
    body = <ErrorState message={fleet.error.message} onRetry={() => void fleet.refetch()} />;
  } else if (fleet.data.packages.length === 0) {
    body = (
      <EmptyState title="No packages reported">
        No {model} gateway has reported installed packages yet.
      </EmptyState>
    );
  } else {
    const rows = toRows(fleet.data);
    body = (
      <>
        <PackageSummaryLine summary={summarize(rows)} />
        <PackageTable rows={rows} />
      </>
    );
  }

  return (
    <section class="page">
      {heading}
      <ModelPicker models={models.data} value={model} onChange={select} />
      {body}
    </section>
  );
}
