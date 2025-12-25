# Codatta DID Resolver

This is Codatta DID resolver, which compatible with [Universal Resolver](https://github.com/decentralized-identity/universal-resolver/) driver.

## Specifications

*   [Decentralized Identifiers](https://w3c.github.io/did-core/)
*   [Decentralized Identifiers (DIDs) v1.0](https://w3c.github.io/did-core/)
*   [API Documentation](./docs/openapi.md)

## Example DIDs

The identifier for a `did:codatta` DID must be a valid UUID.

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
