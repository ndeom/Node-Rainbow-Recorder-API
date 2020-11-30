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
// const splitToken = require("../../utils/helperFuncs").splitToken;
const { getImgUrl, getPoint } = require("../../utils/helperFuncs");
const awsConfig = require("../../config/awsconfig");

const pool = new Pool(pgConfig);
const s3 = new S3(awsConfig);

router.get("/", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { n, s, w, e } = req.query;
        const query = `
            SELECT 
                post_id, 
                username,  
                timestamp, 
                ST_AsGeoJSON(location) as location_point, 
                image, 
                caption, 
                user_id,
                (
					SELECT json_agg(
						json_build_object(
							'username', username,
							'comment', comment,
							'comment_id', comment_id,
                            'post_id', post_id,
                            'timestamp', timestamp
						)
					)
					FROM main.comments
					WHERE main.comments.post_id = main.posts.post_id
				) as comments,
				(
					SELECT json_build_object(user_id, post_id)
					FROM main.likes
                    WHERE main.likes.post_id = main.posts.post_id
				) as likes
            FROM main.posts
            WHERE ST_Covers(
                ST_MakeEnvelope($1, $2, $3, $4, 4326),
                main.posts.location
            )
        `;
        const response = await client.query(query, [w, s, e, n]);
        const posts = response.rows;
        console.log("response.rows: ", response.rows);
        return res.status(200).json({ message: "Posts successfully retrieved", posts: posts });
    } catch (err) {
        console.error("Error while fetching posts: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.get("/singlepost", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { postID } = req.query;
        const query = `
            SELECT 
                post_id, 
                username,  
                timestamp, 
                ST_AsGeoJSON(location) as location_point, 
                image, 
                caption, 
                user_id,
                (
					SELECT json_agg(
						json_build_object(
							'username', username,
							'comment', comment,
							'comment_id', comment_id,
                            'post_id', post_id,
                            'timestamp', timestamp
						)
					)
					FROM main.comments
					WHERE main.comments.post_id = main.posts.post_id
				) as comments,
				(
					SELECT json_build_object(user_id, post_id)
					FROM main.likes
                    WHERE main.likes.post_id = main.posts.post_id
				) as likes
            FROM main.posts
            WHERE post_id = $1
        `;
        const response = await client.query(query, [postID]);
        const post = response.rows[0];
        console.log("response.rows: ", response.rows);
        return res.status(200).json({ message: "Posts successfully retrieved", post: post });
    } catch (err) {
        console.error("Error while fetching posts: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.post("/", auth.required, async (req, res, next) => {
    const client = await pool.connect();

    try {
        const { username, userID, timestamp, location, image, caption } = req.body;
        const imageUrl = await getImgUrl(userID, timestamp, image);
        // const imageUrl = await uploadImage(`${userID}/${timestamp}.jpeg`, image);
        console.log("imageUrl: ", imageUrl);
        const point = getPoint(location);
        console.log("image URL: ", imageUrl);
        const postID = shortid.generate();
        const query = `
            INSERT INTO
            main.posts (post_id, username, likes, timestamp, location, image, caption, user_id)
            VALUES ($1, $2, 0, $3, $4, $5, $6, $7)
        `;
        await client.query(query, [postID, username, timestamp, point, imageUrl, caption, userID]);
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

router.put("/like", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { userID, postID } = req.body;
        const query = `
            INSERT INTO main.likes (user_id, post_id)
            VALUES ($1, $2)
        `;
        await client.query(query, [userID, postID]);
        res.status(200).json({ message: "Post liked successfully." });
    } catch (err) {
        console.error("Error ocurred while trying to like post: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/unlike", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { userID, postID } = req.body;
        const query = `
            DELETE FROM main.likes
            WHERE user_id = $1 AND post_id = $2
        `;
        await client.query(query, [userID, postID]);
        res.status(200).json({ message: "Post unliked successfully." });
    } catch (err) {
        console.error("Error ocurred while unliking post: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/comment", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { postID, username, comment, timestamp } = req.body;
        console.log("timestamp: ", timestamp);
        const commentID = shortid.generate();
        const query = `
            INSERT INTO main.comments (post_id, username, comment, comment_id, timestamp)
            VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(query, [postID, username, comment, commentID, timestamp]);
        res.status(200).json({ message: "Comment added successfully." });
    } catch (err) {
        console.error("Error while trying to add comment: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

router.put("/uncomment", auth.required, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { commentID } = req.body;
        const query = `
            DELETE FROM main.comments
            WHERE comment_id = commentID
        `;
        await client.query(query, [commentID]);
        res.status(200).json({ message: "Comment removed successfully." });
    } catch (err) {
        console.error("Error while removing comment: ", err.stack);
        next(err);
    } finally {
        client.release();
    }
});

module.exports = router;
