# Dockerfile for xny/did-resolver
#
# Build from services/resolver, not from here:
#
#     docker build --platform linux/amd64 -f docker/Dockerfile -t <tag> .
#
# The context has to be the service root so .dockerignore applies and the COPY
# paths below resolve. Cluster nodes are amd64; a build on an Apple Silicon
# machine produces an arm64 image that will not start there.

# Split so the final image carries neither the lockfile-driven install machinery
# nor anything else the deps stage picked up along the way.
FROM node:22-alpine AS deps

WORKDIR /usr/src/app

# Ahead of the source, so this layer survives every build that does not change
# dependencies — which is nearly all of them.
COPY package.json package-lock.json ./

# `npm ci`, not `npm install`: it installs exactly what the lockfile pins and
# fails outright if package.json has drifted from it. That is what makes the
# build reproducible. --omit=dev leaves the test-only tree behind.
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime

# tini reaps zombies and forwards signals. node does handle SIGTERM as PID 1 here
# — index.js installs a handler, and without one the kernel would drop the signal
# entirely — but that leaves the drain one shell away from breaking: any CMD that
# ends up exec'ing through /bin/sh gets the signal delivered to the shell instead.
RUN apk add --no-cache tini

ENV NODE_ENV=production

WORKDIR /usr/src/app

# Ahead of the source: this is the largest layer by far and changes only when a
# dependency does, while the source changes on nearly every commit. Behind the
# source it would be rebuilt and re-pushed each time.
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Explicit paths rather than `COPY . .`, so what ships is a decision instead of a
# side effect of whatever happens to be in the working directory.
#
# Left owned by root. The service only ever reads these, and running as `node`
# against root-owned files means a compromised process cannot rewrite its own
# code or dependencies to persist across a restart.
COPY package.json ./
COPY index.js app.js ./
COPY controllers/ ./controllers/
COPY service/ ./service/
COPY utils/ ./utils/

# The env-var mapping, plus an empty production.json. config/default.json is a
# developer's local file carrying RESOLVER_GRAPH_ACCESS_TOKEN and deliberately
# does not ship — a deployed pod reads its values from the environment.
#
# production.json is empty on purpose. node-config warns on every start when
# NODE_ENV matches no config file's name, and that warning has no off switch:
# _warnOrThrow writes to stderr unconditionally, and NODE_CONFIG_STRICT_MODE only
# promotes it to fatal. A file whose basename matches is the only way to silence
# a line that would otherwise read like a misconfiguration in every pod's log.
COPY config/custom-environment-variables.json config/production.json ./config/

# Shipped by the base image at uid 1000.
USER node

EXPOSE 8080

# Invoke node directly. `npm start` would fire the "prestart": "npm install" in
# package.json, turning every pod start into a network install.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
