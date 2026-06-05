export default function StatusMessage({ message }) {
  if (!message?.text) {
    return null
  }

  const styles =
    message.type === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : message.type === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-sky-200 bg-sky-50 text-sky-700'

  return (
    <div className={`rounded-md border px-4 py-2 text-sm shadow-sm ${styles}`}>
      {message.text}
    </div>
  )
}
