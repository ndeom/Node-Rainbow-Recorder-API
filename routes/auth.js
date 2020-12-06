const jwt = require("express-jwt");
const secret = require("../config").secret;

// function getTokenFromCookies(req) {
//     if (req.cookies && Object.keys(req.cookies).length >= 2) {
//         const fullToken = req.cookies.fragmentOne + "." + req.cookies.fragmentTwo;
//         return fullToken;
//     }
//     return null;
// }

function getTokenFromHeader(req) {
    if (req.headers.authorization) {
        const token = req.headers.authorization.split(" ")[1];
        console.log("token: ", token);
        return token;
    }
    return null;
}

const auth = {
    required: jwt({
        secret: secret,
        userProperty: "payload",
        getToken: getTokenFromHeader,
        algorithms: ["HS256"],
    }),
    optional: jwt({
        secret: secret,
        userProperty: "payload",
        credentialsRequired: false,
        getToken: getTokenFromHeader,
        algorithms: ["HS256"],
    }),
};

module.exports = auth;
