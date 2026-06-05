const express = require('express')
const {
  deleteAllUsers,
  deleteUser,
  getUsers,
  syncUsers,
} = require('../controllers/users.controller')

const router = express.Router()

router.get('/', getUsers)
router.post('/sync', syncUsers)
router.delete('/delete', deleteUser)
router.delete('/delete-all', deleteAllUsers)

module.exports = router
