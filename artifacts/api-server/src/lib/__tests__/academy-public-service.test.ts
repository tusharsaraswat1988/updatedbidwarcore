import { describe, expect, it } from "vitest";
import { deriveCategoriesFromLessons } from "../academy-lesson-helpers.js";

describe("deriveCategoriesFromLessons", () => {
  it("returns empty list when no lessons have categories", () => {
    expect(
      deriveCategoriesFromLessons([
        { categoryId: null, categoryName: null, categorySlug: null, displayOrder: 0 },
      ]),
    ).toEqual([]);
  });

  it("includes only categories that appear on published lessons", () => {
    expect(
      deriveCategoriesFromLessons([
        { categoryId: null, categoryName: null, categorySlug: null, displayOrder: 0 },
        {
          categoryId: 1,
          categoryName: "Setup",
          categorySlug: "setup",
          displayOrder: 0,
        },
      ]),
    ).toEqual([
      {
        id: 1,
        name: "Setup",
        slug: "setup",
        displayOrder: 0,
        lessonCount: 1,
      },
    ]);
  });

  it("aggregates lesson counts and uses lowest displayOrder per category", () => {
    const categories = deriveCategoriesFromLessons([
      {
        categoryId: 2,
        categoryName: "Getting Started",
        categorySlug: "getting-started",
        displayOrder: 5,
      },
      {
        categoryId: 2,
        categoryName: "Getting Started",
        categorySlug: "getting-started",
        displayOrder: 2,
      },
      {
        categoryId: 3,
        categoryName: "Auction Day",
        categorySlug: "auction-day",
        displayOrder: 1,
      },
    ]);

    expect(categories).toEqual([
      {
        id: 3,
        name: "Auction Day",
        slug: "auction-day",
        displayOrder: 1,
        lessonCount: 1,
      },
      {
        id: 2,
        name: "Getting Started",
        slug: "getting-started",
        displayOrder: 2,
        lessonCount: 2,
      },
    ]);
  });

  it("ignores lessons missing category metadata", () => {
    expect(
      deriveCategoriesFromLessons([
        { categoryId: 1, categoryName: "Solo", categorySlug: null, displayOrder: 0 },
      ]),
    ).toEqual([]);
  });
});
