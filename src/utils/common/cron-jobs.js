var cron = require('node-cron');
const BookingService = require('../../services/booking-service')

function scheduleCrons(){
    cron.schedule('*/10 * * * * *', async()=>{
        const response = await BookingService.cancelOldBookings();
        console.log(response)
    });
}

module.exports = scheduleCrons;