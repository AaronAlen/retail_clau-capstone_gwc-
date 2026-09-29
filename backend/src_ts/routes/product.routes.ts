import { Router } from "express";
import { protect } from "../middleware/auth";
import { authorize } from "../middleware/role";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  recordSale,
} from "../controllers/product.controller";

const router = Router();

router.use(protect);
router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", authorize("admin", "manager"), createProduct);
router.put("/:id", authorize("admin", "manager"), updateProduct);
router.delete("/:id", authorize("admin"), deleteProduct);
router.post("/:id/sale", authorize("admin", "manager", "staff"), recordSale);

export default router;
