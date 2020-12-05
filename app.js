require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const errorHandler = require("errorhandler");
const cors = require("cors");

const isProduction = process.env.NODE_ENV === "production";

const app = express();
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(cors({ credentials: true, origin: "https://rainbowrecorder.netlify.app" }));
// app.use(cors({ credentials: true, origin: "http://localhost:3000" }));

app.use(require("./routes"));

if (!isProduction) {
    app.use(errorHandler());
}

app.use((err, req, res, next) => {
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
});

if (!isProduction) {
    app.use((err, req, res, next) => {
        console.log(err.stack);
        res.status(err.status || 500);
        res.json({
            errors: {
                message: err.message,
                error: err,
            },
        });
    });
}

app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({
        errors: {
            message: err.message,
            error: {},
        },
    });
});

app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}`);
});
