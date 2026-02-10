const express = require('express')
const router = express.Router()
const supabase = require('../config/supabase')
const bcrypt = require('bcrypt')
const authMiddleware = require('../middleware/auth.middleware')

// GET /api/bookings
// router.get('/', async (req, res) => {
//   try {

//     const { data, error } = await supabase
//       .from('bookings')
//       .select(`
//         id,
//         guest_name,
//         phone,
//         check_in_date,
//         check_out_date,
//         total_amount,
//         status,
//         rooms ( room_number )
//       `)
//       .order('check_in_date', { ascending: false });
//     console.log('SUPABASE ERROR:', error);

//     if (error) return res.status(400).json(error);

//     res.json(data);

//   } catch (err) {
//     res.status(500).json({
//       message: 'Server error',
//       error: err.message
//     });
//   }
// });
router.get('/', async (req, res) => {
  try {

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        guest_name,
        phone,
        check_in_date,
        check_out_date,
        total_amount,
        status,
        source,
        remark,
        rooms (
          id,
          room_number
        ),
        payments (
          id,
          amount,
          payment_method,
          type,
          reference_id,
          payment_date
        )
      `)
      .order('check_in_date', { ascending: false });

    if (error) return res.status(400).json(error);

    const mapped = data.map(b => {

      const paidAmount = (b.payments || [])
        .reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        id: b.id,
        guestName: b.guest_name,
        phone: b.phone,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        totalAmount: b.total_amount,
        status: b.status,
        source: b.source,
        remark: b.remark,
        roomId: b.rooms?.id,
        roomNumber: b.rooms?.room_number,
        payments: b.payments || [],
        paidAmount,
        balance: b.total_amount - paidAmount
      };

    });

    res.json(mapped);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});


router.post('/', async (req, res) => {
  try {
   const {
      room_id,
      guest_name,
      phone,
      check_in_date,
      check_out_date,
      total_amount,
      source,
      remark,
      deposit_amount,
      cash_amount,
      transfer_amount
    } = req.body;

    const cash = Number(cash_amount) || 0;
    const transfer = Number(transfer_amount) || 0;
    const deposit = Number(deposit_amount) || 0;
    const receivedTotal = cash + transfer;

    if (!room_id || !guest_name || !check_in_date || !check_out_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // ===============================
    // 🔥 CHECK OVERLAPPING BOOKING
    // ===============================

    const { data: conflicts, error: conflictError } = await supabase
      .from('bookings')
      .select('id, check_in_date, check_out_date')
      .eq('room_id', room_id)
      .lt('check_in_date', check_out_date)   // existing.check_in < new.check_out
      .gt('check_out_date', check_in_date); // existing.check_out > new.check_in

    if (conflictError) {
      return res.status(400).json(conflictError);
    }

    if (conflicts.length > 0) {
      return res.status(400).json({
        message: 'Room already booked for selected dates'
      });
    }



    if (deposit > total_amount) {
      return res.status(400).json({
        message: 'Deposit cannot exceed total amount'
      });
    }

    if (receivedTotal < deposit) {
      return res.status(400).json({
        message: 'Received money is less than deposit amount'
      });
    }


    let status = 'CONFIRMED';

    if (receivedTotal >= total_amount) {
      status = 'PAID';
    } else if (receivedTotal > 0) {
      status = 'PARTIAL';
    }

    // 🟢 สร้าง booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([{
        room_id,
        guest_name,
        phone,
        check_in_date,
        check_out_date,
        total_amount,
        source,
        remark,
        status: 'CONFIRMED'
      }])
      .select()
      .single();

    if (error) return res.status(400).json(error);

    // 💰 ถ้ามี deposit หรือ payment ตอนสร้าง
    const paymentsToInsert = [];

    if (deposit_amount > 0) {
      paymentsToInsert.push({
        booking_id: booking.id,
        amount: deposit_amount,
        payment_method: 'CASH',
        type: 'DEPOSIT'
      });
    }

    if (cash_amount > 0) {
      paymentsToInsert.push({
        booking_id: booking.id,
        amount: cash_amount,
        payment_method: 'CASH',
        type: 'ROOM'
      });
    }

    if (transfer_amount > 0) {
      paymentsToInsert.push({
        booking_id: booking.id,
        amount: transfer_amount,
        payment_method: 'TRANSFER',
        type: 'ROOM'
      });
    }

    if (paymentsToInsert.length > 0) {
      await supabase
        .from('payments')
        .insert(paymentsToInsert);
    }

    res.json({
      message: 'Booking created',
      booking_id: booking.id
    });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});


// GET /api/bookings/today
router.get('/today', async (req, res) => {
  try {

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        guest_name,
        check_in_date,
        check_out_date,
        total_amount,
        source,
        rooms (
          room_number
        )
      `)
      .gte('check_in_date', today.toISOString())
      .lt('check_in_date', tomorrow.toISOString());

    if (error) return res.status(400).json(error);

    const mapped = data.map(b => ({
      id: b.id,
      guestName: b.guest_name,
      roomNumber: b.rooms?.room_number,
      checkInDate: b.check_in_date,
      checkOutDate: b.check_out_date,
      totalAmount: b.total_amount,
      source: b.source
    }));

    res.json(mapped);

  } catch (err) {
    res.status(500).json({
      message: err.message
    });
  }
});



module.exports = router;   // 🔥 อันนี้แหละที่หายไป
