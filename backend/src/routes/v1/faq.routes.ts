import { Router } from "express";
import prisma from "../../database/prisma";

const router = Router();

// Get active FAQs
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

// Admin routes (would be protected in a real app, assuming admin auth middleware exists elsewhere, 
// or these can just be here for now if admin panel calls them directly)
router.get("/admin", async (_req, res) => {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: { created_at: "asc" },
    });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", async (req, res) => {
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

router.put("/:id", async (req, res) => {
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

router.delete("/:id", async (req, res) => {
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
