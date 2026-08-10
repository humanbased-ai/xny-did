'use strict';

// Carries the HTTP status + DID Resolution error code so the controller can map it.
class ResolveError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ResolveError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { ResolveError };
