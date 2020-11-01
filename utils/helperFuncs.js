const splitToken = (token) => {
    let split = token.split(".");
    let fragmentOne = split.slice(0, 2).join(".");
    let fragmentTwo = split[2];
    return [fragmentOne, fragmentTwo];
};

module.exports.splitToken = splitToken;
