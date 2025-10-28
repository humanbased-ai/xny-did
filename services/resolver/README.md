# Codatta DID Resolver

This is Codatta DID resolver, which compatible with [Universal Resolver](https://github.com/decentralized-identity/universal-resolver/) driver.

## Specifications

* [Decentralized Identifiers](https://w3c.github.io/did-core/)

## Example DIDs

```
did:codatta:123456789
```

## Build and Run (Docker)

```
docker build -f ./docker/Dockerfile . -t codatta/did-resolver
docker run -p 8080:8080 codatta/did-resolver
curl -X GET http://localhost:8080/1.0/identifiers/did:codatta:123456789
```

## Build and Run (NodeJS)

```
npm start
```
