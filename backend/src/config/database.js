const { Pool } = require('pg');

require('dotenv').config();


// ============================================================
// DATABASE CONNECTION CONFIGURATION
// ============================================================
//
// Supports two configurations:
//
// 1. DATABASE_URL
//    Used by hosted PostgreSQL services such as:
//    Render, Railway, Neon, Supabase, etc.
//
// 2. Individual DB_* variables
//    Used for local PostgreSQL development.
//
// DATABASE_URL takes priority when it is available.
// ============================================================


let connectionConfig;


// ============================================================
// HOSTED DATABASE
// ============================================================

if (process.env.DATABASE_URL) {

  connectionConfig = {
    connectionString:
      process.env.DATABASE_URL,

    // Most hosted PostgreSQL providers require SSL.
    //
    // DB_SSL=false can be used when SSL should explicitly
    // be disabled.
    ssl:
      process.env.DB_SSL === 'false'
        ? false
        : {
            rejectUnauthorized: false
          }
  };


// ============================================================
// LOCAL DATABASE
// ============================================================

} else {

  connectionConfig = {

    host:
      process.env.DB_HOST || 'localhost',

    port:
      Number(
        process.env.DB_PORT || 5432
      ),

    database:
      process.env.DB_NAME,

    user:
      process.env.DB_USER,

    password:
      process.env.DB_PASSWORD

  };

}


// ============================================================
// CREATE CONNECTION POOL
// ============================================================
//
// A connection pool keeps reusable PostgreSQL connections.
//
// This is more efficient than opening a new database
// connection for every request.
// ============================================================

const pool = new Pool({

  ...connectionConfig,

  // Maximum number of simultaneous database connections.
  max:
    Number(
      process.env.DB_POOL_MAX || 10
    ),

  // Close connections that remain idle for 30 seconds.
  idleTimeoutMillis:
    Number(
      process.env.DB_IDLE_TIMEOUT || 30000
    ),

  // Stop waiting if PostgreSQL cannot be reached within 5 sec.
  connectionTimeoutMillis:
    Number(
      process.env.DB_CONNECTION_TIMEOUT || 5000
    )

});


// ============================================================
// CONNECTION EVENT
// ============================================================
//
// This fires when a connection is established and added to
// the pool.
// ============================================================

pool.on(
  'connect',
  () => {

    console.log(
      '[INFO] PostgreSQL pool connected'
    );

  }
);


// ============================================================
// POOL ERROR
// ============================================================
//
// Handles unexpected errors from idle database clients.
// ============================================================

pool.on(
  'error',
  (err) => {

    console.error(
      '[ERROR] Unexpected PostgreSQL pool error:',
      err.message
    );

  }
);


// ============================================================
// OPTIONAL STARTUP DATABASE TEST
// ============================================================
//
// Do not prevent the server from starting here.
//
// The application can start first and report a useful error
// if a database request is made while PostgreSQL is unavailable.
// ============================================================


// ============================================================
// EXPORT
// ============================================================

module.exports = pool;