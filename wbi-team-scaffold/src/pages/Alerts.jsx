import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, severityStyle } from "../components/UI";
import { useItems } from "../state/ItemsContext";
import { deriveAlerts } from "../utils/deriveAlerts";

export default function Alerts() {
  const navigate = useNavigate();
  const { items, resolveVariance } = useItems();
  const allAlerts = deriveAlerts(items);
  const [acknowledged, setAcknowledged] = useState(new Set());
  const [recount, setRecount] = useState({});
  const [feedback, setFeedback] = useState({});

  const visible = allAlerts.filter((a) => !acknowledged.has(a.id));

  const acknowledge = (id, e) => {
    e.stopPropagation();
    setAcknowledged((prev) => new Set(prev).add(id));
  };

  const submitResolve = (alert, e) => {
    e.stopPropagation();
    const raw = recount[alert.id];
    const qty = raw === undefined || raw === "" ? NaN : parseInt(raw, 10);
    const result = resolveVariance(alert.sku, alert.batch, qty);

    if (!result.ok) {
      setFeedback({ ...feedback, [alert.id]: { ok: false, msg: result.error } });
      return;
    }
    // On success the alert disappears on its own next render, since
    // deriveAlerts recomputes from the now-corrected item state.
    setFeedback({ ...feedback, [alert.id]: null });
  };

  return (
    <div>
      <PageHeader
        title="Alerts"
        sub="Reorder, overstock, expiry, and count-variance notifications, computed live from stock data."
      />

      <Card
        title="All alerts"
        right={<span className="pill pill-category">{visible.length} open</span>}
      >
        {visible.length === 0 ? (
          <div className="empty-state">
            {allAlerts.length === 0
              ? "No conditions currently require attention."
              : "All alerts have been acknowledged this session."}
          </div>
        ) : (
          <div>
            {visible.map((a) => {
              const s = severityStyle[a.severity];
              const isVariance = a.type === "variance";
              const fb = feedback[a.id];

              return (
                <div
                  key={a.id}
                  className={`alert-item ${s.cls}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/items/${a.sku}`)}
                >
                  <span className={`alert-severity-tag ${s.tagCls}`}>{s.label}</span>
                  <div className="alert-body">
                    <p className="alert-title">{a.title}</p>
                    <p className="alert-message">{a.message}</p>
                    <p className="alert-sku">{a.sku}</p>
                    {fb && !fb.ok && <p className="mini-feedback-error" style={{ marginTop: 6 }}>{fb.msg}</p>}
                  </div>

                  {isVariance ? (
                    <div className="recount-form" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        className="mini-input"
                        placeholder={String(a.countedQty)}
                        value={recount[a.id] ?? a.countedQty}
                        onChange={(e) => setRecount({ ...recount, [a.id]: e.target.value })}
                      />
                      <button className="mini-btn" onClick={(e) => submitResolve(a, e)}>
                        Resolve, save recount
                      </button>
                    </div>
                  ) : (
                    <div className="alert-actions">
                      <button className="btn btn-secondary btn-sm" onClick={(e) => acknowledge(a.id, e)}>
                        Acknowledge
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}