const router = require("express").Router();
const pgConfig = require("../../config/pgconfig");
const auth = require("../auth");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const secret = require("../../config").secret;
const splitToken = require("../../utils/helperFuncs").splitToken;

const saltRounds = 10;

const pool = new Pool(pgConfig);

router.get("/", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { username } = req.body;
        const response = await client.query("SELECT username FROM main.users WHERE username = $1", [
            username,
        ]);
        if (response.rows.length !== 0) {
            return res.status(200).json({ error: "Username already taken." });
        } else {
            return res.status(200).json({ message: "Username available." });
        }
    } catch (err) {
        console.error("Issue while querying usernames: ", err.stack);
        next(err);
    } finally {
        client.release();
    }

    // const { username } = req.body;
    // pool.connect()
    //     .then((client) => {
    //         client
    //             .query("SELECT username FROM main.users WHERE username = $1", [username])
    //             .then((response) => {
    //                 client.release();
    //                 if (response.rows.length !== 0) {
    //                     return res.status(200).json({ error: "Username already taken." });
    //                 } else {
    //                     return res.status(200).json({ message: "Username available." });
    //                 }
    //             })
    //             .catch((err) => {
    //                 console.error("Error while trying to verify password: ", err.stack);
    //                 throw new Error(err);
    //             });
    //     })
    //     .catch(next);
});

router.post("/login", async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { username, password } = req.body;
        if (!username) return res.status(422).json({ error: "Username can't be blank." });
        if (!password) return res.status(422).json({ error: "Password can't be blank." });
        const response = await client.query(
            "SELECT username, hash, user_id FROM main.users WHERE username = $1",
            [username]
        );
        if (response.rows.length === 0) {
            client.release();
            return res.status(401).json({
                error: "User does not exist. Please register for an account to log in.",
            });
        }
        const user = response.rows[0];
        const match = await bcrypt.compare(password, user.hash);
        if (match) {
            // Change before finalzing app
            const token = jwt.sign({ user_id: user.user_id }, secret, {
                expiresIn: "7d",
            });
            const [fragmentOne, fragmentTwo] = splitToken(token);
            res.cookie("fragmentOne", fragmentOne, {
                expires: new Date(Date.now() + 1800000), // expires after 30 minutes
                // secure: true,
                // UNCOMMENT BEFORE FINISHING
            });
            res.cookie("fragmentTwo", fragmentTwo, {
                httpOnly: true,
                // secure: true,
                // UNCOMMENT BEFORE FINISHING
            });
            return res.status(200).json({ message: "User successfully logged in." });
        } else {
            return res.status(401).json({
                error: "Password did not match. Please try again.",
            });
        }
    } catch (err) {
        console.error("Error while trying to verify password: ", err.stack);
        next(err);
    } finally {
        client.release();
    }

    // pool.connect().then((client) => {
    //     client
    //         .query("SELECT username, hash, user_id FROM main.users WHERE username = $1", [username])
    //         .then((response) => {
    //             if (response.rows.length === 0) {
    //                 client.release();
    //                 return res.status(401).json({
    //                     error: "User does not exist. Please register for an account to log in.",
    //                 });
    //             }

    //             const user = response.rows[0];

    //             bcrypt
    //                 .compare(password, user.hash)
    //                 .then((match) => {
    //                     client.release();
    //                     if (match) {
    //                         // Change before finalzing app
    //                         const token = jwt.sign({ user_id: user.user_id }, secret, {
    //                             expiresIn: "7d",
    //                         });
    //                         const [fragmentOne, fragmentTwo] = splitToken(token);
    //                         res.cookie("fragmentOne", fragmentOne, {
    //                             expires: new Date(Date.now() + 1800000), // expires after 30 minutes
    //                             // secure: true,
    //                             // UNCOMMENT BEFORE FINISHING
    //                         });
    //                         res.cookie("fragmentTwo", fragmentTwo, {
    //                             httpOnly: true,
    //                             // secure: true,
    //                             // UNCOMMENT BEFORE FINISHING
    //                         });
    //                         return res
    //                             .status(200)
    //                             .json({ message: "User successfully logged in." });
    //                     } else {
    //                         return res.status(401).json({
    //                             error: "Password did not match. Please try again.",
    //                         });
    //                     }
    //                 })
    //                 .catch((err) => {
    //                     console.error("Error while trying to verify password: ", err.stack);
    //                     throw new Error(err);
    //                 });
    //         })
    //         .catch(next);
    // });
});

router.post("/register", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { username, password } = req.body;
        if (!username) return res.status(422).json({ error: "Username can't be blank." });
        if (!password) return res.status(422).json({ error: "Password can't be blank." });
        const response = await client.query(
            "SELECT username, hash FROM main.users WHERE username = $1",
            [username]
        );
        if (response.rows.length !== 0) {
            client.release();
            return res.status(422).json({
                error: "Username is already in use. Please pick another one.",
            });
        }
        const userID = shortid.generate();
        const hash = await bcrypt.hash(password, saltRounds);
        await client.query("INSERT INTO main.users VALUES ($1,$2,$3)", [username, hash, userID]);
        // Change before finalzing app
        const token = jwt.sign({ user_id: userID }, secret, {
            expiresIn: "7d",
        });
        const [fragmentOne, fragmentTwo] = splitToken(token);
        res.cookie("fragmentOne", fragmentOne, {
            expires: new Date(Date.now() + 1800000),
            // secure: true,
            // UNCOMMENT BEFORE FINISHING
        });
        res.cookie("fragmentTwo", fragmentTwo, {
            httpOnly: true,
            // secure: true,
            // UNCOMMENT BEFORE FINISHING
        });
        return res.status(200).json({ message: "User successfully registered." });
    } catch (err) {
        console.error("Error while trying to insert new user: ", err.stack);
        next(err);
    } finally {
        client.release();
    }

    // pool.connect().then((client) => {
    //     client
    //         .query("SELECT username, hash FROM main.users WHERE username = $1", [username])
    //         .then((response) => {
    //             console.log("Response from register");
    //             console.log(response.rows);

    //             if (response.rows.length !== 0) {
    //                 client.release();
    //                 return res.status(422).json({
    //                     error: "Username is already in use. Please pick another one.",
    //                 });
    //             }

    //             let userID = shortid.generate();

    //             bcrypt.hash(password, saltRounds).then((hash) => {
    //                 client
    //                     .query("INSERT INTO main.users VALUES ($1,$2,$3)", [username, hash, userID])
    //                     .then(() => console.log("Added user to database"))
    //                     .then(() => {
    //                         // Change before finalzing app
    //                         const token = jwt.sign({ user_id: userID }, secret, {
    //                             expiresIn: "7d",
    //                         });

    //                         const [fragmentOne, fragmentTwo] = splitToken(token);

    //                         res.cookie("fragmentOne", fragmentOne, {
    //                             expires: new Date(Date.now() + 1800000),
    //                             // secure: true,
    //                             // UNCOMMENT BEFORE FINISHING
    //                         });
    //                         res.cookie("fragmentTwo", fragmentTwo, {
    //                             httpOnly: true,
    //                             // secure: true,
    //                             // UNCOMMENT BEFORE FINISHING
    //                         });

    //                         return res
    //                             .status(200)
    //                             .json({ message: "User successfully registered." });
    //                     })
    //                     .catch((err) => {
    //                         console.error("Error while trying to insert new user: ", err.stack);
    //                         throw new Error(err);
    //                     });
    //             });
    //             client.release();
    //         })
    //         .catch(next);
    // });
});

router.put("/username", auth.required, (req, res, next) => {
    const { newUsername, password } = req.body;

    if (!newUsername) return res.status(422).json({ error: "Username can't be blank." });
    if (!password) return res.status(422).json({ error: "Password can't be blank." });

    pool.connect().then((client) => {
        client.query("");
    });

    res.send("changed username");
});

router.put("/password", auth.required, (req, res, next) => {
    res.send("changed password");
});

module.exports = router;
