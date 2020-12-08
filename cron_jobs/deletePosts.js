const { Pool } = require("pg");
const pgConfig = require("../config/pgconfig");
const { deleteImages } = require("../utils/helperFuncs");

const pool = new Pool(pgConfig);

(async () => {
    try {
        const client = await pool.connect();

        // Timestamp representing time 6hrs ago
        const sixHoursAgo = new Date(Date.now() - 21600000);

        // Query to get image url's to be deleted from S3 bucket
        const imageQuery = `
            SELECT image
            FROM main.posts
            WHERE timestamp < $1
        `;

        // Retrieve image url's in form [{ image: ... }, ...]
        const response = await client.query(imageQuery, [sixHoursAgo]);
        const images = response.rows;

        await deleteImages(images);

        // Deletes all posts from the post table that were
        // posted greater than 6 hours ago. Rows from referencing
        // tables are also deleted when a post is removed via
        // cascading delete.
        const query = `
            DELETE FROM main.posts
            WHERE timestamp < $1
        `;

        // Delete
        await client.query(query, [sixHoursAgo]);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
})();
