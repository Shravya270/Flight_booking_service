const axios = require('axios');
const {BookingRepository} = require('../repositories')
const bookingRepository = new BookingRepository();
const db = require('../models')
const {ServerConfig} = require('../config');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');
const {BOOKING_STATUS} = require('../utils/common/enums');
const {BOOKED,CANCELLED} = BOOKING_STATUS;

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
/**
 * Creates a new flight booking while maintaining data consistency using a database transaction.
 * 
 * Function: createBooking(data)
 * 
 * Purpose:
 * Handles the process of booking a flight — verifies seat availability, calculates cost, 
 * creates a booking record in the database, and updates seat count in the Flight Service.
 * Uses a Sequelize transaction to ensure that all related operations succeed or fail together.
 * 
 * Steps:
 * 1. Starts a Sequelize transaction to ensure atomicity.
 * 2. Fetches flight details (like totalSeats and price) from the FLIGHT SERVICE via an API call.
 * 3. Checks if enough seats are available:
 *      - If not, throws an AppError (400 Bad Request).
 * 4. Calculates the total booking cost → (noOfSeats × flight price).
 * 5. Creates a new booking record in the local Booking Service database inside the transaction.
 * 6. Sends a PATCH request to the Flight Service to reduce the available seat count.
 * 7. Commits the transaction if all steps succeed.
 * 8. If any step fails, rolls back the transaction to revert database changes for consistency.
 * 
 * Error Handling:
 * - Rolls back the transaction on any failure (API error, DB error, etc.).
 * - Throws the caught error back to the service/controller layer for proper response handling.
 * 
 * Outcome:
 * Ensures that a booking is only confirmed if both:
 *   - The booking record is created successfully, AND
 *   - The flight’s seat count is updated successfully.
 */


async function makePayment(data){
    const transaction = await db.sequelize.transaction();
    try{
        const bookingDetails = await bookingRepository.get(data.bookingId,transaction)
        if(bookingDetails.status == CANCELLED){
            throw new AppError('The booking time has expired',StatusCodes.BAD_REQUEST);

        }
        const bookingTime = new Date(bookingDetails.createdAt);
        const currentTime = new Date();

        if(currentTime-bookingTime > 300000){
            await cancelBooking(data.bookingId);
            throw new AppError('The booking time has expired',StatusCodes.BAD_REQUEST);
        }
        if(bookingDetails.totalCost !== Number(data.totalCost)){
            throw new AppError('The amount of the payment does not match',StatusCodes.BAD_REQUEST);
        }
        

        if(bookingDetails.userId !== Number(data.userId)){
            throw new AppError('The user corresponding to the booking does not match',StatusCodes.BAD_REQUEST);
        }

        await bookingRepository.update(data.bookingId,{status:BOOKED},transaction);
        await transaction.commit();
        //we assume that then payment is successful
    }
    catch(error){
        await transaction.rollback();
        throw error;
    }
}

async function cancelBooking(bookingId){
    const transaction = await db.sequelize.transaction();

    try{
        const bookingDetails = await bookingRepository.get(bookingId,transaction);
        if(bookingDetails.status==CANCELLED){
            await transaction.commit();
            return true;
        }
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}/seats`,{
                seats:bookingDetails.noOfSeats,
                dec:0,
            });
            await bookingRepository.update(bookingId, {status:CANCELLED},transaction);
            await transaction.commit();
    }
    catch(error){
        await transaction.rollback();
        throw error;
    }
}



module.exports = {
    createBooking,
    makePayment,
    cancelBooking
}