var ResponsePayload = function (code, payload) {
  this.code = code;
  this.payload = payload;
};

exports.respondWithCode = function (code, payload) {
  return new ResponsePayload(code, payload);
};

var writeJson = (exports.writeJson = function (response, arg1, arg2, contentType) {
  var code;
  var payload;

  if (arg1 && arg1.payload && arg1.code) {
    writeJson(response, arg1.payload, arg1.code);
    return;
  }

  if (arg2) {
    payload = arg1;
    code = arg2;
  } else if (arg1) {
    if (Number.isInteger(arg1)) {
      code = arg1;
    } else {
      payload = arg1;
    }
  }

  if (payload instanceof Error) {
    payload = {
      error: code,
      message: payload.message,
    };
  }

  if (!code) {
    // if no response code given, we default to 200
    code = 200;
  }
  if (typeof payload === 'object') {
    payload = JSON.stringify(payload, null, 2);
  }
  // W3C DID Resolution HTTPS binding: default to the DID Document JSON-LD media type.
  response.writeHead(code, {
    'Content-Type': contentType || 'application/did+ld+json',
  });
  response.end(payload);
});
