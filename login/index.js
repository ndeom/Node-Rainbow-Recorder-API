const router = require("express").Require();
const bycrypt = require("bcrypt");

const saltRounds = 10;

router.get("/login", (req, res, next) => {
    res.send("logging in");
});

router.post("/register", (req, res, next) => {
    res.send("registering user");
});

router.put("/username", (req, res, next) => {
    res.send("changed username");
});

router.put("/password", (req, res, next) => {
    res.send("changed password");
});

module.exports = router;
