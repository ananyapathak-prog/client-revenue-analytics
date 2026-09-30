import { useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import type { FormEvent } from "react"
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import "./App.css"

type Row = Record<string, string | number>
type RevenuePoint = { month: string; revenue: number; orders: number }
type AiInsight = { icon: string; title: string; text: string; tone: string }
const API_URL = import.meta.env.VITE_API_URL || "https://client-revenue-analytics-api.onrender.com"

const demoRevenue: RevenuePoint[] = [
  { month: "Jan", revenue: 118400, orders: 820 }, { month: "Feb", revenue: 132800, orders: 910 },
  { month: "Mar", revenue: 149500, orders: 1040 }, { month: "Apr", revenue: 143200, orders: 982 },
  { month: "May", revenue: 168900, orders: 1160 }, { month: "Jun", revenue: 181600, orders: 1240 },
  { month: "Jul", revenue: 194800, orders: 1310 }, { month: "Aug", revenue: 210500, orders: 1450 },
  { month: "Sep", revenue: 225900, orders: 1532 }, { month: "Oct", revenue: 239400, orders: 1640 },
  { month: "Nov", revenue: 254700, orders: 1718 }, { month: "Dec", revenue: 278300, orders: 1884 },
]
const demoProducts = [
  { name: "Sterling silver pendant", revenue: 184200, share: 18.2 }, { name: "Classic leather tote", revenue: 156800, share: 15.5 },
  { name: "Ceramic coffee set", revenue: 131400, share: 13.0 }, { name: "Linen lounge shirt", revenue: 108900, share: 10.8 }, { name: "Hand-poured candle", revenue: 96200, share: 9.5 },
]
const demoSegments = [{ name: "Repeat customers", value: 62, color: "#245f5a" }, { name: "One-time customers", value: 38, color: "#f2b84b" }]
const demoRows: Row[] = [{ order_id: "ORD-1001", customer_id: "C-201", order_date: "2024-01-18", product: "Sterling silver pendant", quantity: 2, revenue: 148 }, { order_id: "ORD-1002", customer_id: "C-203", order_date: "2024-02-04", product: "Classic leather tote", quantity: 1, revenue: 96 }]
const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value)
const shortMoney = (value: number) => value >= 1000000 ? `£${(value / 1000000).toFixed(2)}M` : value >= 1000 ? `£${(value / 1000).toFixed(1)}K` : money(value)

function App() {
  const [session, setSession] = useState<"login" | "signup" | "app">(() => localStorage.getItem("arcadia_token") ? "app" : "login")
  const [activeNav, setActiveNav] = useState("Overview")
  const [dataMode, setDataMode] = useState("Demo dataset")
  const [range] = useState("Last 12 months")
  const [rows, setRows] = useState<Row[]>(demoRows)
  const [fileName, setFileName] = useState("")
  const [notice, setNotice] = useState("Your demo workspace is ready to explore")
  const [modal, setModal] = useState<string | null>(null)
  const [filters, setFilters] = useState({ segment: "All customers", country: "All countries", product: "All products" })
  const [liveSummary, setLiveSummary] = useState<{ totals: { revenue: number; orders: number; aov: number }; monthly_revenue: RevenuePoint[]; top_products: typeof demoProducts } | null>(null)
  const [settings, setSettings] = useState({ workspace_name: "Analytics workspace", currency: "GBP", notifications_enabled: true })
  const [aiBrief, setAiBrief] = useState({ headline: "Healthy momentum", score: 84, analysis: "Performance is trending in the right direction.", source: "local", insights: [] as AiInsight[] })
  const aiAnalysis = aiBrief.analysis
  const [aiBusy, setAiBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const isDemo = localStorage.getItem("arcadia_token") === "demo-session"
  const signedInUser = (() => { try { return JSON.parse(localStorage.getItem("arcadia_user") || "null") as { name?: string } | null } catch { return null } })()
  const displayName = isDemo ? "user" : signedInUser?.name || "user"
  const currentDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase()
  const chartRevenue = liveSummary?.monthly_revenue?.length ? liveSummary.monthly_revenue : demoRevenue
  const products = liveSummary?.top_products?.length ? liveSummary.top_products : demoProducts
  const visibleProducts = filters.product === "All products" ? products : products.filter((product) => product.name === filters.product)
  const visibleSegments = filters.segment === "All customers" ? demoSegments : [{ name: filters.segment, value: 100, color: filters.segment === "Repeat customers" ? "#245f5a" : "#f2b84b" }]
  const totalRevenue = liveSummary?.totals.revenue ?? chartRevenue.reduce((sum, point) => sum + point.revenue, 0)
  const totalOrders = liveSummary?.totals.orders ?? chartRevenue.reduce((sum, point) => sum + point.orders, 0)
  const aov = liveSummary?.totals.aov ?? totalRevenue / totalOrders
  const latest = chartRevenue[chartRevenue.length - 1]
  const heatmap = useMemo(() => [[100, 48, 31, 24, 18, 14], [100, 52, 35, 25, 19, 0], [100, 45, 28, 19, 0, 0], [100, 61, 40, 0, 0, 0], [100, 55, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0]], [])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const token = localStorage.getItem("arcadia_token")
    let serverUploadSucceeded = false
    if (token && token !== "demo-session") {
      try {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch(`${API_URL}/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData })
        const body = await response.json()
        if (!response.ok) throw new Error(body.detail || "The dataset could not be uploaded")
        serverUploadSucceeded = true
        setNotice(`${file.name} stored in your workspace · ${body.rows.toLocaleString()} rows ready for analysis`)
      } catch (requestError) {
        setNotice(requestError instanceof Error ? requestError.message : "The dataset could not be uploaded")
      }
    }
    const reader = new FileReader()
    reader.onload = () => {
      const [headerLine, ...lines] = String(reader.result ?? "").split(/\r?\n/).filter(Boolean)
      const headers = headerLine.split(",").map((header) => header.trim().replace(/^"|"$/g, ""))
      const parsed = lines.slice(0, 300).map((line) => { const values = line.split(",").map((value) => value.trim().replace(/^"|"$/g, "")); return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) })
      setRows(parsed); setDataMode("Uploaded CSV"); if (!serverUploadSucceeded) setNotice(`${file.name} loaded in preview mode · ${parsed.length.toLocaleString()} rows detected`)
    }
    reader.readAsText(file)
  }

  const applyFilters = async (next: typeof filters) => {
    setFilters(next)
    setModal(null)
    setNotice(`Applying filters · ${next.segment}, ${next.country}, ${next.product}`)
    if (dataMode === "Demo dataset" || localStorage.getItem("arcadia_token") === "demo-session") {
      const productRevenue = next.product === "All products" ? demoProducts.reduce((sum, product) => sum + product.revenue, 0) : demoProducts.find((product) => product.name === next.product)?.revenue ?? 0
      const productScale = productRevenue / demoProducts.reduce((sum, product) => sum + product.revenue, 0)
      const segmentScale = next.segment === "All customers" ? 1 : next.segment === "Repeat customers" ? 0.62 : 0.38
      const scale = productScale * segmentScale
      const demoFilteredRevenue = demoRevenue.map((point) => ({ ...point, revenue: Math.round(point.revenue * scale), orders: Math.max(1, Math.round(point.orders * scale)) }))
      const filteredProducts = next.product === "All products" ? demoProducts.map((product) => ({ ...product, revenue: Math.round(product.revenue * segmentScale) })) : demoProducts.filter((product) => product.name === next.product).map((product) => ({ ...product, revenue: Math.round(product.revenue * segmentScale) }))
      setLiveSummary({ totals: { revenue: demoFilteredRevenue.reduce((sum, point) => sum + point.revenue, 0), orders: demoFilteredRevenue.reduce((sum, point) => sum + point.orders, 0), aov: (totalRevenue / totalOrders) * (next.segment === "Repeat customers" ? 1.12 : next.segment === "One-time customers" ? 0.82 : 1) }, monthly_revenue: demoFilteredRevenue, top_products: filteredProducts })
      setNotice(next.country === "All countries" ? "Demo preview updated with your filters" : "Demo preview updated · country filtering requires an uploaded dataset")
      return
    }
    try {
      const query = new URLSearchParams({ segment: next.segment, country: next.country, product: next.product })
      const token = localStorage.getItem("arcadia_token")
      const response = await fetch(`${API_URL}/analytics/summary?${query}`, token && token !== "demo-session" ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || "The analytics service rejected these filters") }
      setLiveSummary(await response.json())
      setNotice("Live data refreshed with your filters")
    } catch (requestError) {
      setLiveSummary(null)
      const reason = requestError instanceof Error ? requestError.message : "API unavailable"
      setNotice(`Demo preview active · ${reason}. Start FastAPI and PostgreSQL for live filtering.`)
    }
  }
  const openSettings = async () => {
    setModal("settings")
    const token = localStorage.getItem("arcadia_token")
    if (!token || token === "demo-session") return
    try { const response = await fetch(`${API_URL}/settings`, { headers: { Authorization: `Bearer ${token}` } }); if (response.ok) setSettings(await response.json()) } catch { setNotice("Settings are available locally while the API is offline") }
  }
  const refreshAiBrief = async () => {
    setAiBusy(true)
    try {
      const token = localStorage.getItem("arcadia_token")
      const response = await fetch(`${API_URL}/ai/insights`, { method: "POST", headers: { "Content-Type": "application/json", ...(token && token !== "demo-session" ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ totals: { revenue: totalRevenue, orders: totalOrders, aov }, monthly_revenue: chartRevenue, top_products: products, filters }) })
      if (!response.ok) throw new Error()
      const body = await response.json()
      setAiBrief({ headline: body.headline || "Business brief", score: Number(body.score) || 0, analysis: body.analysis || "Performance is trending in the right direction.", source: body.source || "local", insights: Array.isArray(body.insights) ? body.insights : [] })
      setNotice(body.source === "openai" ? "AI business brief refreshed" : "Business brief refreshed with local analytics")
    } catch {
      setAiBrief((current) => ({ ...current, source: "unavailable" }))
      setNotice("AI brief unavailable · check the API URL and Render deployment")
      setNotice("Business brief refreshed locally")
    } finally { setAiBusy(false) }
  }

  if (session !== "app") return <AuthScreen mode={session} onModeChange={setSession} onSuccess={() => setSession("app")} onDemo={() => { localStorage.setItem("arcadia_token", "demo-session"); setSession("app") }} />

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">◆</div><div><strong>arcadia</strong><span>revenue intelligence</span></div></div><nav><p className="nav-label">Workspace</p>{["Overview", "Revenue", "Customers", "Products"].map((item) => <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => { setActiveNav(item); setNotice(`${item} workspace opened`) }}><span className="nav-icon">{item === "Overview" ? "⌂" : item === "Revenue" ? "↗" : item === "Customers" ? "◌" : "▦"}</span>{item}</button>)}<p className="nav-label data-label">Data & settings</p><button className="nav-item" onClick={() => fileInput.current?.click()}><span className="nav-icon">↥</span>Import data</button><button className="nav-item" onClick={openSettings}><span className="nav-icon">⚙</span>Settings</button></nav><div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><div><strong>Need a hand?</strong><span>Read the quick start guide</span></div><span>↗</span></div><button className="profile" onClick={() => { localStorage.removeItem("arcadia_token"); localStorage.removeItem("arcadia_user"); setSession("login") }}><span className="avatar">{isDemo ? "DU" : displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div><strong>{isDemo ? "Demo user" : displayName}</strong><span>Sign out</span></div><span className="more">•••</span></button></div></aside>
    <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Analytics workspace</span><b>/</b><strong>{activeNav}</strong></div><div className="top-actions"><span className="sync-dot" /> Synced just now <button className="icon-button" aria-label="Notifications">♧</button><button className="icon-button" aria-label="Help">?</button></div></header><div className="content-wrap">
      <section className="page-heading"><div><p className="eyebrow">{currentDate}</p><h1>{activeNav === "Overview" ? <>Hello, user <span>✦</span></> : `${activeNav} workspace`}</h1><p className="subheading">{activeNav === "Overview" ? "Here’s what’s happening across your business." : `Explore your ${activeNav.toLowerCase()} performance and find the next opportunity.`}</p></div><div className="heading-actions"><button className="button secondary" onClick={() => fileInput.current?.click()}>↥ <span>Import data</span></button><button className="button primary" onClick={() => setNotice("Your report is being prepared")}>Export report <span>↓</span></button></div></section>
      <div className="notice"><span className="notice-check">✓</span><span>{notice}</span><button onClick={() => setNotice("Your demo workspace is ready to explore")}>×</button></div>
      <section className="toolbar"><div className="mode-toggle"><button className={dataMode === "Demo dataset" ? "selected" : ""} onClick={() => { setDataMode("Demo dataset"); setLiveSummary(null); setNotice("Demo dataset is active") }}>Demo dataset</button><button className={dataMode === "Uploaded CSV" ? "selected" : ""} onClick={() => fileInput.current?.click()}>{dataMode === "Uploaded CSV" ? fileName || "Uploaded CSV" : "Upload CSV"}</button></div><div className="toolbar-right"><button className="date-filter" onClick={() => setModal("date")}>▣ {range} <span>⌄</span></button><button className="filter-button" onClick={() => setModal("filters")}>≡ <span>Filters{filters.segment !== "All customers" || filters.country !== "All countries" || filters.product !== "All products" ? " · active" : ""}</span></button></div></section>
      {activeNav !== "Overview" && <TabSpotlight activeNav={activeNav} onOpen={() => setModal(activeNav.toLowerCase())} />}
      <section className="metric-grid"><Metric label="Net revenue" value={shortMoney(totalRevenue)} /><Metric label="Orders" value={totalOrders.toLocaleString()} /><Metric label="Average order value" value={money(aov)} /><Metric label="Repeat customer rate" value="62.0%" /></section>
      <section className="dashboard-grid primary-grid"><div className="panel revenue-panel"><PanelHeader title="Revenue performance" detail="Net revenue over time" action="View details" onClick={() => setModal("revenue")} /><div className="chart-legend"><span className="legend-line" /> Net revenue <span className="legend-muted">•</span><span className="legend-dashed" /> Orders</div><div className="large-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartRevenue} margin={{ top: 15, right: 12, left: 0, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f958c" stopOpacity={0.22} /><stop offset="100%" stopColor="#4f958c" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e8eeec" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#84928f", fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#84928f", fontSize: 12 }} tickFormatter={(value) => `£${value / 1000}k`} /><Tooltip formatter={(value, name) => [name === "revenue" ? money(Number(value)) : Number(value).toLocaleString(), name === "revenue" ? "Revenue" : "Orders"]} contentStyle={{ borderRadius: 8, border: "1px solid #e3ebe8" }} /><Area type="monotone" dataKey="revenue" stroke="#2d776e" strokeWidth={3} fill="url(#revenueFill)" /><Area type="monotone" dataKey="orders" stroke="#b8c6c1" strokeWidth={1.5} strokeDasharray="5 5" fill="none" /></AreaChart></ResponsiveContainer></div><div className="chart-footer"><span>Highest month: <strong>{latest.month}</strong></span><span><strong>{money(latest.revenue)}</strong> revenue · {latest.orders.toLocaleString()} orders</span></div></div><div className="panel insight-panel"><PanelHeader title="AI business brief" detail={aiBusy ? "Generating from your latest data" : "Generated from your latest data"} action="Refresh" onClick={refreshAiBrief} /><div className="insight-score"><div className="score-ring">84<span>/100</span></div><div><strong>Healthy momentum</strong><p>{aiAnalysis}</p></div></div><div className="insight-list"><Insight icon="↗" title="Revenue is up 18.4%" text="Growth is accelerating, led by a strong second half." tone="green" /><Insight icon="◆" title="Repeat customers are your engine" text="They generate 2.4× more revenue per order." tone="gold" /><Insight icon="!" title="Watch your April dip" text="Revenue fell 4.2% before recovering in May." tone="coral" /></div><button className="text-button" onClick={() => setModal("analysis")}>View full analysis <span>→</span></button></div></section>
      <section className="dashboard-grid secondary-grid"><div className="panel"><PanelHeader title="Customer mix" detail="Based on 8,412 customers" action="View customers" /><div className="segment-content"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visibleSegments} dataKey="value" innerRadius={66} outerRadius={91} paddingAngle={3} stroke="none">{visibleSegments.map((segment) => <Cell key={segment.name} fill={segment.color} />)}</Pie><Tooltip formatter={(value) => `${value}%`} /></PieChart></ResponsiveContainer><div className="donut-label"><strong>{filters.segment === "All customers" ? "62%" : "100%"}</strong><span>{filters.segment === "All customers" ? "repeat" : "selected"}</span></div></div><div className="segment-legend">{visibleSegments.map((segment) => <div key={segment.name}><span className="color-dot" style={{ background: segment.color }} /><div><strong>{segment.value}%</strong><span>{segment.name}</span></div></div>)}<div className="segment-footnote">Repeat customers spend <strong>2.4×</strong> more on average.</div></div></div></div><div className="panel"><PanelHeader title="Top products" detail="By net revenue" action="View all" /><div className="product-list">{visibleProducts.map((product, index) => <div className="product-row" key={product.name}><span className="rank">0{index + 1}</span><div className="product-info"><strong>{product.name}</strong><div className="progress-track"><span style={{ width: `${product.share * 4.1}%` }} /></div></div><div className="product-value"><strong>{shortMoney(product.revenue)}</strong><span>{product.share}%</span></div></div>)}</div></div></section>
      <section className="dashboard-grid bottom-grid"><div className="panel"><PanelHeader title="Customer retention" detail="Monthly cohort analysis" action="Explore cohorts" /><div className="cohort-table"><div className="cohort-row cohort-head"><span>Cohort</span>{["M0", "M1", "M2", "M3", "M4", "M5"].map((month) => <span key={month}>{month}</span>)}</div>{heatmap.map((cohort, index) => <div className="cohort-row" key={index}><strong>2024 · {String(index + 1).padStart(2, "0")}</strong>{cohort.map((value, cellIndex) => <span className={value ? "heat-cell" : "heat-cell empty"} style={value ? { background: `rgba(36, 95, 90, ${0.14 + value / 140})`, color: value > 50 ? "#fff" : "#245f5a" } : undefined} key={cellIndex}>{value ? `${value}%` : "–"}</span>)}</div>)}</div></div><div className="panel quick-panel"><PanelHeader title="Data health" detail="Last checked just now" action="Settings" /><div className="health-stat"><span className="health-icon">✓</span><div><strong>Everything looks good</strong><p>Your dataset is clean and ready to analyze.</p></div></div><div className="health-list"><div><span>Rows analyzed</span><strong>{dataMode === "Uploaded CSV" ? rows.length.toLocaleString() : "48,296"}</strong></div><div><span>Columns mapped</span><strong>12 / 12</strong></div><div><span>Data quality score</span><strong className="score-text">98.7%</strong></div></div><button className="button full-button">Review data quality <span>→</span></button></div></section>
    </div></main>{modal === "filters" ? <FilterModal filters={filters} onApply={applyFilters} onClose={() => setModal(null)} /> : modal === "settings" ? <SettingsModal settings={settings} onApply={async (next) => { setSettings(next); setModal(null); const token = localStorage.getItem("arcadia_token"); if (token && token !== "demo-session") { try { const response = await fetch(`${API_URL}/settings`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(next) }); if (!response.ok) throw new Error(); } catch { setNotice("Settings saved locally; the API could not be reached") } } localStorage.setItem("arcadia_settings", JSON.stringify(next)); setNotice("Settings saved") }} onClose={() => setModal(null)} /> : modal && <ActionModal kind={modal} onClose={() => setModal(null)} />}<input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={handleUpload} />
  </div>
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-menu">•••</span></div><strong className="metric-value">{value}</strong><div className="metric-change"><span className="positive">↗ 18.4%</span><span>vs. previous 12 months</span></div></div> }
function PanelHeader({ title, detail, action, onClick }: { title: string; detail: string; action: string; onClick?: () => void }) { return <div className="panel-header"><div><h2>{title}</h2><p>{detail}</p></div><button className="panel-action" onClick={onClick}>{action} <span>→</span></button></div> }
function Insight({ icon, title, text, tone }: { icon: string; title: string; text: string; tone: string }) { return <div className={`insight ${tone}`}><span className="insight-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div> }
function TabSpotlight({ activeNav, onOpen }: { activeNav: string; onOpen: () => void }) {
  const content: Record<string, { kicker: string; title: string; body: string; stats: [string, string][] }> = {
    Revenue: { kicker: "REVENUE PERFORMANCE", title: "Momentum is building", body: "Revenue has grown steadily through the year, with December setting a new monthly high.", stats: [["Best month", "December"], ["Growth", "+18.4%"], ["Net revenue", "£2.30M"]] },
    Customers: { kicker: "CUSTOMER INTELLIGENCE", title: "Retention is your growth lever", body: "Repeat customers make up 62% of your base and spend more per order than first-time buyers.", stats: [["Customers", "8,412"], ["Repeat rate", "62.0%"], ["Avg. value", "£96"]] },
    Products: { kicker: "PRODUCT PERFORMANCE", title: "Five products lead the mix", body: "Your best-selling products are concentrated in a small group of high-performing categories.", stats: [["Products", "1,248"], ["Top product", "Pendant"], ["Top share", "18.2%"]] },
  }
  const view = content[activeNav]
  return <section className="tab-spotlight"><div><p className="eyebrow">{view.kicker}</p><h2>{view.title}</h2><p>{view.body}</p><button className="button primary" onClick={onOpen}>Explore {activeNav.toLowerCase()} <span>→</span></button></div><div className="spotlight-stats">{view.stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
}
function FilterModal({ filters, onApply, onClose }: { filters: { segment: string; country: string; product: string }; onApply: (filters: { segment: string; country: string; product: string }) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(filters)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card filter-card" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="modal-kicker">FILTER DATA</span><h2>Refine your workspace</h2><p>Apply filters across the dashboard to focus on the customers and products that matter.</p><div className="filter-fields"><label>Customer segment<select value={draft.segment} onChange={(event) => setDraft({ ...draft, segment: event.target.value })}><option>All customers</option><option>Repeat customers</option><option>One-time customers</option></select></label><label>Country<select value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })}><option>All countries</option><option>United Kingdom</option><option>United States</option><option>Germany</option></select></label><label>Product<select value={draft.product} onChange={(event) => setDraft({ ...draft, product: event.target.value })}><option>All products</option>{demoProducts.map((product) => <option key={product.name}>{product.name}</option>)}</select></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={() => onApply(draft)}>Apply filters <span>→</span></button></div></div></div>
}
function SettingsModal({ settings, onApply, onClose }: { settings: { workspace_name: string; currency: string; notifications_enabled: boolean }; onApply: (settings: { workspace_name: string; currency: string; notifications_enabled: boolean }) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(settings)
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card filter-card" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="modal-kicker">WORKSPACE SETTINGS</span><h2>Make it yours</h2><p>Update the preferences used across your analytics workspace.</p><div className="filter-fields"><label>Workspace name<input value={draft.workspace_name} onChange={(event) => setDraft({ ...draft, workspace_name: event.target.value })} /></label><label>Currency<select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="GBP">GBP · British pound</option><option value="USD">USD · US dollar</option><option value="EUR">EUR · Euro</option><option value="INR">INR · Indian rupee</option></select></label><label className="settings-toggle"><input type="checkbox" checked={draft.notifications_enabled} onChange={(event) => setDraft({ ...draft, notifications_enabled: event.target.checked })} /><span><strong>Insight notifications</strong><small>Receive alerts when your data changes meaningfully.</small></span></label></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={() => onApply(draft)}>Save settings <span>→</span></button></div></div></div>
}
function AuthScreen({ mode, onModeChange, onSuccess, onDemo }: { mode: "login" | "signup"; onModeChange: (mode: "login" | "signup") => void; onSuccess: () => void; onDemo: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const response = await fetch(`${API_URL}/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: mode === "signup" ? name : undefined, email, password }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || "Unable to authenticate"); localStorage.setItem("arcadia_token", body.token); localStorage.setItem("arcadia_user", JSON.stringify(body.user)); onSuccess() } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to reach the API. You can use the demo workspace below.") } finally { setBusy(false) } }
  return <div className="auth-shell"><div className="auth-aside"><div className="brand auth-brand"><div className="brand-mark">◆</div><div><strong>arcadia</strong><span>revenue intelligence</span></div></div><div className="auth-quote"><span>“</span><h1>Make every<br />number count.</h1><p>Turn raw business data into confident decisions with a clearer view of what drives your growth.</p><div className="auth-rule" /><small>Revenue intelligence for modern teams</small></div></div><main className="auth-main"><div className="auth-card"><div className="mobile-auth-brand"><div className="brand-mark">◆</div><strong>arcadia</strong></div><p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p><h2>{mode === "login" ? "Sign in to your workspace" : "Create your workspace"}</h2><p className="auth-subtitle">{mode === "login" ? "Pick up where you left off." : "Bring your business data into focus."}</p><form onSubmit={submit}>{mode === "signup" && <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ananya Kapoor" /></label>}<label>Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label><label>Password<input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>{mode === "login" && <div className="auth-options"><label className="check-label"><input type="checkbox" /> Remember me</label><button type="button" className="link-button">Forgot password?</button></div>}{error && <p className="auth-error">{error}</p>}<button className="auth-submit" disabled={busy}>{busy ? "Connecting…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button></form><div className="auth-divider"><span>or</span></div><button className="demo-login" onClick={onDemo}>Continue with demo workspace <span>↗</span></button><p className="auth-switch">{mode === "login" ? "Don’t have an account?" : "Already have an account?"} <button className="link-button" onClick={() => onModeChange(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create one" : "Sign in"}</button></p></div><p className="auth-footer">By continuing, you agree to our Terms and Privacy Policy.</p></main></div>
}
function ActionModal({ kind, onClose }: { kind: string; onClose: () => void }) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState(false)
  const copy: Record<string, { title: string; body: string }> = { filters: { title: "Filter your workspace", body: "Filtering is ready for your connected dataset. Choose a date range, channel, or customer segment to refine this view." }, date: { title: "Choose date range", body: "The dashboard is currently showing the last 12 months. Date presets will apply to every chart and KPI." }, revenue: { title: "Revenue performance", body: "December is your strongest month at £278K, with a steady 18.4% year-over-year lift across the period." }, analysis: { title: "Full business analysis", body: "Your strongest signal is repeat customer value. Focus on retention campaigns and protect the momentum from the second half of the year." } }
  const content = copy[kind] ?? copy.analysis
  const ask = async () => {
    if (!question.trim()) return
    setBusy(true)
    try {
      const token = localStorage.getItem("arcadia_token")
      const response = await fetch(`${API_URL}/ai/ask`, { method: "POST", headers: { "Content-Type": "application/json", ...(token && token !== "demo-session" ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ question }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || "Unable to answer")
      setAnswer(body.answer || "No answer was returned.")
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Unable to reach the AI service")
    } finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="modal-card" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="modal-kicker">ARCADIA INSIGHT</span><h2>{content.title}</h2><p>{content.body}</p>{kind === "analysis" && <div className="ask-ai-box"><label htmlFor="ai-question">Ask AI about your data</label><textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Why did revenue change this year?" rows={3} /><button className="button primary" onClick={ask} disabled={busy}>{busy ? "Thinking…" : "Ask AI"} <span>→</span></button>{answer && <p className="ai-answer">{answer}</p>}</div>}<button className="button secondary" onClick={onClose}>Done</button></div></div>
}
export default App
