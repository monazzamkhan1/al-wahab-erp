"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function PurchasesPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);

  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState([]);

  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductMatches, setShowProductMatches] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [mrp, setMrp] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, []);

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, company_type")
      .in("company_type", ["supplier", "both"])
      .eq("is_active", true)
      .order("name");

    if (error) {
      setMessage("Suppliers load nahi ho sake: " + error.message);
      return;
    }

    setSuppliers(data || []);
  }

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_code, product_name, pack_size, mrp, purchase_rate")
      .eq("is_active", true)
      .order("product_name");

    if (error) {
      setMessage("Products load nahi ho sake: " + error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadBatches(productIdValue) {
    if (!productIdValue) {
      setBatches([]);
      return;
    }

    const { data, error } = await supabase
      .from("product_batches")
      .select(
        "id, batch_no, manufacturing_date, expiry_date, purchase_rate, sale_rate, quantity"
      )
      .eq("product_id", productIdValue)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Batches load nahi ho sake: " + error.message);
      return [];
    }

    setBatches(data || []);
    return data || [];
  }

  async function handleProductChange(value, product = null) {
    setProductId(value);
    setBatchId("");
    setBatchNo("");
    setManufacturingDate("");
    setExpiryDate("");
    setPurchaseRate("");
    setMrp(product?.mrp ?? "");
    if (product?.purchase_rate !== null && product?.purchase_rate !== undefined) setPurchaseRate(product.purchase_rate);
    const loadedBatches = await loadBatches(value);
    const latestBatch = loadedBatches[0];
    if (latestBatch) {
      setBatchId(latestBatch.id);
      setBatchNo(latestBatch.batch_no || "");
      setManufacturingDate(latestBatch.manufacturing_date || "");
      setExpiryDate(latestBatch.expiry_date || "");
      if (latestBatch.purchase_rate !== null && latestBatch.purchase_rate !== undefined) setPurchaseRate(latestBatch.purchase_rate);
    }
  }

  function productLabel(product) {
    return `${product.product_name}${product.pack_size ? ` (${product.pack_size})` : ""}${
      product.product_code ? ` — ${product.product_code}` : ""
    }`;
  }

  function clearProductSelection() {
    setProductId("");
    setBatchId("");
    setBatchNo("");
    setManufacturingDate("");
    setExpiryDate("");
    setPurchaseRate("");
    setMrp("");
    setBatches([]);
  }

  function handleProductSearchChange(value) {
    setProductSearch(value);
    setShowProductMatches(true);

    if (!productId || value !== productLabel(products.find((p) => p.id === productId) || {})) {
      clearProductSelection();
    }
  }

  function selectProduct(product) {
    setProductSearch(productLabel(product));
    setShowProductMatches(false);
    handleProductChange(product.id, product);
  }

  const matchingProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();

    if (!search) {
      return products.slice(0, 20);
    }

    return products
      .filter((product) =>
        [product.product_name, product.product_code, product.pack_size]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
      .slice(0, 20);
  }, [products, productSearch]);

  function handleBatchChange(value) {
    setBatchId(value);

    const selectedBatch = batches.find((batch) => batch.id === value);

    if (!selectedBatch) {
      return;
    }

    setBatchNo(selectedBatch.batch_no || "");
    setManufacturingDate(selectedBatch.manufacturing_date || "");
    setExpiryDate(selectedBatch.expiry_date || "");

    if (selectedBatch.purchase_rate !== null) {
      setPurchaseRate(selectedBatch.purchase_rate);
    }
  }

  function calculateLineAmount() {
    const qty = Number(quantity || 0);
    const rate = Number(purchaseRate || 0);
    const disc = Number(discount || 0);
    const taxAmount = Number(tax || 0);

    const gross = qty * rate;
    const net = gross - disc + taxAmount;

    return Math.max(net, 0);
  }

  function addItem() {
    if (!productId) {
      setMessage("Product select karein.");
      return;
    }

    if (!batchNo.trim()) {
      setMessage("Batch No. enter karein.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setMessage("Quantity enter karein.");
      return;
    }

    if (purchaseRate === "" || Number(purchaseRate) < 0) {
      setMessage("Purchase rate enter karein.");
      return;
    }

    const product = products.find((p) => p.id === productId);

    const qty = Number(quantity);
    const rate = Number(purchaseRate);
    const disc = Number(discount || 0);
    const taxAmount = Number(tax || 0);

    const gross = qty * rate;
    const amount = Math.max(gross - disc + taxAmount, 0);

    const newItem = {
      tempId: crypto.randomUUID(),
      product_id: productId,
      product_name: product?.product_name || "",
      product_code: product?.product_code || "",
      pack_size: product?.pack_size || "",
      batch_id: batchId || null,
      batch_no: batchNo.trim(),
      manufacturing_date: manufacturingDate || null,
      expiry_date: expiryDate || null,
      quantity: qty,
      purchase_rate: rate,
      mrp: Number(mrp || 0),
      discount: disc,
      tax: taxAmount,
      amount,
    };

    setItems((prev) => [...prev, newItem]);

    setProductId("");
    setProductSearch("");
    setShowProductMatches(false);
    setBatchId("");
    setBatchNo("");
    setManufacturingDate("");
    setExpiryDate("");
    setQuantity("");
    setPurchaseRate("");
    setMrp("");
    setDiscount("");
    setTax("");
    setBatches([]);
    setMessage("");
  }

  function removeItem(tempId) {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  }

  const grandTotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const paid = Number(paidAmount || 0);
  const balance = Math.max(grandTotal - paid, 0);

  function generateInternalPurchaseNo() {
    const datePart = (invoiceDate || new Date().toISOString().slice(0, 10))
      .replaceAll("-", "");
    const uniquePart = `${Date.now().toString().slice(-6)}${Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(3, "0")}`;

    return `PUR-${datePart}-${uniquePart}`;
  }

  async function savePurchase() {
  setMessage("");

  if (!supplierId) {
    setMessage("Supplier select karein.");
    return;
  }

  if (items.length === 0) {
    setMessage("Kam az kam 1 product add karein.");
    return;
  }

  if (paid < 0 || paid > grandTotal) {
    setMessage("Paid Amount total se zyada nahi ho sakta.");
    return;
  }

  setSaving(true);

  try {
    const purchaseInvoiceNo = invoiceNo.trim() || generateInternalPurchaseNo();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User login nahi hai.");
    }

    const purchaseItems = items.map((item) => ({
      product_id: item.product_id,
      batch_id: item.batch_id || null,
      batch_no: item.batch_no,
      manufacturing_date: item.manufacturing_date || null,
      expiry_date: item.expiry_date || null,
      quantity: item.quantity,
      purchase_rate: item.purchase_rate,
      discount: item.discount,
      tax: item.tax,
      amount: item.amount,
    }));

    const { data: purchaseId, error } = await supabase.rpc(
      "save_purchase_with_stock",
      {
        p_supplier_id: supplierId,
        p_invoice_no: purchaseInvoiceNo,
        p_invoice_date: invoiceDate,
        p_total_amount: grandTotal,
        p_paid_amount: paid,
        p_notes: notes || null,
        p_created_by: user.id,
        p_items: purchaseItems,
      }
    );

    if (error) {
      throw error;
    }

    const latestDefaults = new Map();
    items.forEach((item) => latestDefaults.set(item.product_id, { mrp: item.mrp, purchase_rate: item.purchase_rate }));
    const productUpdates = await Promise.all([...latestDefaults.entries()].map(([id, defaults]) => supabase.from("products").update(defaults).eq("id", id)));
    const productUpdateError = productUpdates.find((result) => result.error)?.error;
    if (productUpdateError) throw productUpdateError;

    setMessage(
      "Purchase successfully saved aur Stock IN update ho gaya. Purchase ID: " +
        purchaseId +
        (invoiceNo.trim()
          ? ""
          : ` | Internal No.: ${purchaseInvoiceNo}`)
    );

    setSupplierId("");
    setSupplierSearch("");
    setInvoiceNo("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setPaidAmount("");
    setNotes("");
    setItems([]);
  } catch (error) {
    console.error(error);
    setMessage("Purchase save nahi ho saki: " + error.message);
  } finally {
    setSaving(false);
  }
}

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Purchase Management</h1>
            <p style={styles.subtitle}>
              Supplier purchases, products, batches and payable amounts
              manage karein.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}><a href="/purchases/invoices" style={styles.backButton}>Purchase Invoices</a><a href="/" style={styles.backButton}>← Dashboard</a></div>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Purchase Invoice</h2>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Supplier *
              <input
                list="purchase-suppliers"
                value={supplierSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setSupplierSearch(value);
                  const selected = suppliers.find((supplier) => supplier.name.toLowerCase() === value.trim().toLowerCase());
                  setSupplierId(selected?.id || "");
                }}
                placeholder="Type supplier name, then select from list"
                style={styles.input}
              />
              <datalist id="purchase-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
            </label>

            <label style={styles.label}>
              Supplier Invoice No. (Optional)
              <input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="Blank chhor dein to internal number ban jayega"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Invoice Date
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Paid Amount
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.label}>
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Purchase notes"
              style={styles.textarea}
            />
          </label>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Add Product</h2>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Product *
              <div style={styles.productPicker}>
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => handleProductSearchChange(e.target.value)}
                  onFocus={() => setShowProductMatches(true)}
                  onBlur={() => setShowProductMatches(false)}
                  placeholder="Type product name, pack or code"
                  style={styles.input}
                  autoComplete="off"
                />

                {showProductMatches && (
                  <div style={styles.productMenu}>
                    {matchingProducts.length > 0 ? (
                      matchingProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectProduct(product)}
                          style={styles.productOption}
                        >
                          <strong>{product.product_name}</strong>
                          <small>
                            {product.pack_size ? `${product.pack_size} · ` : ""}
                            {product.product_code || "No code"}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div style={styles.noProductMatch}>No matching product found.</div>
                    )}
                  </div>
                )}
              </div>
            </label>

            <label style={styles.label}>
              Existing Batch
              <select
                value={batchId}
                onChange={(e) => handleBatchChange(e.target.value)}
                style={styles.input}
                disabled={!productId}
              >
                <option value="">New Batch / Select Existing</option>

                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no}
                    {batch.expiry_date
                      ? ` - Exp: ${batch.expiry_date}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Batch No. *
              <input
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="Batch number"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Manufacturing Date
              <input
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Expiry Date
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Quantity *
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Purchase Rate *
              <input
                type="number"
                value={purchaseRate}
                onChange={(e) => setPurchaseRate(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              MRP
              <input
                type="number"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                placeholder="Auto from product - editable"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Discount
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Tax
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                placeholder="0"
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.lineTotal}>
            <span>Current Line Amount:</span>
            <strong>Rs. {calculateLineAmount().toLocaleString()}</strong>
          </div>

          <button
            type="button"
            onClick={addItem}
            style={styles.addButton}
          >
            + Add Product
          </button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>Purchase Items</h2>

          {items.length === 0 ? (
            <div style={styles.empty}>
              Abhi koi product add nahi kiya gaya.
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Batch</th>
                    <th style={styles.th}>Expiry</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Rate</th>
                    <th style={styles.th}>Discount</th>
                    <th style={styles.th}>Tax</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.tempId}>
                      <td style={styles.td}>
                        <strong>{item.product_name}</strong>
                        <br />
                        <small>{item.product_code || "-"}</small>
                      </td>

                      <td style={styles.td}>{item.batch_no}</td>

                      <td style={styles.td}>
                        {item.expiry_date || "-"}
                      </td>

                      <td style={styles.td}>{item.quantity}</td>

                      <td style={styles.td}>
                        Rs.{" "}
                        {Number(item.purchase_rate).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        Rs. {Number(item.discount).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        Rs. {Number(item.tax).toLocaleString()}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          Rs. {Number(item.amount).toLocaleString()}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() => removeItem(item.tempId)}
                          style={styles.deleteButton}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={styles.totalCard}>
          <div style={styles.totalRow}>
            <span>Grand Total</span>
            <strong>Rs. {grandTotal.toLocaleString()}</strong>
          </div>

          <div style={styles.totalRow}>
            <span>Paid Amount</span>
            <strong>Rs. {paid.toLocaleString()}</strong>
          </div>

          <div style={styles.balanceRow}>
            <span>Supplier Payable</span>
            <strong>Rs. {balance.toLocaleString()}</strong>
          </div>

          <button
            type="button"
            onClick={savePurchase}
            disabled={saving}
            style={styles.saveButton}
          >
            {saving ? "Saving Purchase..." : "Save Purchase"}
          </button>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "30px 16px",
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#172033",
  },

  container: {
    maxWidth: "1250px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  title: {
    margin: "0 0 6px",
    fontSize: "30px",
  },

  subtitle: {
    margin: 0,
    color: "#667085",
  },

  backButton: {
    display: "inline-block",
    background: "#e8edf5",
    color: "#344054",
    textDecoration: "none",
    padding: "10px 15px",
    borderRadius: "8px",
    fontWeight: "600",
  },

  card: {
    background: "#fff",
    border: "1px solid #e4e7ec",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "18px",
    boxShadow: "0 2px 8px rgba(16,24,40,0.04)",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "20px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "14px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  },

  productPicker: {
    position: "relative",
    marginTop: "7px",
  },

  productMenu: {
    position: "absolute",
    zIndex: 20,
    width: "100%",
    maxHeight: "270px",
    overflowY: "auto",
    background: "#fff",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    boxShadow: "0 10px 20px rgba(16,24,40,0.12)",
  },

  productOption: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "3px",
    border: "none",
    borderBottom: "1px solid #eaecf0",
    background: "#fff",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    color: "#172033",
  },

  noProductMatch: {
    padding: "12px",
    color: "#667085",
    fontWeight: "400",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "7px",
    padding: "11px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    resize: "vertical",
    fontFamily: "inherit",
  },

  addButton: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "11px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },

  saveButton: {
    width: "100%",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "14px",
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "16px",
    marginTop: "18px",
  },

  deleteButton: {
    border: "none",
    background: "#dc2626",
    color: "#fff",
    padding: "7px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },

  message: {
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
    padding: "12px 15px",
    borderRadius: "8px",
    marginBottom: "18px",
  },

  lineTotal: {
    display: "flex",
    justifyContent: "space-between",
    background: "#f8fafc",
    padding: "13px",
    borderRadius: "8px",
    marginBottom: "15px",
  },

  empty: {
    padding: "20px",
    textAlign: "center",
    color: "#667085",
    background: "#f8fafc",
    borderRadius: "8px",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1050px",
  },

  th: {
    textAlign: "left",
    padding: "11px",
    background: "#f8fafc",
    borderBottom: "1px solid #e4e7ec",
    fontSize: "12px",
  },

  td: {
    padding: "11px",
    borderBottom: "1px solid #eaecf0",
    fontSize: "13px",
  },

  totalCard: {
    background: "#fff",
    border: "1px solid #e4e7ec",
    borderRadius: "14px",
    padding: "22px",
    marginBottom: "30px",
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderBottom: "1px solid #eaecf0",
  },

  balanceRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "15px 0",
    fontSize: "19px",
  },
};
