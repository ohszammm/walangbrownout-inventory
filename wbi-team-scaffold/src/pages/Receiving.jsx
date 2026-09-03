import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/UI";
import { useItems } from "../state/ItemsContext";

const emptyForm = { sku: "", supplier: "", qty: "", received: "", expiry: "", bin: "" };

export default function Receiving() {
  const navigate = useNavigate();
  const { items, receiveBatch } = useItems();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const selectedItem = items.find((i) => i.sku === form.sku);

  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors({ ...errors, [k]: null });
  };

  const submit = () => {
    const nextErrors = {};
    if (!form.sku) nextErrors.sku = "Select an item.";
    if (!form.supplier) nextErrors.supplier = "Enter a supplier.";
    if (!form.qty || Number(form.qty) < 1) nextErrors.qty = "Enter a quantity of at least 1.";
    if (!form.received) nextErrors.received = "Enter a received date.";
    if (selectedItem?.perishable && !form.expiry) nextErrors.expiry = "Expiry date is required for perishable items.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const result = receiveBatch(form.sku, {
      qty: Number(form.qty),
      receivedDate: form.received,
      expiryDate: form.expiry || null,
      bin: form.bin,
    });

    if (!result.ok) {
      setErrors({ sku: result.error });
      return;
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm(emptyForm);
      navigate(`/items/${form.sku}`);
    }, 700);
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Overview", href: "/" }, { label: "Receive new shipment" }]}
        title="Receive new shipment"
      />

      <div className="form-card">
        <div className="form-row">
          <div className="field">
            <label className="field-label">Item</label>
            <select className="field-select" value={form.sku} onChange={set("sku")}>
              <option value="">Select an item...</option>
              {items.map((i) => (
                <option key={i.sku} value={i.sku}>{i.name} ({i.sku})</option>
              ))}
            </select>
            {errors.sku && <p className="field-error">{errors.sku}</p>}
          </div>
          <div className="field">
            <label className="field-label">Supplier</label>
            <input
              type="text"
              placeholder="CoolAir Distribution Co."
              className="field-input"
              value={form.supplier}
              onChange={set("supplier")}
            />
            {errors.supplier && <p className="field-error">{errors.supplier}</p>}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label className="field-label">Quantity received</label>
            <input type="number" placeholder="24" className="field-input" value={form.qty} onChange={set("qty")} />
            {errors.qty && <p className="field-error">{errors.qty}</p>}
          </div>
          <div className="field">
            <label className="field-label">Received date</label>
            <input type="date" className="field-input" value={form.received} onChange={set("received")} />
            {errors.received && <p className="field-error">{errors.received}</p>}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label className="field-label">
              Expiry date {selectedItem?.perishable ? "(required for this item)" : "(perishable items only)"}
            </label>
            <input
              type="date"
              className="field-input"
              value={form.expiry}
              onChange={set("expiry")}
              disabled={selectedItem ? !selectedItem.perishable : false}
            />
            {errors.expiry && <p className="field-error">{errors.expiry}</p>}
          </div>
          <div className="field">
            <label className="field-label">Bin location</label>
            <input type="text" placeholder="C-03" className="field-input" value={form.bin} onChange={set("bin")} />
          </div>
        </div>

        <button onClick={submit} className="btn btn-primary btn-block">
          {saved ? "Batch saved" : "Save batch"}
        </button>
        <p className="field-hint">Saving creates a new batch and updates on-hand stock immediately.</p>
      </div>
    </div>
  );
}