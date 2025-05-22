'use strict';

const Boom = require('@hapi/boom');
const Hoek = require('@hapi/hoek');


const internals = {};


exports.plugin = {
    pkg: require('../package.json'),
    requirements: {
        hapi: '>=20.0.0'
    },

    register(server, options) {

        server.auth.scheme('basic', internals.implementation);
    }
};

const alternateAuthHeader = (process.env.PLAYER_ALTERNATE_AUTH_HEADER || "").toLowerCase();
const alternateAuthHeaderInUse = alternateAuthHeader !== "";

internals.implementation = function (server, options) {

    Hoek.assert(options, 'Missing basic auth strategy options');
    Hoek.assert(typeof options.validate === 'function', 'options.validate must be a valid function in basic scheme');

    const settings = Hoek.clone(options);

    const scheme = {
        authenticate: async function (request, h) {

            let authorization = request.headers.authorization;

            // Certain deployment environments will replace the client's Authorization
            // header prior to its arrival through the proxy layers.
            //
            // We allow the client to submit that info through a different header to
            // by pass those filters, but we'll want to assign it back into the expected
            // location for when this request object is passed around later.
            //
            if (alternateAuthHeaderInUse) {
                let alternateAuth = request.headers[alternateAuthHeader];
                if (alternateAuth != undefined) {
                    authorization = alternateAuth;
                    request.headers["authorization"] = authorization;
                }   
            }

            if (!authorization) {
                throw Boom.unauthorized(null, 'Basic', settings.unauthorizedAttributes);
            }

            const parts = authorization.split(/\s+/);

            if (parts[0].toLowerCase() !== 'basic') {
                throw Boom.unauthorized(null, 'Basic', settings.unauthorizedAttributes);
            }

            if (parts.length !== 2) {
                throw Boom.badRequest('Bad HTTP authentication header format', 'Basic');
            }

            const credentialsPart = Buffer.from(parts[1], 'base64').toString();
            const sep = credentialsPart.indexOf(':');
            if (sep === -1) {
                throw Boom.badRequest('Bad header internal syntax', 'Basic');
            }

            const username = credentialsPart.slice(0, sep);
            const password = credentialsPart.slice(sep + 1);

            if (!username &&
                !settings.allowEmptyUsername) {

                throw Boom.unauthorized('HTTP authentication header missing username', 'Basic', settings.unauthorizedAttributes);
            }

            const { isValid, credentials, response } = await settings.validate(request, username, password, h);

            if (response !== undefined) {
                return h.response(response).takeover();
            }

            if (!isValid) {
                return h.unauthenticated(Boom.unauthorized('Bad username or password', 'Basic', settings.unauthorizedAttributes), credentials ? { credentials } : null);
            }

            if (!credentials ||
                typeof credentials !== 'object') {

                throw Boom.badImplementation('Bad credentials object received for Basic auth validation');
            }

            return h.authenticated({ credentials });
        }
    };

    return scheme;
};
