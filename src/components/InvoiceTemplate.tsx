import { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";

interface InvoiceItem {
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CompanyInfo {
  name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

interface InvoiceData {
  invoice_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  order_value: number;
  advance: number;
  total_due: number;
  cod: number;
  note: string | null;
  status: string | null;
  created_at: string;
  items: InvoiceItem[];
  company: CompanyInfo;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, { data: InvoiceData }>(
  ({ data }, ref) => {
    const { company, items } = data;
    const date = new Date(data.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return (
      <div
        ref={ref}
        style={{
          width: "80mm",
          maxWidth: "100%",
          margin: "0 auto",
          padding: "16px",
          fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
          fontSize: "12px",
          color: "#1a1a2e",
          background: "#ffffff",
          lineHeight: 1.5,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "12px", borderBottom: "2px solid #3b6cf5", paddingBottom: "12px" }}>
          {company.logo_url && (
            <img
              src={company.logo_url}
              alt={company.name}
              style={{ height: "48px", margin: "0 auto 8px", display: "block", objectFit: "contain" }}
            />
          )}
          <div style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.5px" }}>
            {company.name || "Company Name"}
          </div>
          {company.address && (
            <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{company.address}</div>
          )}
          <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
            {[company.phone, company.email, company.website].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* Invoice Meta */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "11px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px", fontFamily: "'JetBrains Mono', monospace" }}>
              #{data.invoice_code}
            </div>
            <div style={{ color: "#777", marginTop: "2px" }}>{date}</div>
          </div>
          <div style={{
            padding: "2px 10px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 600,
            background: data.status === "Delivered" ? "#e8f5e9" : data.status === "Cancelled" ? "#ffebee" : "#e3f2fd",
            color: data.status === "Delivered" ? "#2e7d32" : data.status === "Cancelled" ? "#c62828" : "#1565c0",
            alignSelf: "flex-start",
          }}>
            {data.status || "Pending"}
          </div>
        </div>

        {/* Customer */}
        <div style={{ background: "#f8f9fa", borderRadius: "6px", padding: "8px 10px", marginBottom: "10px", fontSize: "11px" }}>
          <div style={{ fontWeight: 600 }}>{data.customer_name}</div>
          <div style={{ color: "#555" }}>{data.customer_phone}</div>
          {data.customer_address && <div style={{ color: "#555" }}>{data.customer_address}</div>}
        </div>

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: "#777" }}>Item</th>
              <th style={{ textAlign: "center", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: "#777" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: "#777" }}>Price</th>
              <th style={{ textAlign: "right", padding: "4px 2px", fontWeight: 600, fontSize: "10px", color: "#777" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "5px 2px" }}>
                  <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                  <div style={{ fontSize: "9px", color: "#999", fontFamily: "'JetBrains Mono', monospace" }}>{item.product_code}</div>
                </td>
                <td style={{ textAlign: "center", padding: "5px 2px" }}>{item.quantity}</td>
                <td style={{ textAlign: "right", padding: "5px 2px" }}>{Number(item.unit_price).toLocaleString()}</td>
                <td style={{ textAlign: "right", padding: "5px 2px", fontWeight: 500 }}>{Number(item.subtotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ borderTop: "2px solid #3b6cf5", paddingTop: "8px", fontSize: "11px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ color: "#555" }}>Subtotal</span>
            <span>{Number(data.order_value).toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span style={{ color: "#555" }}>Advance</span>
            <span>-{Number(data.advance).toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontWeight: 700, fontSize: "13px", borderTop: "1px solid #ddd", marginTop: "4px" }}>
            <span>Total Due</span>
            <span>{Number(data.total_due).toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "#3b6cf5", fontWeight: 600 }}>
            <span>COD</span>
            <span>{Number(data.cod).toLocaleString()}</span>
          </div>
        </div>

        {/* Note */}
        {data.note && (
          <div style={{ marginTop: "8px", padding: "6px 8px", background: "#fffde7", borderRadius: "4px", fontSize: "10px", color: "#555" }}>
            <strong>Note:</strong> {data.note}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "14px", paddingTop: "8px", borderTop: "1px dashed #ccc", fontSize: "9px", color: "#999" }}>
          Thank you for your business!
          {company.website && <div>{company.website}</div>}
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
