const express = require('express')
const {
  deleteAttendance,
  getAttendance,
  syncAttendance,
} = require('../controllers/attendance.controller')

const router = express.Router()

router.get('/', getAttendance)
router.post('/sync', syncAttendance)
router.delete('/delete', deleteAttendance)

module.exports = router
