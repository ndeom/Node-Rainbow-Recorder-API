const jwt = require("express-jwt");
const secret = require("../config").secret;

function getTokenFromCookies(req) {
    if (req.cookies && Object.keys(req.cookies).length >= 2) {
        console.log(`cookies: ${req.cookies}`);
        const fullToken = req.cookies.fragmentOne + "." + req.cookies.fragmentTwo;
        console.log("fullToken: ", fullToken);
        return fullToken;
    }
    return null;
}

const auth = {
    required: jwt({
        secret: secret,
        userProperty: "payload",
        getToken: getTokenFromCookies,
        algorithms: ["HS256"],
    }),
    optional: jwt({
        secret: secret,
        userProperty: "payload",
        credentialsRequired: false,
        getToken: getTokenFromCookies,
        algorithms: ["HS256"],
    }),
};

module.exports = auth;
