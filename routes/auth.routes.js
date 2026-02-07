const express = require('express')
const router = express.Router()
const authController = require('../controllers/auth.controller')
const authMiddleware = require('../middleware/auth.middleware')

router.post('/login', authController.login)
router.post('/refresh', authController.refresh)
router.post('/logout', authController.logout)

router.get('/profile', authMiddleware, (req, res) => {
  res.json({ message: 'Access granted', user: req.user })
})

module.exports = router
