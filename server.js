require('dotenv').config()

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')

const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const paymentRoutes = require('./routes/payment.routes') // อย่าลืม require ด้วยนะ
const bookingRoutes = require('./routes/booking.routes') // อย่าลืม require ด้วยนะ

const app = express()  // 🔥 ต้องสร้างก่อนใช้

app.use(cors({
  origin: [
    'http://localhost:4200',
    'https://hotel-awd-5oz7.vercel.app'
  ],
  credentials: true
}))

app.use(express.json())
app.use(cookieParser())

app.use('/api', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/bookings',  bookingRoutes)
const roomRoutes = require('./routes/room.routes');
app.use('/api/rooms', roomRoutes);


app.get('/', (req, res) => {
  res.send('Backend connected 🚀')
})



const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
