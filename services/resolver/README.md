# Xny DID Resolver

This is Xny DID resolver, which compatible with [Universal Resolver](https://github.com/decentralized-identity/universal-resolver/) driver.

## Specifications

*   [Decentralized Identifiers](https://w3c.github.io/did-core/)
*   [Decentralized Identifiers (DIDs) v1.0](https://w3c.github.io/did-core/)

## Example DIDs

The identifier for a `did:xny` DID is a 128-bit unsigned integer (`uint128`) rendered as `8-4-4-4-12` hex (a display convention, not an RFC 4122 UUID); the `did:xny:` prefix is case-sensitive.

```
did:xny:95228308-9d75-4dd8-8958-2713b92d3d71
```

## Backends

Resolution reads from one of two backends, selected by `RESOLVER_BACKEND`. Both produce
the same DID Document for the same DID, provided the subgraph indexes the same registry
contract on the same chain that the rpc backend is pointed at — the checked-in
`services/indexer/subgraph.yaml` targets Base Sepolia, so a local subgraph built from it
and the Base mainnet rpc defaults would disagree simply by reading two different chains.

| `RESOLVER_BACKEND` | Reads | Needs a secret |
| ------------------ | ----- | -------------- |
| `rpc` (default)    | `DIDRegistry.getDidDocument` over a public Base mainnet RPC endpoint | no |
| `subgraph`         | the indexed subgraph on The Graph | yes, `RESOLVER_GRAPH_ACCESS_TOKEN` |

The image defaults to `rpc` and starts with no environment variables set, which is what
running as a Universal Resolver driver requires: DIF builds and runs the container on
their own infrastructure from a public `.env`. The subgraph backend is faster and is what
the self-hosted instances use.

| Variable | Backend | Default |
| -------- | ------- | ------- |
| `RESOLVER_BACKEND` | both | `rpc` |
| `RESOLVER_RPC_URL` | rpc | `https://mainnet.base.org` |
| `RESOLVER_REGISTRY_ADDRESS` | rpc | `0xf73eD23b998b3987503F4F4Ba4eAb85386ebfCC4` (Base mainnet registry proxy) |
| `RESOLVER_CHAIN_ID` | rpc | `8453` |
| `RESOLVER_GRAPH_URL` | subgraph | none, required |
| `RESOLVER_GRAPH_ACCESS_TOKEN` | subgraph | none, required |
| `RESOLVER_TIMEOUT_MS` | both | `10000` |

One difference between the backends is not reconcilable: after a controller has been
revoked, the entries of `controller` past the first may come back in a different order.
The registry stores controllers in an `EnumerableSet`, whose removal swaps the last
element into the freed slot, while the subgraph preserves insertion order. The set is the
same either way, and DID Core treats `controller` as a set, but a consumer that hashes or
diffs the serialized document should not assume a stable order.

Base mainnet is the authoritative deployment for `did:xny` resolution
(`docs/xny-did-method.md`), so the rpc defaults point at it. Pointing the resolver at a
testnet deployment means overriding `RESOLVER_RPC_URL`, `RESOLVER_REGISTRY_ADDRESS` and
`RESOLVER_CHAIN_ID` together.

## Content Negotiation

The resolver honors the `Accept` request header per the
[W3C DID Resolution](https://w3c.github.io/did-resolution/) HTTPS binding:

| `Accept`                                                          | Response                                  | `Content-Type`                                                  |
| ----------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `application/did+ld+json` (default / absent / `*/*` / unrecognized) | bare DID Document (JSON-LD)               | `application/did+ld+json`                                       |
| `application/did+json`                                            | bare DID Document                         | `application/did+json`                                          |
| `application/ld+json;profile="https://w3id.org/did-resolution"`   | full DID Resolution Result envelope       | `application/ld+json;profile="https://w3id.org/did-resolution"` |

An `Accept` value that matches none of the above falls back to the default
representation (`application/did+ld+json`) rather than returning `406`, for
Universal Resolver driver robustness.

```
curl -H 'Accept: application/ld+json;profile="https://w3id.org/did-resolution"' \
  http://localhost:8080/1.0/identifiers/did:xny:95228308-9d75-4dd8-8958-2713b92d3d71
```

## Build and Run (Docker)

```
docker build -f ./docker/Dockerfile . -t xny/did-resolver
docker run -p 8080:8080 xny/did-resolver
curl -X GET http://localhost:8080/1.0/identifiers/did:xny:95228308-9d75-4dd8-8958-2713b92d3d71
```

## Build and Run (NodeJS)

```
npm start
```

## Public image

Released images are published to `ghcr.io/humanbased-ai/xny-did-resolver`, tagged with
the version and never with `latest` — the DIF driver docs require a Universal Resolver
entry to pin a version. Both `linux/amd64` and `linux/arm64` are built.

```
docker run -p 8080:8080 ghcr.io/humanbased-ai/xny-did-resolver:1.0.0
curl http://localhost:8080/1.0/identifiers/did:xny:e44c542d-ae34-ff1a-ccad-6202fa680ebd
```

No environment is needed: the image defaults to the rpc backend, which reads Base
mainnet over a public endpoint.

This is a different image from the one the cluster runs. `deploy-resolver.yml` pushes
to a private Artifact Registry on every merge to roll staging; the public image is cut
per release.

### Cutting a release

1. Bump `version` in `services/resolver/package.json` and merge it
2. Tag that commit `resolver-v<version>` and push the tag

`publish-resolver-image.yml` runs the test suite, then builds and publishes. It refuses
a tag that is not on main, and one whose version disagrees with `package.json`.

The `resolver-v` prefix is load-bearing: the repo's plain `v1.0.0` / `v1.0.1` / `v1.0.2`
tags version the method specification in `docs/xny-did-method.md`, and the W3C DID method
registry links into one of them.

> **First release only.** A GHCR package is private by default even under a public
> repository. After the first publish, set the package to public in its settings —
> until then an anonymous `docker pull` fails with a 404, which reads like a missing
> image rather than a permissions problem.
