# Docker: building, running and deploying the console

Everything here is driven by `make`; Docker (with Compose v2) and `make` are the only tools
you need. Node, npm and nginx all run inside containers.

- [Quick start](#quick-start)
- [Does `make … up` build for me?](#does-make--up-build-for-me)
- [The files](#the-files)
- [How the image is built](#how-the-image-is-built)
- [Development: `make dev`](#development-make-dev)
- [Production: `make prod-up`](#production-make-prod-up)
- [Settings (`.env`)](#settings-env)
- [Make targets](#make-targets)
- [Deploying to a server](#deploying-to-a-server)
- [Building behind a corporate proxy](#building-behind-a-corporate-proxy)
- [CI](#ci)
- [Troubleshooting](#troubleshooting)

## Quick start

```sh
cp .env.example .env      # optional; every setting has a default
make dev                  # dev server with live reload → http://localhost:5173
make prod-up              # production container          → http://localhost:8081
make smoke                # check the production container answers
make prod-down            # stop it
make                      # list every target
```

Both setups send `/api` to the backend at `http://<docker host>:8080` by default, which is
where the backend's own `make dev-up` listens. Change `API_PROXY_TARGET` (dev) or
`API_UPSTREAM` (production) in `.env` to point somewhere else.

## Does `make … up` build for me?

Yes. You never have to build by hand:

| You run | It builds first | Then |
| --- | --- | --- |
| `make dev` / `make dev-up` | `make dev-build` (the `dev` image) | starts the Vite dev server |
| `make prod-up` | `make prod-build` (the `prod` image) | starts the production container |
| `make check` | the `build` stage only | nothing to start; it just reports pass or fail |
| `make prod-restart` | **nothing** | recreates the container from the image already built |

Rebuilding is cheap when nothing changed: every step comes from Docker's cache and
`make prod-up` finishes in a few seconds. After a code change, the `build` stage re-runs lint,
typecheck, tests, the production build and the size budget (about a minute), so an image
is only ever produced from code that passes every check.

There is no plain `make up`; use `make dev-up` or `make prod-up`.

## The files

| File | Role |
| --- | --- |
| `Dockerfile` | One multi-stage build with the targets `dev`, `build` and `prod` |
| `compose.dev.yaml` | Runs the `dev` image with the source bind-mounted |
| `compose.prod.yaml` | Runs the `prod` image, hardened |
| `docker/nginx/default.conf.template` | nginx site config; `${…}` values are filled from the environment at start-up |
| `docker/nginx/security-headers.conf` | Security headers included by every page location |
| `.env.example` | Every setting with its default; copy to `.env` (git-ignored) |
| `.dockerignore` | Keeps `node_modules`, `dist`, `.git`, `.env` and friends out of the build |
| `Makefile` | The commands; `make` lists them |

## How the image is built

```
node:22-alpine
  └─ deps    npm ci from package-lock.json (cached until the lockfile changes)
      ├─ dev    + source → `npm run dev` on 0.0.0.0:5173
      └─ build  + source → lint → typecheck → test → build → size budget
                   └─ prod   nginxinc/nginx-unprivileged:1.30-alpine + dist/ only
```

- **`deps`** copies only `package.json` and `package-lock.json` and runs `npm ci`, so the slow
  install is cached until dependencies change. npm's download cache is a BuildKit cache
  mount and never ends up in an image.
- **`build`** copies the source and runs the same checks as CI. If any of them fails, the
  build stops and no image is tagged. It also deletes `dist/.vite` (the build manifest the
  size check reads) so it is not published.
- **`prod`** starts again from a small nginx image and copies in only the built files, the
  nginx config and the security headers. No Node, no source, no `node_modules`: about 80 MB.
  It runs as the unprivileged `nginx` user (uid 101) on port 8080.

The production image is tagged twice, `gwfleet-web:<git commit>` and `gwfleet-web:latest`, so
every build can be traced to its commit. Override with `IMAGE` and `TAG` (see
[Settings](#settings-env)).

To build without make: `docker build --target prod -t gwfleet-web:dev .`

## Development: `make dev`

`make dev` builds the `dev` image and starts `compose.dev.yaml` in the foreground (Ctrl-C
stops it); `make dev-up` does the same in the background.

- **Source** is bind-mounted into `/app`, so edits on your machine are picked up at once
  and Vite reloads the page.
- **`node_modules`** lives in a named Docker volume, not your checkout. The container's Linux
  build of the dependencies never mixes with anything on your machine. After
  `package-lock.json` changes (for example after pulling), run `make dev-install`.
- **`/api`** is proxied by Vite to `API_PROXY_TARGET`. The default,
  `http://host.docker.internal:8080`, is your machine as seen from inside the container
  (compose maps `host.docker.internal` to the Docker host, which also works on Linux).
- **`make dev-shell`** opens a shell in the container for `npm test`, `npx vitest`, and so on.
- **File changes not noticed?** Some macOS/Windows mounts don't deliver file events; set
  `CHOKIDAR_USEPOLLING=true` in `.env`.

Edits reload the whole page rather than hot-swapping components, because Preact's Vite
plugin (`@preact/preset-vite`) is not part of the fixed stack.

## Production: `make prod-up`

`make prod-up` builds the `prod` image and starts `compose.prod.yaml` in the background.

### What nginx serves

| Path | Behaviour |
| --- | --- |
| `/healthz` | `200 ok`, for load balancers and the container health check |
| `/api/…` | Proxied to `API_UPSTREAM` with `Host`, `X-Real-IP`, `X-Forwarded-For` and `X-Forwarded-Proto`. Uploads up to `CLIENT_MAX_BODY_SIZE` are streamed, not buffered (firmware images) |
| `/assets/…` | Built JS/CSS with hashed names: cached for a year (`immutable`); a missing file is a 404 |
| anything else | `index.html`, revalidated on every load (`no-cache`), so a new release is picked up straight away and deep links like `/devices/GW200-0001` work |

Responses are gzip-compressed, and every page carries these security headers:
`Content-Security-Policy` (scripts, styles and API calls from the same origin only; no
inline scripts; no framing), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin` and a `Permissions-Policy` turning off camera, microphone
and location.

### Why `/api` goes through nginx

The browser only ever talks to one origin. The backend's HttpOnly refresh cookie (path
`/api/v1/auth`) therefore works without CORS or cross-site cookie settings, and the
backend's address never appears in the browser.

nginx looks up the `API_UPSTREAM` host name **once, when the container starts** (including
`/etc/hosts`, which is how `host.docker.internal` works on Linux). The backend doesn't have to
be running for the console to start, only its name has to resolve. If the backend's
address changes afterwards (for example its container is recreated on a shared network and
gets a new IP), run `make prod-restart`.

`X-Forwarded-Proto` is passed through from an outer proxy when there is one. Behind a
TLS-terminating proxy the backend therefore sees `https`, not the `http` used inside the
container.

### Hardening in `compose.prod.yaml`

- Read-only root filesystem; nginx gets two small writable tmpfs mounts owned by uid 101
  (`/tmp`, and `/etc/nginx/conf.d` for the config it renders at start-up)
- All Linux capabilities dropped and `no-new-privileges`
- Runs as uid 101, never root
- `restart: unless-stopped`, and a health check every 30 s (`make prod-ps` shows it)

## Settings (`.env`)

`make` and `docker compose` both read `.env`. Every value has a default, so the file is
optional. Values given on the command line win: `make prod-up WEB_PORT=9000`.

| Setting | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `DEV_PORT` | dev | `5173` | Port for the dev server on your machine |
| `API_PROXY_TARGET` | dev | `http://host.docker.internal:8080` | Backend the Vite dev server proxies `/api` to |
| `CHOKIDAR_USEPOLLING` | dev | `false` | Poll for file changes when the mount doesn't report them |
| `IMAGE` | prod | `gwfleet-web` | Image name, including a registry if you push, e.g. `registry.example.com/gwfleet-web` |
| `TAG` | prod | current git commit | Image tag to build and run; set it to pin a release |
| `WEB_PORT` | prod | `8081` | Port for the console on the host (the backend usually has 8080) |
| `API_UPSTREAM` | prod | `http://host.docker.internal:8080` | Backend `scheme://host:port`, **no path**, that nginx proxies `/api` to |
| `CLIENT_MAX_BODY_SIZE` | prod | `512m` | Largest request body nginx accepts (firmware uploads) |
| `BUILD_CA` | builds | empty | CA certificate for a TLS-intercepting proxy ([details](#building-behind-a-corporate-proxy)) |
| `DOCKER_BUILD_FLAGS` | builds | empty | Extra flags for every `docker build` |

Changing a `prod` runtime setting (`WEB_PORT`, `API_UPSTREAM`, `CLIENT_MAX_BODY_SIZE`) only
needs `make prod-restart`; no rebuild.

## Make targets

| Target | Runs |
| --- | --- |
| `make` / `make help` | Lists the targets |
| `make dev-build` | `docker build --target dev -t gwfleet-web-dev:local .` |
| `make dev` | `dev-build`, then `docker compose -f compose.dev.yaml up` |
| `make dev-up` | `dev-build`, then the same with `-d` |
| `make dev-down` | `docker compose -f compose.dev.yaml down` |
| `make dev-logs` | Follows the dev server log |
| `make dev-shell` | `sh` in a fresh dev container |
| `make dev-install` | `npm ci` in the container (after `package-lock.json` changes) |
| `make check` | `docker build --target build .`: every check, in a clean container; writes nothing to your checkout |
| `make prod-build` | `docker build --target prod -t $(IMAGE):$(TAG) -t $(IMAGE):latest .` |
| `make prod-up` | `prod-build`, then `docker compose -f compose.prod.yaml up -d --no-build` |
| `make prod-down` | `docker compose -f compose.prod.yaml down` |
| `make prod-restart` | Recreates the container from the existing image (applies `.env` changes) |
| `make prod-logs` | Follows the nginx log |
| `make prod-ps` | Shows the container and its health |
| `make smoke` | Waits up to 30 s for `/healthz`, then checks it and that a deep link returns the app |
| `make clean` | Stops both setups and deletes the dev `node_modules` volume |

## Deploying to a server

### A. Build on the server

The simplest option, for a single on-prem host with Docker and `make`:

```sh
git clone <this repo> gwfleet-web && cd gwfleet-web
cp .env.example .env        # set API_UPSTREAM (and WEB_PORT if needed)
make prod-up && make smoke
```

To upgrade: `git pull && make prod-up`. The image is rebuilt, every check runs again, and the
container is replaced only if they all pass. To roll back, check out the earlier commit and
run `make prod-up` (unchanged layers come from the cache).

### B. Build once, run anywhere (registry)

Build and push from CI or a workstation:

```sh
make prod-build IMAGE=registry.example.com/gwfleet-web TAG=1.0.0
docker push registry.example.com/gwfleet-web:1.0.0
```

The server then only needs `compose.prod.yaml` and a `.env` containing
`IMAGE=registry.example.com/gwfleet-web` and `TAG=1.0.0`:

```sh
docker compose -f compose.prod.yaml up -d --no-build   # pulls the image if it's missing
```

Upgrade or roll back by changing `TAG` and running the same command.

### Where is the backend?

| Backend runs… | Set `API_UPSTREAM` to |
| --- | --- |
| on the same host, port published (e.g. its `make dev-up`) | `http://host.docker.internal:8080` (the default) |
| on another machine | `http://backend.internal.example:8080` |
| in Docker on the same host, on a shared network | its container or service name, plus the override below |

For a shared Docker network, create `compose.prod.override.yaml` (the name is up to you) next
to `compose.prod.yaml`:

```yaml
services:
  web:
    environment:
      API_UPSTREAM: http://api:8080 # the backend's service or container name
    networks: [default, backend]
networks:
  backend:
    name: gwfleet-backend # the backend's existing network
    external: true
```

Start it with both files: `docker compose -f compose.prod.yaml -f compose.prod.override.yaml up -d`.
The `make prod-*` targets use `compose.prod.yaml` alone.

### HTTPS

The container speaks plain HTTP on port 8080. Put it behind whatever terminates TLS for you
(a load balancer, Traefik, Caddy, a host nginx) and forward to `http://<host>:$WEB_PORT`.
Have that proxy send `X-Forwarded-Proto: https` (most do by default); the console passes it
on to the backend, so the backend knows the browser used HTTPS.

## Building behind a corporate proxy

If your network inspects HTTPS with its own certificate authority, `npm ci` inside the build
fails with certificate errors. Give the build that CA:

```sh
make prod-up BUILD_CA=/etc/ssl/certs/corporate-ca.crt
```

The file is passed as a BuildKit **secret**: it is available to `npm ci` only and is never
stored in any image layer. If the proxy also has to be set explicitly, add it with
`DOCKER_BUILD_FLAGS`, for example:

```sh
make prod-up BUILD_CA=/etc/ssl/certs/corporate-ca.crt \
  DOCKER_BUILD_FLAGS="--build-arg HTTPS_PROXY=http://proxy.example:3128"
```

Both can live in `.env` instead of the command line.

## CI

`.github/workflows/web.yml` runs two jobs on every pull request and push to `main`:

- **check**: gen:api drift, lint, typecheck, tests, build and size, directly with npm;
- **docker**: `make prod-up`, `make smoke`, then `make prod-down`. A change that breaks the
  Dockerfile, the nginx config or the compose file fails the pull request.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `make: *** No rule to make target 'up'` | Use `make dev-up` or `make prod-up` |
| `/api` requests return **502** | nginx can't reach `API_UPSTREAM`. Test from inside the container: `docker compose -f compose.prod.yaml exec web sh -c 'wget -qO- -T 3 "$API_UPSTREAM/api/v1/healthz"'` (*Connection refused* means nothing listens there). Then `make prod-logs`. If the backend's IP changed, `make prod-restart` |
| Container keeps restarting; log says `[emerg] host not found in upstream` | The `API_UPSTREAM` host name doesn't resolve. Fix the name, or join the backend's network (see [above](#where-is-the-backend)) |
| `port is already allocated` | Another process uses `WEB_PORT` or `DEV_PORT`; change it in `.env` |
| `make prod-restart` fails with *pull access denied* / *image not found* | `TAG` defaults to the current commit, and nothing was built for it yet (you committed or pulled since the last build). Run `make prod-up`, or pin `TAG` in `.env` |
| Dev server errors about a missing module after `git pull` | Dependencies changed: `make dev-install` |
| Dev server doesn't notice edits | Set `CHOKIDAR_USEPOLLING=true` in `.env` and `make dev-up` again |
| `npm ci` fails during the build with certificate errors | See [Building behind a corporate proxy](#building-behind-a-corporate-proxy) |
| The build stops at lint, a test or `size` | That's the gate working: the same check fails locally with `npm run lint`, `npm test` or `npm run size`. Fix it, then build again |
| Container shows `unhealthy` | `make prod-logs`; nginx logs the reason at start-up |
| Start again from scratch | `make clean`, then `make dev` or `make prod-up` |
