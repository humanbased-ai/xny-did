# xny-did indexer

Subgraph indexing `DIDRegistry` events into the DID Document entities the
resolver queries.

## Multi-network layout

`networks.json` is the source of truth for per-network addresses. `graph build
--network <name>` reads it and **rewrites `subgraph.yaml` in place** — that file's
`network` / `source.address` / `source.startBlock` are build output, not
something to edit by hand (comments placed there are stripped on the next build,
which is why this documentation lives here instead).

One subgraph per network; a deployment cannot span chains.

| Network | npm script | Subgraph name |
| --- | --- | --- |
| Base Sepolia | `npm run deploy:base-sepolia` | `did-base-sepolia` |
| Base mainnet | `npm run deploy:base` | `did-base` |

`npm run build` / `npm run deploy` without a suffix skip the network injection and
use whatever is currently in `subgraph.yaml`.

A network missing from `networks.json` fails the build with
`Network '<name>' was not found in 'networks.json'` rather than silently reusing
the previous network's address — so an unconfigured network cannot be deployed by
accident.

## Adding a network

Copy `registryProxy` and its deployment block out of
`contracts/script/deployment.<network>.json` into `networks.json`:

```json
{
  "base": {
    "DIDRegistry": { "address": "0x...", "startBlock": 12345678 }
  }
}
```

The address must be the **proxy**, not the implementation — events are emitted
from the proxy. `startBlock` should be the block the proxy was deployed in;
starting earlier only wastes indexing time, starting later silently misses
registrations.

## Local development

`generated/` is not committed, so a fresh checkout needs codegen before anything
compiles:

```shell
npm install
npm run codegen
npm run build:base-sepolia
npm test
```
