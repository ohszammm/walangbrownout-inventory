import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, { hour12: false });

  return (
    <div className="live-clock">
      <span className="live-clock-dot" />
      <span className="live-clock-label">Live system clock</span>
      <span className="live-clock-value">{dateStr}, {timeStr}</span>
    </div>
  );
}
