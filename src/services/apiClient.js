import axios from 'axios'

export function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim()
  return value.replace(/\/+$/, '')
}

export async function fetchUsersFromApi(baseUrl) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.get(`${target}/api/users`)
  return data
}

export async function fetchAttendanceFromApi(baseUrl) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.get(`${target}/api/attendance`)
  return data
}

export async function syncUsersToApi(baseUrl, users) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.post(`${target}/api/users/sync`, { users })
  return data
}

export async function syncAttendanceToApi(baseUrl, logs) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.post(`${target}/api/attendance/sync`, { logs })
  return data
}

export async function deleteUserFromApi(baseUrl, user) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.delete(`${target}/api/users/delete`, { data: user })
  return data
}

export async function deleteAttendanceFromApi(baseUrl, log) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  const { data } = await axios.delete(`${target}/api/attendance/delete`, { data: log })
  return data
}
