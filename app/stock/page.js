"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadStock() {
    setLoading(true);
    setMessage("");

    try {
      const [
        { data: productData, error: productError },
        { data: batchData, error: batchError },
        { data: movementData, error: movementError },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id, product_code, product_name, generic_name, pack_size, min_stock"
          )
          .eq("is_active", true)
          .order("product_name"),

        supabase
          .from("product_batches")
          .select(
            "id, product_id, batch_no, manufacturing_date, expiry_date, purchase_rate, sale_rate, quantity"
          )
          .order("expiry_date", { ascending: true }),

        supabase
          .from("stock_movements")
          .select(
            "id, product_id, batch_id, movement_type, quantity, reference_no, movement_date, notes"
          )
          .order("movement_date", { ascending: false })
          .limit(100),
      ]);

      if (productError) throw productError;
      if (batchError) throw batchError;
      if (movementError) throw movementError;

      setProducts(productData || []);
      setBatches(batchData || []);
      setMovements(movementData || []);
    } catch (error) {
      console.error(error);
      setMessage("Stock data load nahi ho saka: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  const productMap = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = product;
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!keyword) return true;

      return (
        product.product_name?.toLowerCase().includes(keyword) ||
        product.product_code?.toLowerCase().includes(keyword) ||
        product.generic_name?.toLowerCase().includes(keyword)
      );
    });
  }, [products, search]);

  const productStock = useMemo(() => {
    const stock = {};

    batches.forEach((batch) => {
      stock[batch.product_id] =
        (stock[batch.product_id] || 0) + Number(batch.quantity || 0);
    });

    return stock;
  }, [batches]);

  function getStockStatus(product) {
    const quantity = productStock[product.id] || 0;
    const minimum = Number(product.min_stock || 0);

    if (quantity <= 0) {
      return {
        text: "Out of Stock",
        className: "status out",
      };
    }

    if (minimum > 0 && quantity <= minimum) {
      return {
        text: "Low Stock",
        className: "status low",
      };
    }

    return {
      text: "In Stock",
      className: "status good",
    };
  }

  function getMovementProductName(productId) {
    return productMap[productId]?.product_name || "Unknown Product";
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString("en-GB");
  }

  return (
    <main className="page">
      <div className="topbar">
        <div>
          <h1>Stock Management</h1>
          <p>Product, batch aur stock movement management</p>
        </div>

        <button className="refreshBtn" onClick={loadStock}>
          ↻ Refresh
        </button>
      </div>

      {message && <div className="message">{message}</div>}

      <section className="summaryGrid">
        <div className="summaryCard">
          <div className="summaryTitle">Products</div>
          <div className="summaryValue">{products.length}</div>
        </div>

        <div className="summaryCard">
          <div className="summaryTitle">Total Stock</div>
          <div className="summaryValue">
            {Object.values(productStock)
              .reduce((sum, value) => sum + value, 0)
              .toLocaleString()}
          </div>
        </div>

        <div className="summaryCard">
          <div className="summaryTitle">Batches</div>
          <div className="summaryValue">{batches.length}</div>
        </div>

        <div className="summaryCard">
          <div className="summaryTitle">Movements</div>
          <div className="summaryValue">{movements.length}</div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Current Stock</h2>
            <p>Product-wise available quantity</p>
          </div>

          <input
            type="text"
            placeholder="Search product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="searchInput"
          />
        </div>

        {loading ? (
          <div className="empty">Loading stock...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty">No products found.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Generic</th>
                  <th>Pack</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const quantity = productStock[product.id] || 0;
                  const status = getStockStatus(product);

                  return (
                    <tr key={product.id}>
                      <td>{product.product_code || "-"}</td>
                      <td>
                        <strong>{product.product_name}</strong>
                      </td>
                      <td>{product.generic_name || "-"}</td>
                      <td>{product.pack_size || "-"}</td>
                      <td>
                        <strong>{quantity.toLocaleString()}</strong>
                      </td>
                      <td>{Number(product.min_stock || 0).toLocaleString()}</td>
                      <td>
                        <span className={status.className}>
                          {status.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Batch-wise Stock</h2>
            <p>Batch number aur expiry details</p>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="empty">Abhi koi stock batch available nahi.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch No.</th>
                  <th>Expiry</th>
                  <th>Purchase Rate</th>
                  <th>Sale Rate</th>
                  <th>Quantity</th>
                </tr>
              </thead>

              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      {productMap[batch.product_id]?.product_name || "-"}
                    </td>
                    <td>
                      <strong>{batch.batch_no || "-"}</strong>
                    </td>
                    <td>{formatDate(batch.expiry_date)}</td>
                    <td>
                      Rs. {Number(batch.purchase_rate || 0).toLocaleString()}
                    </td>
                    <td>
                      Rs. {Number(batch.sale_rate || 0).toLocaleString()}
                    </td>
                    <td>
                      <strong>{Number(batch.quantity || 0).toLocaleString()}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <h2>Recent Stock Movements</h2>
            <p>Latest Stock IN / OUT activity</p>
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading movements...</div>
        ) : movements.length === 0 ? (
          <div className="empty">Abhi koi stock movement nahi.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                </tr>
              </thead>

              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.movement_date)}</td>
                    <td>{getMovementProductName(movement.product_id)}</td>
                    <td>
                      <span
                        className={
                          movement.movement_type.includes("out")
                            ? "movement out"
                            : "movement in"
                        }
                      >
                        {movement.movement_type.replaceAll("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>{Number(movement.quantity || 0).toLocaleString()}</td>
                    <td>{movement.reference_no || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 30px;
          background: #f5f7fb;
          color: #1f2937;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          gap: 20px;
        }

        h1 {
          margin: 0;
          font-size: 28px;
        }

        .topbar p,
        .panelHeader p {
          margin: 5px 0 0;
          color: #6b7280;
        }

        .refreshBtn {
          border: none;
          background: #111827;
          color: white;
          padding: 11px 18px;
          border-radius: 8px;
          cursor: pointer;
        }

        .message {
          background: #fee2e2;
          color: #991b1b;
          padding: 12px 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .summaryGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }

        .summaryCard {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
        }

        .summaryTitle {
          color: #6b7280;
          font-size: 14px;
        }

        .summaryValue {
          margin-top: 8px;
          font-size: 28px;
          font-weight: 700;
        }

        .panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          margin-bottom: 22px;
          overflow: hidden;
        }

        .panelHeader {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          border-bottom: 1px solid #e5e7eb;
        }

        .panelHeader h2 {
          margin: 0;
          font-size: 19px;
        }

        .searchInput {
          width: 260px;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
        }

        .tableWrap {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 750px;
        }

        th,
        td {
          padding: 13px 16px;
          text-align: left;
          border-bottom: 1px solid #eef0f3;
          white-space: nowrap;
        }

        th {
          background: #f9fafb;
          color: #4b5563;
          font-size: 13px;
        }

        td {
          font-size: 14px;
        }

        .status,
        .movement {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .status.good {
          background: #dcfce7;
          color: #166534;
        }

        .status.low {
          background: #fef3c7;
          color: #92400e;
        }

        .status.out {
          background: #fee2e2;
          color: #991b1b;
        }

        .movement.in {
          background: #dcfce7;
          color: #166534;
        }

        .movement.out {
          background: #fee2e2;
          color: #991b1b;
        }

        .empty {
          padding: 30px;
          text-align: center;
          color: #6b7280;
        }

        @media (max-width: 800px) {
          .page {
            padding: 18px;
          }

          .topbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .summaryGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .panelHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .searchInput {
            width: 100%;
          }
        }

        @media (max-width: 500px) {
          .summaryGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
