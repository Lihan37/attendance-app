const express = require('express')
const { deleteUser, getUsers, syncUsers } = require('../controllers/users.controller')

const router = express.Router()

router.get('/', getUsers)
router.post('/sync', syncUsers)
router.delete('/delete', deleteUser)

module.exports = router
