import katex from "katex";
export function MathBlock({ equation }: { equation: string }) {
  return (
    <div
      className="math-block"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(equation, {
          throwOnError: false,
          displayMode: true,
          output: "htmlAndMathml",
          trust: false,
        }),
      }}
    />
  );
}
