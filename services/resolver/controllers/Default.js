'use strict';

var utils = require('../utils/writer.js');

module.exports.resolve = function resolve (req, res) {
    const identifier = req.params['identifier'];
    const accept = req.get('accept');
    global.Resolver.resolve(identifier, accept)
        .then(function (response) {
            utils.writeJson(res, response);
        })
        .catch(function (response) {
            utils.writeJson(res, response);
        });
};