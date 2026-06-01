'use strict';

const http = require('http');
const express = require('express');
const controllers = require('./controllers/Default');
const ResolverInstance = require('./service/resolver');

const serverPort = 8080;

global.Resolver = ResolverInstance;

const app = express();

app.use(express.json());

app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
    });
});

app.get('/1.0/identifiers/:identifier', controllers.resolve);

http.createServer(app).listen(serverPort, function () {
    console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
});
