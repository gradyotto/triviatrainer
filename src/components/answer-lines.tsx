export function AnswerLines({
  response,
  answer,
  responseLabel = "Your answer",
  answerLabel = "Answer",
}: {
  response: string;
  answer: string;
  responseLabel?: string;
  answerLabel?: string;
}) {
  return (
    <>
      <p className="text-sm">
        {responseLabel}: <span className="font-medium">{response}</span>
      </p>
      <p className="text-sm">
        {answerLabel}: <span className="font-medium">{answer}</span>
      </p>
    </>
  );
}
