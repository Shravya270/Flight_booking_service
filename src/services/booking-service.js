const axios = require('axios');
const {BookingRepository} = require('../repositories')
const bookingRepository = new BookingRepository();
const db = require('../models')
const {ServerConfig} = require('../config');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');

/* why use transaction while booking the flight?
This involves multiple steps that must succeed together:
1. Fetch flight details
2. Check available seats
3. Create a booking record
4. Decrease available seats in Flight table

*/
async function createBooking(data){
    const transaction = await db.sequelize.transaction();
    try{
            const flight =  await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`);
            const flightData = flight.data.data;
            if(data.noOfSeats > flightData.totalSeats){
                throw new AppError('Not enough seats available',StatusCodes.BAD_REQUEST);
            }
            const totalBillingAmount = data.noOfSeats * flightData.price;
            const bookingPayLoad = {...data,totalCost:totalBillingAmount};
            const booking = await bookingRepository.create(bookingPayLoad,transaction)

            await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`,{
                seats:data.noOfSeats
            })
            
            await transaction.commit();
            return booking;
    }catch(error){
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    createBooking,
}