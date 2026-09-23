import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
function App() {
  const [monthlyRevenue, setMonthlyRevenue] = useState<
    { month: string; net_revenue: number }[]
  >([])
  const [cohortRetention, setCohortRetention] = useState<
    {
      cohort: string
      month_number: number
      active_customers: number
      retention_percentage: number
    }[]
  >([])
  useEffect(() => {
    fetch("http://127.0.0.1:8000/analytics/cohort-retention")
      .then((response) => response.json())
      .then((data) => {
        setCohortRetention(data)
      })
  }, [])
  useEffect(() => {
    fetch("http://127.0.0.1:8000/analytics/monthly-revenue")
      .then((response) => response.json())
      .then((data) => {
        setMonthlyRevenue(data)

        const total = data.reduce(
          (sum: number, month: { net_revenue: number }) =>
            sum + month.net_revenue,
          0
        )

        setTotalNetRevenue(total)
      })
  }, [])
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
  const cohortMonths = Array.from(
    new Set(cohortRetention.map((item) => item.month_number))
  ).sort((a, b) => a - b)

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
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Monthly Revenue
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Net revenue by month
        </p>

        <div className="mt-6 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="net_revenue"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Customer Segmentation
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Repeat vs one-time customers
        </p>

        <div className="mt-6 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={customerSegments}
                dataKey="percentage"
                nameKey="customer_type"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {customerSegments.map((segment, index) => (
                  <Cell key={segment.customer_type}
                    fill={index === 0 ? "#dd4bb1" : "#920de4"} />
                ))}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Cohort Retention
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Percentage of customers returning in each month after their first purchase
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">
                  Cohort
                </th>

                {cohortMonths.map((month) => (
                  <th
                    key={month}
                    className="px-4 py-3 text-center font-semibold text-slate-700"
                  >
                    M{month}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from(
                new Set(cohortRetention.map((item) => item.cohort))
              ).map((cohort) => (
                <tr
                  key={cohort}
                  className="border-b border-slate-100"
                >
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {cohort}
                  </td>

                  {cohortMonths.map((month) => {
                    const data = cohortRetention.find(
                      (item) =>
                        item.cohort === cohort &&
                        item.month_number === month
                    )

                    return (
                      <td
                        key={month}
                        className="px-4 py-3 text-center font-medium"
                        style={{
                          backgroundColor: data
                            ? `rgba(99, 102, 241, ${Math.min(
                              data.retention_percentage / 100,
                              0.8
                            )})`
                            : "transparent",
                          color:
                            data && data.retention_percentage > 50
                              ? "white"
                              : "#334155",
                        }}
                      >
                        {data
                          ? `${data.retention_percentage}%`
                          : "-"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>











  )
}

export default App
