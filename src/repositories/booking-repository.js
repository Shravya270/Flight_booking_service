const { StatusCodes } = require('http-status-codes');
const CrudRepository = require('./crud-repository');
const { Op } = require('sequelize');
const { Booking } = require('../models');
const {BOOKING_STATUS} = require('../utils/common/enums')
const {CANCELLED,BOOKED} = BOOKING_STATUS;
const AppError = require('../utils/errors/app-error');

class BookingRepository extends CrudRepository {
    constructor() {
        super(Booking);
    }

    async createBooking(data, transaction) {
        return await Booking.create(data, { transaction });
    }

    async get(data, transaction) {
        const response = await Booking.findByPk(data, { transaction });
        if (!response) {
            throw new AppError('Not able to find the resource', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    async update(id, data, transaction) {
        const response = await Booking.update(data, {
            where: { id },
            transaction,
        });
        if (!response) {
            throw new AppError('Resource not found', StatusCodes.NOT_FOUND);
        }
        return response;
    }

    async cancelOldBookings(timestamp) {
        // Find all bookings created before timestamp and not already cancelled
        const response = await Booking.update({status:CANCELLED},{
            where: {
                [Op.and]:[
                    {
                        createdAt: {
                            [Op.lt]: timestamp, // older than 5 minutes
                        },
                    },
                    {
                        status:{
                            [Op.ne]:BOOKED
                        }
                    },
                    {
                        status:{
                            [Op.ne]:CANCELLED
                        }
                    }
                ]
                
            },
        });
        return response;
    }
}

module.exports = BookingRepository;
