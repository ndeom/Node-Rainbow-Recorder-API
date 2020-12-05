const S3 = require("aws-sdk/clients/s3");
const awsConfig = require("../config/awsconfig");
const s3 = new S3(awsConfig);

const splitToken = (token) => {
    if (!token) throw Error("Token is undefined");
    let split = token.split(".");
    let fragmentOne = split.slice(0, 2).join(".");
    let fragmentTwo = split[2];
    return [fragmentOne, fragmentTwo];
};

const createUserToken = (userObj) => {};

const getImgBuffer = (base64Img) => {
    const base64Str = base64Img.replace(/^data:image\/\w+;base64,/, "");
    return Buffer.from(base64Str, "base64");
};

const getImgUrl = async (userID, timestamp, base64Img) => {
    const buffer = getImgBuffer(base64Img);
    return uploadImage(`${userID}/${timestamp}.jpeg`, buffer);
};

const getPoint = (location) => {
    return `POINT(${location.lng} ${location.lat})`;
};

const uploadImage = (path, buffer) => {
    const params = {
        ACL: "public-read",
        Key: path,
        Bucket: process.env.AWS_ARN_2,
        Body: buffer,
        ContentEncoding: "base64",
        ContentType: "image/jpeg",
    };
    return new Promise((resolve, reject) => {
        s3.upload(params, (s3Err, data) => {
            console.log("data: ", data);
            if (s3Err) {
                reject(s3Err);
            } else {
                console.log(`Image uploaded successfully at ${data.Location}`);
                // Returns a modified URL where the photo can be accessed
                const applicationAccessibleUrl = data.Location.replace(
                    /photoupload2\-\d+\.s3\-accesspoint/,
                    "post-photos.s3"
                );
                console.log("applicationAccessibleUrl: ", applicationAccessibleUrl);
                resolve(applicationAccessibleUrl);
            }
        });
    });
};

module.exports = {
    splitToken: splitToken,
    createUserToken: createUserToken,
    getImgBuffer: getImgBuffer,
    getImgUrl: getImgUrl,
    getPoint: getPoint,
    uploadImage: uploadImage,
};
