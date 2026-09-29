import { request, upload } from './client';
import type { UploadOptions } from './client';
import type { components as Draft, paths as DraftPaths } from './proposed.gen';
import type { components, paths } from './types.gen';

// One typed function per endpoint the console uses. Hooks call these; nothing else does.
// Schemas covers the published spec and the draft one (api/proposed.yaml) under the same
// names, so moving a schema from the draft into the spec changes nothing here.
export type Schemas = components['schemas'] & Draft['schemas'];
/** A device as the console reads it: the published fields plus the draft extras. */
export type DeviceView = Schemas['DeviceDetail'] & Schemas['DeviceExtras'];
export type MetricsQuery = NonNullable<
  paths['/devices/{sn}/metrics']['get']['parameters']['query']
>;
export type HistoryQuery = NonNullable<
  paths['/devices/{sn}/history']['get']['parameters']['query']
>;
export type DeviceQuery = NonNullable<paths['/devices']['get']['parameters']['query']>;
export type RolloutQuery = NonNullable<DraftPaths['/rollouts']['get']['parameters']['query']>;
export type AlertQuery = NonNullable<DraftPaths['/alerts']['get']['parameters']['query']>;

const seg = encodeURIComponent;

// Auth
export const login = (body: Schemas['LoginRequest']) =>
  request<Schemas['LoginResponse']>('/auth/login', { method: 'POST', json: body });
export const logout = () => request<undefined>('/auth/logout', { method: 'POST' });
export const getMe = () => request<Schemas['User']>('/auth/me');

// Users
export const listUsers = () => request<Schemas['User'][]>('/users');
export const getUser = (id: string) => request<Schemas['User']>(`/users/${seg(id)}`);
export const createUser = (body: Schemas['CreateUserRequest']) =>
  request<Schemas['User']>('/users', { method: 'POST', json: body });
export const updateUser = (id: string, body: Schemas['UpdateUserRequest']) =>
  request<Schemas['User']>(`/users/${seg(id)}`, { method: 'PATCH', json: body });
export const deleteUser = (id: string) =>
  request<undefined>(`/users/${seg(id)}`, { method: 'DELETE' });

// Models and sites
export const listModels = () => request<Schemas['Model'][]>('/models');
export const createModel = (body: Schemas['CreateModelRequest']) =>
  request<Schemas['Model']>('/models', { method: 'POST', json: body });
export const updateModel = (id: string, body: Schemas['UpdateModelRequest']) =>
  request<Schemas['Model']>(`/models/${seg(id)}`, { method: 'PATCH', json: body });
export const listSites = () => request<Schemas['Site'][]>('/sites');
export const createSite = (body: Schemas['SiteRequest']) =>
  request<Schemas['Site']>('/sites', { method: 'POST', json: body });
export const updateSite = (id: string, body: Schemas['SiteRequest']) =>
  request<Schemas['Site']>(`/sites/${seg(id)}`, { method: 'PATCH', json: body });

// Config versions
export const listConfigVersions = (modelId: string) =>
  request<Schemas['ConfigVersion'][]>(`/models/${seg(modelId)}/configs`);
export const getConfigVersion = (modelId: string, version: number) =>
  request<Schemas['ConfigVersion']>(`/models/${seg(modelId)}/configs/${version}`);
export const createConfigVersion = (modelId: string, body: Schemas['CreateConfigVersionRequest']) =>
  request<Schemas['ConfigVersion']>(`/models/${seg(modelId)}/configs`, {
    method: 'POST',
    json: body,
  });
export const diffConfigVersions = (modelId: string, version: number, against: number) =>
  request<Schemas['DiffOp'][]>(`/models/${seg(modelId)}/configs/${version}/diff`, {
    query: { against },
  });

// Config push (draft spec until the backend publishes it)
export const previewConfigPush = (modelId: string, version: number) =>
  request<Schemas['PushPreview']>(`/models/${seg(modelId)}/configs/${version}/push/preview`, {
    method: 'POST',
  });
export const pushConfig = (modelId: string, version: number) =>
  request<Schemas['PushResult']>(`/models/${seg(modelId)}/configs/${version}/push`, {
    method: 'POST',
  });

// Packages and firmware manifests
export const getFleetPackages = (modelId: string) =>
  request<Schemas['FleetPackages']>(`/models/${seg(modelId)}/packages`);
export const getFirmwareManifest = (modelId: string, fwVersion: string) =>
  request<Schemas['FirmwareManifest']>(
    `/models/${seg(modelId)}/firmware/${seg(fwVersion)}/manifest`,
  );
export const recordFirmwareManifest = (modelId: string, fwVersion: string, manifest: string) =>
  request<Schemas['FirmwareManifestCreated']>(
    `/models/${seg(modelId)}/firmware/${seg(fwVersion)}/manifest`,
    { method: 'POST', text: manifest },
  );

// Devices
export const listDevices = (query: DeviceQuery = {}, signal?: AbortSignal) =>
  request<Schemas['DeviceList']>('/devices', { query, signal });
export const getDevice = (sn: string) => request<DeviceView>(`/devices/${seg(sn)}`);
export const getDeviceMetrics = (sn: string, query: MetricsQuery = {}) =>
  request<Schemas['MetricsSeries']>(`/devices/${seg(sn)}/metrics`, { query });
export const getDeviceHistory = (sn: string, query: HistoryQuery = {}) =>
  request<Schemas['DeviceHistory']>(`/devices/${seg(sn)}/history`, { query });
export const updateDevice = (sn: string, patch: Schemas['DevicePatch']) =>
  request<Schemas['DeviceDetail']>(`/devices/${seg(sn)}`, { method: 'PATCH', json: patch });
export const getRenderedConfig = (sn: string) =>
  request<Schemas['RenderedConfig']>(`/devices/${seg(sn)}/config/rendered`);

// Overview
export const getOverview = () => request<Schemas['Overview']>('/overview');

// Remote actions and jobs (draft spec until the backend publishes them)
export const createAction = (sn: string, type: Schemas['JobType']) =>
  request<Schemas['Job']>(`/devices/${seg(sn)}/actions`, { method: 'POST', json: { type } });
export const getJob = (id: string) => request<Schemas['Job']>(`/jobs/${seg(id)}`);
export const cancelJob = (id: string) =>
  request<Schemas['Job']>(`/jobs/${seg(id)}/cancel`, { method: 'POST' });
export const getJobLogs = (id: string) => request<Schemas['JobLogs']>(`/jobs/${seg(id)}/logs`);

// Rollouts and alerts (draft spec until the backend publishes them)
export const listRollouts = (query: RolloutQuery = {}) =>
  request<Schemas['Rollout'][]>('/rollouts', { query });
export const getRollout = (id: string) => request<Schemas['Rollout']>(`/rollouts/${seg(id)}`);
export const previewRollout = (body: Schemas['RolloutRequest']) =>
  request<Schemas['RolloutPreview']>('/rollouts/preview', { method: 'POST', json: body });
export const createRollout = (body: Schemas['RolloutRequest']) =>
  request<Schemas['Rollout']>('/rollouts', { method: 'POST', json: body });
export const rolloutAction = (id: string, action: 'pause' | 'resume' | 'abort') =>
  request<Schemas['Rollout']>(`/rollouts/${seg(id)}/${action}`, { method: 'POST' });

// Firmware images (draft spec)
export const listFirmware = (model?: string) =>
  request<Schemas['FirmwareImage'][]>('/firmware', { query: { model } });
export const uploadFirmware = (form: FormData, options?: UploadOptions) =>
  upload<Schemas['FirmwareImage']>('/firmware', form, options);
export const blockFirmware = (id: string, reason?: string) =>
  request<Schemas['FirmwareImage']>(`/firmware/${seg(id)}/block`, {
    method: 'POST',
    json: { reason },
  });
export const unblockFirmware = (id: string) =>
  request<Schemas['FirmwareImage']>(`/firmware/${seg(id)}/unblock`, { method: 'POST' });

export const listAlerts = (query: AlertQuery = {}) =>
  request<Schemas['Alert'][]>('/alerts', { query });
export const listAlertRules = () => request<Schemas['AlertRule'][]>('/alerts/rules');
export const ackAlert = (id: string) =>
  request<Schemas['Alert']>(`/alerts/${seg(id)}/ack`, { method: 'POST' });
