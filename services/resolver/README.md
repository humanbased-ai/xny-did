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
