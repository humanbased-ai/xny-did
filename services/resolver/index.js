'use strict';

const http = require('http');
const { createApp } = require('./app');
const ResolverInstance = require('./service/resolver');

// Read straight from process.env rather than through the `config` package: these
// two have defaults that suit every deployment, and config/default.json is
// gitignored, so routing them through config.get() would force each environment
// to supply a value or crash on boot. The Graph settings are the opposite case
// and stay in config — see service/resolver.js.
const serverPort = Number(process.env.RESOLVER_PORT) || 8080;

// How long to keep serving after SIGTERM before closing the server. The load
// balancer needs a few failed readiness checks to pull this pod out of the NEG;
// closing immediately would cut requests it is still routing here. Stays well
// inside the default terminationGracePeriodSeconds of 30.
const drainMs = Number(process.env.RESOLVER_DRAIN_MS) || 5000;

global.Resolver = ResolverInstance;

const { app, state } = createApp();

const server = http.createServer(app);

server.listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
});

// Without a handler node ignores SIGTERM outright and dies at the SIGKILL that
// follows the grace period, truncating whatever was in flight on every rolling
// update.
//
// Order matters: fail readiness first so the load balancer stops sending new
// requests, keep serving for drainMs so the ones already dispatched can finish,
// and only then close. close() stops accepting while letting open requests
// complete, and on node >= 19 it drops idle keep-alive sockets itself, so the
// load balancer's parked health-check connections do not hold it open (hence the
// engines floor in package.json: on node 18 close() waits on those forever and
// the pod only dies at SIGKILL).
//
// There is deliberately no forced-exit backstop, because every request is bounded
// by the upstream timeout. That holds only while
//
//     RESOLVER_DRAIN_MS + RESOLVER_TIMEOUT_MS < terminationGracePeriodSeconds
//
// which the defaults (5s + 10s against 30s) satisfy with room to spare. Raise
// either one past that budget and a request in flight gets killed mid-response
// instead of drained — add the backstop then rather than widening the window.
function shutdown(signal) {
    if (state.shuttingDown) {
        return;
    }
    state.shuttingDown = true;
    console.log('%s received; failing readiness, draining %dms', signal, drainMs);

    setTimeout(() => {
        server.close(() => {
            console.log('server closed');
            process.exit(0);
        });
    }, drainMs);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
