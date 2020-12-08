const { Pool } = require("pg");
const pgConfig = require("../config/pgconfig");
const fs = require("fs");
const shortid = require("shortid");
const { writeFile } = require("../utils/helperFuncs");

const pool = new Pool(pgConfig);

let file = fs.readFileSync("../sample_posts/posts.json");
let postJSON = JSON.parse(file);

console.log("json: ", postJSON);

(async () => {
    try {
        const client = await pool.connect();

        // Get number of current posts
        const numberPostQuery = `
            SELECT *
            FROM main.posts
        `;

        const response = await client.query(numberPostQuery);
        const numberPosts = response.rows.length;

        // If number of current posts less than 5
        // add a post
        if (numberPosts < 3) {
            const addPostQuery = `
                INSERT INTO
                main.posts (post_id, username, likes, timestamp, location, image, caption, user_id)
                VALUES ($1, $2, 0, $3, $4, $5, $6, $7)
            `;
            const postID = shortid.generate();
            const { username, userID, location, imageUrl, caption } = postJSON.posts[
                postJSON.postIndex
            ];
            const timestamp = new Date(Date.now());

            // Add post
            await client.query(addPostQuery, [
                postID,
                username,
                timestamp,
                location,
                imageUrl,
                caption,
                userID,
            ]);

            // Adjust the post index and resave file
            postJSON.postIndex = (postJSON.postIndex + 1) % 3;
            await writeFile(JSON.stringify(postJSON));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
