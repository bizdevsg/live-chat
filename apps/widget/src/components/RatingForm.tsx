import { useState } from "react";
import { Star } from "lucide-react";

export function RatingForm({ onSubmit, widgetColor }: { onSubmit: (score: number, comment?: string) => void; widgetColor: string }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return <div className="mx-auto max-w-[85%] rounded-2xl bg-zinc-800 px-4 py-3 text-center text-sm text-zinc-200">Terima kasih atas penilaian Anda!</div>;
  }

  return (
    <div className="mx-auto max-w-[90%] rounded-2xl bg-zinc-800 p-4">
      <p className="mb-2 text-center text-sm text-zinc-200">Bagaimana pengalaman Anda dengan layanan kami?</p>
      <div className="mb-3 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= score;
          return (
            <button
              key={n}
              aria-label={`${n} bintang`}
              onClick={() => setScore(n)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              {/* fill follows the site's widget colour when selected; unselected stays a hollow outline */}
              <Star
                className="h-6 w-6"
                style={{ color: active ? widgetColor : "#52525b" }}
                fill={active ? widgetColor : "none"}
              />
            </button>
          );
        })}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Komentar (opsional)"
        rows={2}
        className="mb-2 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white placeholder:text-zinc-500"
      />
      <button
        disabled={score === 0}
        onClick={() => {
          onSubmit(score, comment || undefined);
          setSubmitted(true);
        }}
        className="w-full rounded-lg py-1.5 text-sm font-medium text-ink disabled:opacity-40"
        style={{ backgroundColor: widgetColor }}
      >
        Kirim Penilaian
      </button>
    </div>
  );
}
