const express = require('express')
const {
  deleteAllAttendance,
  deleteAttendance,
  getAttendance,
  syncAttendance,
} = require('../controllers/attendance.controller')

const router = express.Router()

router.get('/', getAttendance)
router.post('/sync', syncAttendance)
router.delete('/delete', deleteAttendance)
router.delete('/delete-all', deleteAllAttendance)

module.exports = router
