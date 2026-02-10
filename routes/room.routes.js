const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

router.get('/', async (req, res) => {
    try {

        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .order('room_number', { ascending: true });

        if (error) return res.status(400).json(error);

        res.json(data);

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});


// POST create room
router.post('/', async (req, res) => {
    try {
        const { roomNumber, conditionStatus } = req.body;

        if (!roomNumber) {
            return res.status(400).json({ message: 'Room number required' });
        }

        const { data: existing } = await supabase
            .from('rooms')
            .select('id')
            .eq('room_number', roomNumber)
            .single();

        if (existing) {
            return res.status(400).json({ message: 'Room already exists' });
        }

        const { data, error } = await supabase
            .from('rooms')
            .insert([
                {
                    room_number: roomNumber,
                    condition_status: conditionStatus || 'NORMAL'
                }
            ])
            .select();

        if (error) return res.status(400).json(error);

        res.status(201).json(data[0]);

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});


/**
 * DELETE /api/rooms/:id
 * Delete room
 */
router.delete('/:id', async (req, res) => {
    try {
        console.log('ROOM ROUTE LOADED')

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: 'Room ID is required' });
        }
        const { data: bookings } = await supabase
            .from('bookings')
            .select('id')
            .eq('room_id', id);

        if (bookings.length > 0) {
            return res.status(400).json({
                message: 'Cannot delete room with existing bookings'
            });
        }

        const { error } = await supabase
            .from('rooms')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json(error);
        }

        res.json({ message: 'Room deleted successfully' });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
});




module.exports = router;
