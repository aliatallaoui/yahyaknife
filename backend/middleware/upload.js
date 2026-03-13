const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'products');

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        cb(null, name);
    }
});

const fileFilter = (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|webp|gif)$/i;
    if (allowed.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
    }
};

const uploadProductImages = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 8 } // 10MB per file, max 8
});

module.exports = { uploadProductImages };
