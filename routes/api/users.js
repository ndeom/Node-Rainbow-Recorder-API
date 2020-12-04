const router = require("express").Router();
const pgConfig = require("../../config/pgconfig");
const auth = require("../auth");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const secret = require("../../config").secret;
const { splitToken, getImgUrl } = require("../../utils/helperFuncs");

const saltRounds = 10;

const pool = new Pool(pgConfig);

router.get("/", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { username } = req.query;
        const query = "SELECT username FROM main.users WHERE username = $1";
        const response = await client.query(query, [username]);
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
});

router.post("/login", async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { username, password } = req.body;
        if (!username) return res.status(422).json({ error: "Username can't be blank." });
        if (!password) return res.status(422).json({ error: "Password can't be blank." });
        const query =
            "SELECT username, hash, user_id, profile_picture, screen_name FROM main.users WHERE username = $1";
        const response = await client.query(query, [username]);
        if (response.rows.length === 0) {
            client.release();
            return res.status(401).json({
                error: "User does not exist. Please register for an account to log in.",
            });
        }
        const user = response.rows[0];
        const match = await bcrypt.compare(password, user.hash);
        if (match) {
            console.log("user: ", user);
            // Change before finalzing app
            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    username: user.username,
                    profilePicture: user.profile_picture,
                    screenName: user.screen_name,
                },
                secret,
                {
                    expiresIn: "7d",
                }
            );
            const [fragmentOne, fragmentTwo] = splitToken(token);
            res.cookie("fragmentOne", fragmentOne, {
                expires: new Date(Date.now() + 86400000), // expires after 1 day
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
});

router.post("/register", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { username, password } = req.body;
        if (!username) return res.status(422).json({ error: "Username can't be blank." });
        if (!password) return res.status(422).json({ error: "Password can't be blank." });
        const query = "SELECT username, hash FROM main.users WHERE username = $1";
        const response = await client.query(query, [username]);
        if (response.rows.length !== 0) {
            return res.status(422).json({
                error: "Username is already in use. Please pick another one.",
            });
        }
        const userID = shortid.generate();
        const hash = await bcrypt.hash(password, saltRounds);
        await client.query("INSERT INTO main.users VALUES ($1,$2,$3)", [username, hash, userID]);
        // Change before finalzing app
        const token = jwt.sign(
            {
                user_id: userID,
                username: username,
                profilePicture: null,
                screenName: null,
            },
            secret,
            {
                expiresIn: "7d",
            }
        );
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
});

router.post("/refresh", async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { userID, username } = req.body;
        if (!userID) return res.status(422).json({ error: "Cannot refresh without UserID." });
        if (!username) return res.status(422).json({ error: "Cannot refresh without username." });
        const query =
            "SELECT username, hash, user_id, profile_picture, screen_name FROM main.users WHERE username = $1 AND user_id = $2";
        const response = await client.query(query, [username, userID]);
        if (response.rows.length === 0) {
            return res.status(422).json({
                error: "There was an error while locating user profile.",
            });
        }
        const user = response.rows[0];
        const token = jwt.sign(
            {
                user_id: user.user_id,
                username: user.username,
                profilePicture: user.profile_picture,
                screenName: user.screen_name,
            },
            secret,
            {
                expiresIn: "7d",
            }
        );
        const [fragmentOne, fragmentTwo] = splitToken(token);
        res.cookie("fragmentOne", fragmentOne, {
            expires: new Date(Date.now() + 86400000), // expires after 1 day
            // secure: true,
            // UNCOMMENT BEFORE FINISHING
        });
        res.cookie("fragmentTwo", fragmentTwo, {
            httpOnly: true,
            // secure: true,
            // UNCOMMENT BEFORE FINISHING
        });
        return res.status(200).json({ message: "User successfully logged in." });
    } catch (err) {
        console.error("Error while trying to refresh token", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/username", auth.required, async (req, res, next) => {
    console.log("in username route");
    const client = await pool.connect();
    try {
        const { userID, newUsername } = req.body;
        if (!userID) return res.status(422).json({ error: "User ID can't be blank." });
        if (!newUsername) return res.status(422).json({ error: "New username can't be blank." });
        const query = `
            UPDATE main.users
            SET username = $1
            WHERE user_id = $2
        `;
        await client.query(query, [newUsername, userID]);
        return res.status(200).json({ message: "Username sucessfully updated" });
    } catch (err) {
        console.error("Error while changing username: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/screenname", auth.required, async (req, res, next) => {
    console.log("inside screenname route");
    const client = await pool.connect();
    try {
        const { userID, screenName } = req.body;
        if (!userID) return res.status(422).json({ error: "User ID can't be blank." });
        if (!screenName) return res.status(422).json({ error: "Screen name cannot be blank." });
        const query = `
            UPDATE main.users
            SET screen_name = $1
            WHERE user_id = $2
        `;
        await client.query(query, [screenName, userID]);
        return res.status(200).json({ message: "Screen name successfully updated" });
    } catch (err) {
        console.error("Error while changing screen name: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/password", auth.required, async (req, res, next) => {
    console.log("in password route");
    const client = await pool.connect();
    try {
        const { userID, oldPassword, newPassword } = req.body;
        if (!userID) return res.status(422).json({ error: "User ID can't be blank." });
        if (!oldPassword) return res.status(422).json({ error: "Old password can't be blank." });
        if (!newPassword) return res.status(422).json({ error: "New password can't be blank." });
        const oldHash = await bcrypt.hash(oldPassword, saltRounds);
        const oldQuery = `
            SELECT user_id, hash
            FROM main.users
            WHERE user_id = $1 AND hash = $2
        `;
        const response = await client.query(oldQuery, [userID, oldHash]);
        if (response.rows.length === 0) {
            return res.status(200).json({
                error: "Password did not match existing record.",
            });
        }
        const newHash = await bcrypt.hash(newPassword, saltRounds);
        const newQuery = `
            UPDATE main.users
            SET hash = $1
            WHERE user_id = $2
        `;
        await client.query(newQuery, [newHash, userID]);
        return res.status(200).json({ message: "Password successfully changed." });
    } catch (err) {
        console.error("Error while changing password: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.post("/profilepicture", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { userID, timestamp, blob } = req.body;
        if (!userID) return res.status(422).json({ error: "User ID can't be blank." });
        if (!blob) return res.status(422).json({ error: "Must submit image." });
        console.log("blob: ", blob);
        const imageUrl = await getImgUrl(userID, timestamp, blob);
        console.log("profile img Url: ", imageUrl);
        const query = `
            UPDATE main.users
            SET profile_picture = $1
            WHERE user_id = $2
        `;
        await client.query(query, [imageUrl, userID]);
        return res.status(200).json({ message: "User profile picture successfully changed." });
    } catch (err) {
        console.error("Error while trying to upload user profile picture: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

module.exports = router;
