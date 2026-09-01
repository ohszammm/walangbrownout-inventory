import { useParams } from "react-router-dom";

// TODO (Desiree): Build the real Item Detail page here - on hand/reserved/
// available KPIs, reorder policy card (evenly-spaced, centered columns),
// batches sorted by expiry with a working Pick action (see
// useItems().pickBatch), transaction log. See handoff notes.
export default function ItemDetail() {
  const { sku } = useParams();
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>TODO: Item Detail page for {sku} (Desiree)</h1>
    </div>
  );
}
