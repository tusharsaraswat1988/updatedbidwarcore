import { Router } from "express";
import {
  fetchAcademyIndexPageData,
  fetchAcademyLessonPageData,
  listPublishedAcademyCategories,
  listPublishedAcademyLessons,
} from "../lib/academy-public-service.js";

const router = Router();

router.get("/academy/lessons", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const lessons = await listPublishedAcademyLessons(search, category);
  res.json(lessons);
});

router.get("/academy/categories", async (_req, res) => {
  const categories = await listPublishedAcademyCategories();
  res.json(categories);
});

router.get("/academy/lessons/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  const data = await fetchAcademyLessonPageData(slug);
  if (!data) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }
  res.json(data.lesson);
});

router.get("/academy", async (_req, res) => {
  const data = await fetchAcademyIndexPageData();
  res.json(data);
});

export default router;
