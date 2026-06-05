export default function FormField({ label, ...props }) {
  return (
    <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
      <span className="w-28 shrink-0">{label}</span>
      <input
        className="h-9 flex-1 rounded-sm border border-gray-400 bg-white px-3 text-gray-900 outline-none transition focus:border-[#008b88] focus:ring-2 focus:ring-teal-100"
        {...props}
      />
    </label>
  )
}
