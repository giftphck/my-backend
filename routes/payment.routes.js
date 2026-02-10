const express = require('express')
const router = express.Router()
const supabase = require('../config/supabase')
const bcrypt = require('bcrypt')
const authMiddleware = require('../middleware/auth.middleware')
/**
 * POST /api/payments
 * Create payment with overpayment protection
 */
router.post('/', async (req, res) => {
  try {

    const { booking_id, amount, payment_method, note } = req.body;

    // 🔒 Validate input
    if (!booking_id) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    const paymentAmount = Number(amount);

    // 1️⃣ Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_amount, status')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // 2️⃣ Get existing payments
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('amount')
      .eq('booking_id', booking_id);

    if (paymentError) {
      return res.status(400).json(paymentError);
    }

    const paidSoFar = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    const remaining = booking.total_amount - paidSoFar;

    // 3️⃣ Prevent overpayment
    if (paymentAmount > remaining) {
      return res.status(400).json({
        message: 'Payment exceeds remaining balance',
        remaining_balance: remaining
      });
    }

    // 4️⃣ Insert payment
    const { data: newPayment, error: insertError } = await supabase
      .from('payments')
      .insert([{
        booking_id,
        amount: paymentAmount,
        payment_method,
        note
      }])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json(insertError);
    }

    const newRemaining = remaining - paymentAmount;

    // 5️⃣ Auto update booking status if fully paid
    if (newRemaining === 0) {
      await supabase
        .from('bookings')
        .update({ status: 'PAID' })
        .eq('id', booking_id);
    }

    res.json({
      payment: newPayment,
      paid_total: paidSoFar + paymentAmount,
      remaining_balance: newRemaining,
      fully_paid: newRemaining === 0
    });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});


/**
 * GET /api/payments/booking/:id
 * Get all payments for a booking
 */
router.get('/booking/:id', async (req, res) => {
  try {

    const { id } = req.params;

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .order('payment_date', { ascending: true });

    if (error) return res.status(400).json(error);

    res.json(data);

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});


/**
 * DELETE /api/payments/:id
 * (Optional) Delete payment
 */
router.delete('/:id', async (req, res) => {
  try {

    const { id } = req.params;

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json(error);

    res.json({ message: 'Payment deleted' });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});


/**
 * POST /api/payments/refund
 * Create refund transaction
 */
router.post('/refund', async (req, res) => {
  try {

    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({ message: 'Payment ID required' });
    }

    // 1️⃣ หา payment เดิม
    const { data: original, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (error || !original) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // 2️⃣ เช็คว่าคืนไปแล้วหรือยัง
    const { data: existingRefund } = await supabase
      .from('payments')
      .select('id')
      .eq('reference_id', payment_id);

    if (existingRefund.length > 0) {
      return res.status(400).json({
        message: 'Payment already refunded'
      });
    }

    // 3️⃣ สร้าง refund (จำนวนติดลบ)
    const { data: refund, error: insertError } = await supabase
      .from('payments')
      .insert([{
        booking_id: original.booking_id,
        amount: -original.amount,
        payment_method: original.payment_method,
        type: 'REFUND',
        reference_id: payment_id
      }])
      .select()
      .single();

    if (insertError) {
      return res.status(400).json(insertError);
    }

    res.json({
      message: 'Refund successful',
      refund
    });

  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
});



module.exports = router;
