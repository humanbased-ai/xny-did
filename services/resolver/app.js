'use strict';

const express = require('express');
const controllers = require('./controllers/Default');

// Express app construction, separated from process concerns (listening, signal
// handling) in index.js so the probe routes can be exercised from tests without
// binding a port at require time.
//
// Returns the app plus a `state` handle. The readiness route reads
// `state.shuttingDown`, which index.js flips on SIGTERM — see the drain sequence
// there for why readiness has to fail before the server stops accepting.
function createApp() {
  const state = { shuttingDown: false };

  const app = express();

  app.use(express.json());

  // Kept in its original position: registered after express.json() but before the
  // routes, so it only ever sees body-parser failures (a malformed JSON body),
  // never an error thrown by a route below. Route errors are handled inside the
  // controller, which writes a DID Resolution Result itself.
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      message: err.message,
      errors: err.errors,
    });
  });

  // Liveness + startup probe. Deliberately makes no upstream call: a restart
  // cannot fix a subgraph outage, so reporting upstream health here would only
  // stack a pod restart loop on top of the outage.
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Readiness probe. On GKE this is what the GCE Ingress derives its load
  // balancer health check from when no BackendConfig is present (how the rest of
  // the xny-staging namespace is set up), so it governs whether this pod stays in
  // the NEG and receives traffic.
  //
  // It reports local serving capability only, for the same reason /health does
  // not probe upstream: a subgraph blip would otherwise fail readiness on every
  // replica at once, pull them all from the load balancer, and turn per-request
  // 500s into a hard outage. Upstream failures belong in the response status of
  // the request that hit them.
  app.get('/ready', (req, res) => {
    if (state.shuttingDown) {
      res.status(503).json({ status: 'shutting down' });
      return;
    }
    res.status(200).json({ status: 'ready' });
  });

  app.get('/1.0/identifiers/:identifier', controllers.resolve);

  return { app, state };
}

module.exports = { createApp };
