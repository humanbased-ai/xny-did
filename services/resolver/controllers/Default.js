'use strict';

var utils = require('../utils/writer.js');
var {
  negotiateRepresentation,
  toDidDocumentJson,
  toResolutionResult,
} = require('../service/contentNegotiation.js');

// Universal Resolver driver mode:
//   success -> bare W3C DID Document by default; honors the Accept header per the
//              W3C DID Resolution HTTPS binding (did+ld+json / did+json / full
//              DID Resolution Result via the did-resolution profile).
//   error   -> DID Resolution Result carrying didResolutionMetadata.error
module.exports.resolve = function resolve(req, res) {
  const identifier = req.params['identifier'];
  const { representation, contentType } = negotiateRepresentation(
    req.headers ? req.headers['accept'] : undefined
  );
  return global.Resolver.resolve(identifier)
    .then(function (didDocument) {
      let body;
      if (representation === 'resolutionResult') {
        body = toResolutionResult(didDocument);
      } else if (representation === 'didDocumentJson') {
        body = toDidDocumentJson(didDocument);
      } else {
        body = didDocument;
      }
      utils.writeJson(res, body, 200, contentType);
    })
    .catch(function (error) {
      // ResolveError carries .status (404/400/500) and .code (notFound/...).
      const status = error.status || 500;
      const body = {
        didDocument: null,
        didResolutionMetadata: {
          error: error.code || 'internalError',
          message: error.message,
        },
        didDocumentMetadata: {},
      };
      // Error body is a Resolution Result / plain error, not a DID Document.
      utils.writeJson(res, body, status, 'application/json');
    });
};
