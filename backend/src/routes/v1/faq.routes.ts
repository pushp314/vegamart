import { Router } from "express";
import prisma from "../../database/prisma";
import { authenticate } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/rbac.middleware";
import { ROLES } from "../../constants/roles";

const router = Router();

// Get active FAQs (Public)
router.get("/", async (_req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      where: { is_active: true },
      orderBy: { created_at: "asc" },
    });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin routes (Protected by Admin/Super Admin authentication)
router.get("/admin", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: { created_at: "asc" },
    });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res) => {
  const { question, answer, is_active } = req.body;
  try {
    const faq = await prisma.faq.create({
      data: { question, answer, is_active: is_active ?? true },
    });
    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/:id", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res) => {
  const { id } = req.params;
  const { question, answer, is_active } = req.body;
  try {
    const faq = await prisma.faq.update({
      where: { id },
      data: { question, answer, is_active },
    });
    res.json({ success: true, data: faq });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/:id", authenticate, requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.faq.delete({
      where: { id },
    });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export { router as faqRoutes };
