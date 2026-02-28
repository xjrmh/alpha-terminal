export function SkeletonLoader() {
  const widths = ["100%", "92%", "85%", "96%", "78%", "88%", "70%", "94%", "82%", "60%"];

  return (
    <div className="flex flex-col gap-3 py-2">
      {widths.map((width, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{ width, animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}
