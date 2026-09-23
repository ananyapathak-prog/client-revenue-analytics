import { useEffect, useState } from "react"
function App() {
  const [aov, setAov] = useState<number | null>(null)
  useEffect(() => {
    fetch("http://127.0.0.1:8000/analytics/aov")
      .then((response) => response.json())
      .then((data) => {
        setAov(data.average_order_value)
      })
  }, [])
  const [customerSegments, setCustomerSegments] = useState<
    { customer_type: string; percentage: number }[]
  >([])
  const [totalNetRevenue, setTotalNetRevenue] = useState<number | null>(null)
  useEffect(() => {
    fetch("http://127.0.0.1:8000/analytics/monthly-revenue")
      .then((response) => response.json())
      .then((data) => {
        const total = data.reduce(
          (sum: number, month: { net_revenue: number }) =>
            sum + month.net_revenue,
          0
        )

        setTotalNetRevenue(total)
      })
  }, [])
  useEffect(() => {
    fetch("http://127.0.0.1:8000/analytics/customer-segments")
      .then((response) => response.json())
      .then((data) => {
        setCustomerSegments(data)
      })
  }, [])
  const metrics = [
    {
      title: "Total Net Revenue",
      value:
        totalNetRevenue !== null
          ? `£${(totalNetRevenue / 1000000).toFixed(2)}M`
          : "Loading...",
    },
    {
      title: "Average Order Value",
      value: aov ? `£${aov.toFixed(2)}` : "Loading...",
    },
    {
      title: "Repeat Customers",
      value:
        customerSegments.find(
          (segment) => segment.customer_type === "Repeat"
        )?.percentage !== undefined
          ? `${customerSegments.find(
            (segment) => segment.customer_type === "Repeat"
          )?.percentage}%`
          : "Loading...",
    },
    {
      title: "One-time Customers",
      value:
        customerSegments.find(
          (segment) => segment.customer_type === "One-time"
        )?.percentage !== undefined
          ? `${customerSegments.find(
            (segment) => segment.customer_type === "One-time"
          )?.percentage}%`
          : "Loading...",
    },
  ]

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      <h1 className="text-3xl font-bold text-slate-900">
        Client Revenue Analytics
      </h1>

      <p className="mt-2 text-slate-600">
        Revenue, customer, and retention insights
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">

        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="rounded-xl bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {metric.title}
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {metric.value}
            </p>
          </div>
        ))}

      </div>

    </div>
  )
}

export default App
