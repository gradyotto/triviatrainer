import type { ArtworkImage } from "@/lib/artwork/reveal";

export type QuestionType = "multiple_choice" | "fill_in";

export type { ArtworkImage };

export type CategorySummary = {
  slug: string;
  name: string;
  questionCount: number;
};

export type PublicQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  categorySlug: string;
  categoryName: string;
  difficulty: string;
  hint: string | null;
  image: ArtworkImage | null;
};

export type GradeResult = {
  correct: boolean;
  answer: string;
  explanation: string | null;
  persisted: boolean;
  image: ArtworkImage | null;
};

export type ReviewItem = {
  prompt: string;
  response: string;
  correct: boolean;
  answer: string;
  explanation: string | null;
  image: ArtworkImage | null;
};
