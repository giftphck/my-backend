const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const supabase = require('../config/supabase')

exports.login = async (req, res) => {
  const { email, password } = req.body

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (!user) return res.status(401).json({ message: 'Invalid credentials' })

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' })

  const accessToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )

  await supabase.from('refresh_tokens').insert([
    { user_id: user.id, token: refreshToken }
  ])

  res.json({ accessToken, refreshToken })
}

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' })

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

    const { data: stored } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .single()

    if (!stored) return res.status(403).json({ message: 'Refresh token revoked' })

    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    )

    res.json({ accessToken: newAccessToken })

  } catch {
    res.status(403).json({ message: 'Invalid refresh token' })
  }
}

exports.logout = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' })

  await supabase.from('refresh_tokens')
    .delete()
    .eq('token', refreshToken)

  res.json({ message: 'Logged out successfully' })
}
