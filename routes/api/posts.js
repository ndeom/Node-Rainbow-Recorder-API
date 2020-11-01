const router = require("express").Router();
const auth = require("../auth");
const pg = require("pg");
const pgConfig = require("../../config/pgconfig");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const S3 = require("aws-sdk/clients/s3");
const secret = require("../../config").secret;
const splitToken = require("../../utils/helperFuncs").splitToken;
const awsConfig = require("../../config/awsconfig");

const pool = new Pool(pgConfig);
const s3 = new S3(awsConfig);

router.get("/", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { n, s, w, e } = req.query;
        const query = `SELECT *
         FROM main.posts
         WHERE ST_Contains(
             ST_Transform(
                 ST_MakeEnvelope($1,$2,$3,$4,4326),
                 3857
             ),
             main.posts.location
         );`;
        const response = await client.query(query, [w, s, e, n]);
        const posts = response.rows[0];
        console.log("posts: ", posts);
        return res.status(200).json({ message: "Posts successfully retrieved", posts: posts });
    } catch (err) {
        console.error("Error while fetching posts: ", err.stack);
        next(err);
    } finally {
        client.release();
    }

    // const { n, s, w, e } = req.query;
    // console.log("req.query: ", req.query);
    // pool.connect().then((client) => {
    //     // Query looks for posts with locations where:
    //     const query = `SELECT *
    //      FROM main.posts
    //      WHERE ST_Contains(
    //          ST_Transform(
    //              ST_MakeEnvelope($1,$2,$3,$4,4326),
    //              3857
    //          ),
    //          main.posts.location
    //      );`;

    //     client.query(query, [w, s, e, n]).then((response) => {
    //         client.release();
    //         const posts = reponse.rows[0];
    //         console.log("posts: ", posts);
    //     });
    // });
});

router.post("/", auth.required, async (req, res, next) => {
    const client = await pool.connect();

    // const uploadImage = async (image) => {
    //     const params = {
    //         Bucket: process.env.ACCESS_POINT_HOSTNAME, // may be AWS_ARN instead
    //         Body: JSON.stringify(image), // need to BASE64 encode image for storage
    //     };
    //     s3.upload(params, (s3Err, data) => {
    //         if (s3Err) throw s3Err;
    //         console.log(`Image uploaded successfully at ${data.Location}`);
    //         return data.Location;
    //     });
    // };

    try {
        const { username, timestamp, location, imageUrl } = req.body;
        // const imageUrl = await uploadImage(image);
        const postID = shortid.generate();
        const query = `INSERT INTO 
        main.posts (post_id, username, likes, timestamp, location, image) 
        VALUES ($1, $2, 0, $3, $4, $5`;
        await client.query(query, [postID, username, timestamp, location, imageUrl]);
        return res.status(200).json({ message: "Post successfully uploaded." });
    } catch (err) {
        console.error("Error while trying to upload new post: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.post("/image", auth.required, async (req, res, next) => {
    const uploadImage = async (image) => {
        const params = {
            Bucket: process.env.ACCESS_POINT_HOSTNAME, // may be AWS_ARN instead
            Body: JSON.stringify(image), // need to BASE64 encode image for storage
        };
        s3.upload(params, (s3Err, data) => {
            if (s3Err) throw s3Err;
            console.log(`Image uploaded successfully at ${data.Location}`);
            return data.Location;
        });
    };

    try {
        const { image } = req.body;
        const imageUrl = await uploadImage(image);
        return res.status(200).json({ message: "Image sucessfully uploaded", imageUrl: imageUrl });
    } catch (err) {
        console.error("Error ocurred while uploading image");
        next(err);
    }
});

router.put("/like", auth.required, (req, res, next) => {
    res.send("you just liked a post");
});

router.put("/unlike", auth.required, (req, res, next) => {
    res.send("you just unliked a post");
});

router.put("/comment", auth.required, (req, res, next) => {
    res.send("you just added a comment to an existing post");
});

router.put("/uncomment", auth.required, (req, res, next) => {
    res.send("you just deleted a comment to an existing post");
});

module.exports = router;
