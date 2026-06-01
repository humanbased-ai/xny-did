# Codatta DID Resolver

This is Codatta DID resolver, which compatible with [Universal Resolver](https://github.com/decentralized-identity/universal-resolver/) driver.

## Specifications

*   [Decentralized Identifiers](https://w3c.github.io/did-core/)
*   [Decentralized Identifiers (DIDs) v1.0](https://w3c.github.io/did-core/)

## Example DIDs

The identifier for a `did:codatta` DID must be a UUID-formatted identifier (a `uint128` rendered as 8-4-4-4-12 hex; the `did:codatta:` prefix is case-sensitive).

```
did:codatta:95228308-9d75-4dd8-8958-2713b92d3d71
```

## Build and Run (Docker)

```
docker build -f ./docker/Dockerfile . -t codatta/did-resolver
docker run -p 8080:8080 codatta/did-resolver
curl -X GET http://localhost:8080/1.0/identifiers/did:codatta:95228308-9d75-4dd8-8958-2713b92d3d71
```

## Build and Run (NodeJS)

```
npm start
```
