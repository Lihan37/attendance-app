import axios from 'axios'

function getApiError(error) {
  return new Error(error.response?.data?.message || error.message)
}

export function normalizeBaseUrl(baseUrl) {
  const value = String(baseUrl || '').trim()
  return value.replace(/\/+$/, '')
}

export async function fetchUsersFromApi(baseUrl) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.get(`${target}/api/users`)
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function fetchAttendanceFromApi(baseUrl) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.get(`${target}/api/attendance`)
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function syncUsersToApi(baseUrl, users) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.post(`${target}/api/users/sync`, { users })
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function syncAttendanceToApi(baseUrl, logs) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.post(`${target}/api/attendance/sync`, { logs })
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function deleteUserFromApi(baseUrl, user) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.delete(`${target}/api/users/delete`, { data: user })
    return data
  } catch (error) {
    throw getApiError(error)
  }
}

export async function deleteAttendanceFromApi(baseUrl, log) {
  const target = normalizeBaseUrl(baseUrl)
  if (!target) throw new Error('Backend Base URL is required.')
  try {
    const { data } = await axios.delete(`${target}/api/attendance/delete`, { data: log })
    return data
  } catch (error) {
    throw getApiError(error)
  }
}
