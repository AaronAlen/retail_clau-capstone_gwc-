import { Router } from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/role";
import { listUsers, createUser, updateUserRole, deleteUser } from "../controllers/user.controller";

const router = Router();
router.use(protect, authorize("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.put("/:id/role", updateUserRole);
router.delete("/:id", deleteUser);

export default router;
