'use strict';

// W3C DID Resolution HTTPS binding content negotiation.
// Maps an HTTP Accept header to one of three response representations.
//
// Returned shape:
//   { representation, contentType }
//   representation: 'didDocumentLd' | 'didDocumentJson' | 'resolutionResult'
//   contentType:    the media type to set on the response
//
// Per the binding, the recognized media types are:
//   application/did+ld+json                                 -> bare DID Document (JSON-LD)
//   application/did+json                                    -> bare DID Document (JSON repr)
//   application/ld+json;profile="https://w3id.org/did-resolution"
//                                                           -> full DID Resolution Result
//
// Absent / */* / unrecognized Accept falls back to the default representation
// (bare DID Document JSON-LD) for Universal Resolver driver robustness.

const DID_RESOLUTION_PROFILE = 'https://w3id.org/did-resolution';

const DEFAULT = {
  representation: 'didDocumentLd',
  contentType: 'application/did+ld+json',
};

// Parse one Accept entry into { type, params, q }. The media range is lowercased
// (type/subtype are case-insensitive); parameter values keep their case.
//
// Assumptions (safe for this driver — the only param we match is the fixed
// did-resolution profile URL, which contains no `;`/`,`/quotes):
//   - parameter values do NOT contain `;` or `,` (we split on those before
//     stripping quotes, so a quoted value carrying a separator would mangle);
//   - q is taken as-is via parseFloat (not range-clamped to RFC 7231's 0–1);
//     a malformed q falls back to 1. Out-of-range q is not expected from real
//     clients and is not defended against here.
function parseEntry(raw) {
  const parts = raw.split(';');
  const type = parts.shift().trim().toLowerCase();
  const params = {};
  let q = 1;
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key === 'q') {
      const parsed = parseFloat(value);
      q = Number.isNaN(parsed) ? 1 : parsed;
    } else {
      params[key] = value;
    }
  }
  return { type, params, q };
}

// Map a single parsed entry to a representation, or null if unrecognized.
function matchEntry(entry) {
  switch (entry.type) {
    case 'application/did+ld+json':
      return {
        representation: 'didDocumentLd',
        contentType: 'application/did+ld+json',
      };
    case 'application/did+json':
      return {
        representation: 'didDocumentJson',
        contentType: 'application/did+json',
      };
    case 'application/ld+json':
      if (entry.params.profile === DID_RESOLUTION_PROFILE) {
        return {
          representation: 'resolutionResult',
          contentType: `application/ld+json;profile="${DID_RESOLUTION_PROFILE}"`,
        };
      }
      // ld+json without the resolution profile -> treat as DID Document JSON-LD.
      return {
        representation: 'didDocumentLd',
        contentType: 'application/did+ld+json',
      };
    default:
      return null;
  }
}

function negotiateRepresentation(acceptHeader) {
  if (!acceptHeader || typeof acceptHeader !== 'string') {
    return DEFAULT;
  }

  const entries = acceptHeader
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseEntry)
    .filter((e) => e.q > 0)
    // Stable sort by descending q; ties keep client order (first wins).
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.q - a.e.q || a.i - b.i)
    .map(({ e }) => e);

  for (const entry of entries) {
    const match = matchEntry(entry);
    if (match) return match;
  }

  // No recognized media type (e.g. only */* or text/html) -> default representation.
  return DEFAULT;
}

// DID Core JSON representation (application/did+json): the same DID Document
// without the JSON-LD-specific `@context` entry. Per DID Core §6.3, the JSON
// representation does not use `@context`.
function toDidDocumentJson(didDocument) {
  const { '@context': _context, ...rest } = didDocument;
  return rest;
}

// Wrap a resolved DID Document into a full W3C DID Resolution Result envelope.
// `didResolutionMetadata.contentType` MUST be the media type of the embedded
// `didDocument`. We embed the JSON-LD form (the document still carries
// `@context`), so it is `application/did+ld+json` — distinct from the outer
// HTTP Content-Type returned to the client (the did-resolution profile media
// type). If the embedded document is ever switched to the JSON representation
// (`@context` stripped), this literal must change to `application/did+json`.
function toResolutionResult(didDocument) {
  return {
    '@context': 'https://w3id.org/did-resolution/v1',
    didDocument,
    didResolutionMetadata: {
      contentType: 'application/did+ld+json',
    },
    didDocumentMetadata: {},
  };
}

module.exports = {
  negotiateRepresentation,
  toDidDocumentJson,
  toResolutionResult,
  DID_RESOLUTION_PROFILE,
};
