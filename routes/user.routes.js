const express = require('express')
const router = express.Router()
const supabase = require('../config/supabase')
const bcrypt = require('bcrypt')
const authMiddleware = require('../middleware/auth.middleware')

// 🔥 GET users
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email')

  if (error) return res.status(400).json(error)

  res.json(data)
})


// 🔥 ADD USER
router.post('/', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing fields' })
    }

    // เช็ค email ซ้ำ
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return res.status(400).json({ message: 'Email already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword }])
      .select('id, name, email')

    if (error) return res.status(400).json(error)

    res.status(201).json(data)

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message })
  }
})

module.exports = router
