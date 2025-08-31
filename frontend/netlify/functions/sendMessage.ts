import { Handler } from '@netlify/functions';
import Telnyx from 'telnyx';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER,         
  host: process.env.DB_HOST,       
  database: process.env.DB_NAME,   
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false, // Required for some PostgreSQL hosting providers
    require: true
  }
});

export const handler: Handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Add logging to debug environment variables
    console.log('Checking environment variables...');
    console.log('DB_HOST:', process.env.DB_HOST ? 'Set' : 'Not set');
    console.log('DB_NAME:', process.env.DB_NAME ? 'Set' : 'Not set');
    console.log('TELNYX_API_KEY:', process.env.TELNYX_API_KEY ? 'Set' : 'Not set');
    console.log('TELNYX_PHONE_NUMBER:', process.env.TELNYX_PHONE_NUMBER ? 'Set' : 'Not set');

    // Add debug logging
    console.log('Environment variables check:');
    console.log('TELNYX_PHONE_NUMBER:', process.env.TELNYX_PHONE_NUMBER);
    console.log('TELNYX_API_KEY exists:', !!process.env.TELNYX_API_KEY);

    if (!event.body) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ error: 'No body provided' }) 
      };
    }

    const { phoneNumber, message } = JSON.parse(event.body);
    const ipAddress = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';
    console.log('Received request:', { phoneNumber, message: 'REDACTED' });

    if (!phoneNumber || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Phone number and message are required' }),
      };
    }

    if (!process.env.TELNYX_API_KEY) {
      throw new Error('TELNYX_API_KEY is required');
    }

    // Add try/catch blocks around each major operation
    try {
      console.log('Attempting database connection...');
      let dbResult;
      try {
        dbResult = await pool.query(
          'INSERT INTO messages (phone_number, message, ip_address, user_agent, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [phoneNumber, message, ipAddress, userAgent, 'pending']
        );
        console.log('Database insert successful');
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue with message sending even if DB fails
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    try {
      console.info(`Attempting Telnyx message send with from: ${process.env.TELNYX_PHONE_NUMBER}`);
      const telnyxClient = new Telnyx(process.env.TELNYX_API_KEY);
      const messageResponse = await telnyxClient.messages.create({
        from: process.env.TELNYX_PHONE_NUMBER,
        to: phoneNumber,
        text: message,
        messaging_profile_id: "YOUR_PROFILE_ID",
        traffic_type: "P2P"
      });
      console.info("Full Telnyx response:", JSON.stringify(messageResponse, null, 2));

      // Check message status
      if (messageResponse.data.to[0].status === 'queued') {
        console.info("Message successfully queued");
        
        // Update database if we have a dbResult
        if (dbResult?.rows?.[0]?.id) {
          try {
            await pool.query(
              'UPDATE messages SET status = $1 WHERE id = $2',
              ['queued', dbResult.rows[0].id]
            );
          } catch (dbError) {
            console.error("Error updating database:", dbError);
            // Continue even if DB update fails
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true, 
            message: "Message queued successfully",
            messageId: messageResponse.data.id
          })
        };
      } else {
        console.error("Message not queued:", messageResponse.data.to[0].status);
        throw new Error(`Message status: ${messageResponse.data.to[0].status}`);
      }
    } catch (telnyxError) {
      console.error('Telnyx error details:', telnyxError.raw?.errors);
      throw new Error(`Telnyx error: ${telnyxError.message}`);
    }
  } catch (error) {
    console.error('Error details:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 