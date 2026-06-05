export default function DataTable({ activeTab, users, attendance, onDeleteRow }) {
  const isUsers = activeTab === 'users'
  const rows = isUsers ? users : attendance

  function formatTimestamp(value) {
    if (!value) return ''

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const pad = (number) => String(number).padStart(2, '0')

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  return (
    <div className="data-table-scroll mt-4 border border-gray-300 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#008b88] text-white">
          <tr>
            <th className="w-16 border-r border-teal-700 px-4 py-3 font-semibold">Sl.</th>
            <th className="w-40 border-r border-teal-700 px-4 py-3 font-semibold">User ID</th>
            {isUsers ? (
              <>
                <th className="border-r border-teal-700 px-4 py-3 font-semibold">Name</th>
                <th className="w-52 border-r border-teal-700 px-4 py-3 font-semibold">Card Number</th>
              </>
            ) : (
              <>
                <th className="border-r border-teal-700 px-4 py-3 font-semibold">Timestamp</th>
                <th className="w-52 border-r border-teal-700 px-4 py-3 font-semibold">Verify Type</th>
              </>
            )}
            <th className="w-32 px-4 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-gray-500" colSpan={5}>
                No devices added. Click the + button to add a device.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr className="border-t border-gray-200 odd:bg-gray-50" key={row._id || `${row.userId}-${index}`}>
                <td className="border-r border-gray-200 px-4 py-3">{index + 1}</td>
                <td className="border-r border-gray-200 px-4 py-3">{row.userId}</td>
                {isUsers ? (
                  <>
                    <td className="border-r border-gray-200 px-4 py-3">{row.name}</td>
                    <td className="border-r border-gray-200 px-4 py-3">{row.cardNumber}</td>
                  </>
                ) : (
                  <>
                    <td className="border-r border-gray-200 px-4 py-3">
                      {formatTimestamp(row.timestamp)}
                    </td>
                    <td className="border-r border-gray-200 px-4 py-3">{row.verifyType}</td>
                  </>
                )}
                <td className="px-4 py-3">
                  <button
                    className="rounded-full border border-red-300 bg-red-50 px-4 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                    type="button"
                    onClick={() => onDeleteRow?.(row)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
