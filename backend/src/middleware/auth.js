"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protect = void 0;
const jwt_1 = require("../utils/jwt");
const protect = (req, res, next) => {
    const cookieToken = req.cookies?.accessToken || req.cookies?.token;
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ") ? header.split(" ")[1] : null;
    const token = cookieToken || bearerToken;
    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token provided in cookie or header" });
    }
    try {
        req.user = (0, jwt_1.verifyAccessToken)(token);
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Not authorized, token invalid or expired" });
    }
};
exports.protect = protect;
//# sourceMappingURL=auth.js.map