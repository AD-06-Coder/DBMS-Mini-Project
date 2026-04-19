const sql = require('mssql/msnodesqlv8');
require('dotenv').config();

// Robust ODBC Connection String that bypasses the need for TCP/IP to be enabled
// Uses local Shared Memory / Named Pipes with Windows Authentication
const connectionString = 'Driver={ODBC Driver 17 for SQL Server};Server=(local);Database=PlacementTrackerDB;Trusted_Connection=yes;';

const poolPromise = new sql.ConnectionPool({ connectionString })
    .connect()
    .then(pool => {
        console.log('Connected to MS SQL Database using Windows Authentication');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! Bad Config: ', err);
        console.error('Make sure MS SQL Server is running and allows Windows Authentication connections.');
    });

module.exports = {
    sql, poolPromise
};
