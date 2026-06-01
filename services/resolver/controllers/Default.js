'use strict';

var utils = require('../utils/writer.js');

// Universal Resolver driver mode:
//   success -> bare W3C DID Document (the Universal Resolver layer wraps it into a
//              full DID Resolution Result)
//   error   -> DID Resolution Result carrying didResolutionMetadata.error
module.exports.resolve = function resolve(req, res) {
  const identifier = req.params['identifier'];
  global.Resolver.resolve(identifier)
    .then(function (didDocument) {
      utils.writeJson(res, didDocument, 200);
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
