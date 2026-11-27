export function dailyShareText(input: {
  gameDate: string;
  score: number;
  correct: number;
  total: number;
  marks: readonly boolean[];
}): string {
  const squares = input.marks.map((correct) => (correct ? "🟩" : "🟥")).join("");
  return [
    `TriviaTrainer Daily ${input.gameDate}`,
    `${input.score} pts · ${input.correct}/${input.total}`,
    squares,
  ].join("\n");
}
