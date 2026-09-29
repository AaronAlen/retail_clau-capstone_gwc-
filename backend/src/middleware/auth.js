"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jwt_1 = require("../utils/jwt");
const protect = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
    try {
        const token = header.split(" ")[1];
        req.user = (0, jwt_1.verifyAccessToken)(token);
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Not authorized, token invalid or expired" });
    }
};
exports.protect = protect;
//# sourceMappingURL=auth.js.map