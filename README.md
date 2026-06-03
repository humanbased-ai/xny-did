# xny-did

Monorepo for the **did:xny** decentralized identity method.

## Structure

- **`contracts/`** — Solidity implementation of the did:xny method (DID registry, registrar) plus Python ops scripts. Built with [Foundry](https://getfoundry.sh/).
- **`services/`**
  - **`indexer/`** — [The Graph](https://thegraph.com/) subgraph indexing on-chain DID events (TypeScript).
  - **`resolver/`** — [Universal Resolver](https://github.com/decentralized-identity/universal-resolver/) driver: resolves `did:xny:<uuid>` to a DID Document by querying the subgraph (Node.js).
- **`docs/`** — did:xny method specification and design docs.

## did:xny

Identifier format: `did:xny:<uuid-v4>` — a UUID v4, stored on-chain as `uint128`.

See [`docs/`](./docs/) for the full method specification.
