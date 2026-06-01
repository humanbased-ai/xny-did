'use strict';

var utils = require('../utils/writer.js');

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
      utils.writeJson(res, body, status);
    });
};
