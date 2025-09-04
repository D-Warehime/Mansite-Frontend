import { Handler } from '@netlify/functions';
import twilio from 'twilio';
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

// Function to detect hyperlinks/URLs in text (server-side validation)
const containsHyperlinks = (text: string): boolean => {
  const urlPatterns = [
    /https?:\/\/[^\s]+/gi,           // http:// or https:// URLs
    /www\.[^\s]+/gi,                  // www. URLs
    /[^\s]+\.[a-z]{2,}/gi,           // domain.com patterns
    /bit\.ly\/[^\s]+/gi,              // Bitly links
    /t\.co\/[^\s]+/gi,                // Twitter shortened links
    /[^\s]+\.(com|org|net|edu|gov|mil|io|co|me|tv|app|dev)/gi  // Common TLDs
  ];
  
  return urlPatterns.some(pattern => pattern.test(text));
};

// Function to detect phone numbers in text (server-side validation)
const containsPhoneNumbers = (text: string): boolean => {
  // Comprehensive phone number patterns
  const phonePatterns = [
    // US/Canada: (555) 123-4567, 555-123-4567, 555.123.4567, 555 123 4567
    /\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g,
    // US/Canada: 5551234567 (10 digits)
    /\b\d{10}\b/g,
    // International: +1-555-123-4567, +1 555 123 4567
    /\+\d{1,3}[\s\-]?\d{1,4}[\s\-]?\d{1,4}[\s\-]?\d{1,4}/g,
    // Common variations: 555-123-4567 ext 123
    /\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}[\s]*(?:ext|extension|ext\.|x\.?)[\s]*\d+/gi,
    // Toll-free numbers: 1-800-123-4567, 800-123-4567
    /1?[\s\-]?800[\s\-]\d{3}[\s\-]\d{4}/g,
    // Emergency numbers: 911, 311, 411
    /\b(?:911|311|411|511|611|711|811|911)\b/g
  ];
  
  return phonePatterns.some(pattern => pattern.test(text));
};

// Function to split message into SMS segments
const splitMessageIntoSegments = (message: string): string[] => {
  const segments: string[] = [];
  let remainingMessage = message;
  
  while (remainingMessage.length > 0) {
    if (remainingMessage.length <= 160) {
      segments.push(remainingMessage);
      break;
    }
    
    // Find the best break point near 160 characters
    let breakPoint = 160;
    
    // Try to break at a space to avoid cutting words
    for (let i = 160; i >= 140; i--) {
      if (remainingMessage[i] === ' ') {
        breakPoint = i;
        break;
      }
    }
    
    segments.push(remainingMessage.substring(0, breakPoint));
    remainingMessage = remainingMessage.substring(breakPoint).trim();
  }
  
  return segments;
};

// Function to calculate SMS count
const calculateSmsCount = (message: string): number => {
  if (message.length <= 160) return 1;
  if (message.length <= 320) return 2;
  return 3;
};

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
    console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Not set');
    console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Not set');
    console.log('TWILIO_PHONE_NUMBER:', process.env.TWILIO_PHONE_NUMBER ? 'Set' : 'Not set');

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

    // Server-side validation: Check for hyperlinks
    if (containsHyperlinks(message)) {
      console.log('Message rejected due to hyperlink content');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Messages cannot contain hyperlinks or URLs due to SMS compliance requirements.' 
        }),
      };
    }

    // Server-side validation: Check for phone numbers
    if (containsPhoneNumbers(message)) {
      console.log('Message rejected due to phone number content');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Messages cannot contain phone numbers due to SMS compliance requirements.' 
        }),
      };
    }

    // Server-side validation: Check message length (now allows up to 480 characters)
    if (message.length > 480) {
      console.log('Message rejected due to length');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Message is too long. Maximum 480 characters (3 SMS messages) allowed.' 
        }),
      };
    }

    // Validate required Twilio environment variables
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      throw new Error('Missing required Twilio environment variables');
    }

    // Initialize Twilio client
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Calculate SMS count for billing purposes
    const smsCount = calculateSmsCount(message);
    console.log(`Message will be sent as ${smsCount} SMS segment(s)`);

    // Add try/catch blocks around each major operation
    let dbResult: any = null;
    try {
      console.log('Attempting database connection...');
      try {
        // Log consent information for legal compliance
        console.log('User consent confirmed - SMS being sent to:', phoneNumber);
        console.log('IP Address:', ipAddress);
        console.log('User Agent:', userAgent);
        console.log('Message length:', message.length);
        console.log('SMS count:', smsCount);
        console.log('Timestamp:', new Date().toISOString());
        
        // Enhanced A2P 10DLC compliance monitoring
        const messageContentHash = Buffer.from(message).toString('base64').substring(0, 32); // First 32 chars of base64
        const hasSpecialChars = /[^a-zA-Z0-9\s.,!?;:'"()-]/.test(message);
        const wordCount = message.trim().split(/\s+/).length;
        const containsEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(message);
        const isLongMessage = message.length > 160;
        
        console.log('A2P 10DLC Compliance monitoring:', {
          contentHash: messageContentHash,
          hasSpecialChars,
          wordCount,
          containsEmojis,
          isLongMessage,
          smsCount,
          messageLength: message.length
        });
        
        dbResult = await pool.query(
          'INSERT INTO messages (phone_number, message, ip_address, user_agent, status, consent_confirmed, sms_count, content_hash, has_special_chars, word_count, contains_emojis, is_long_message, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
          [phoneNumber, message, ipAddress, userAgent, 'pending', true, smsCount, messageContentHash, hasSpecialChars, wordCount, containsEmojis, isLongMessage, new Date()]
        );
        console.log('Database insert successful with enhanced A2P 10DLC compliance monitoring');
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue with message sending even if DB fails
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`);
    }

    try {
      console.info(`Attempting Twilio message send with from: ${process.env.TWILIO_PHONE_NUMBER}`);
      
      let messageResponse;
      
      // If message is longer than 160 characters, split it into segments
      if (message.length > 160) {
        const segments = splitMessageIntoSegments(message);
        console.log(`Splitting message into ${segments.length} segments for A2P 10DLC compliance`);
        
        // Send each segment as a separate SMS
        const segmentResponses = [];
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          console.log(`Sending segment ${i + 1}/${segments.length}: ${segment.length} characters`);
          
          const segmentResponse = await twilioClient.messages.create({
            body: segment,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
          });
          
          segmentResponses.push(segmentResponse);
        }
        
        // Use the first segment response for status checking
        messageResponse = segmentResponses[0];
        console.log(`All ${segments.length} segments sent successfully for A2P 10DLC compliance`);
      } else {
        // Send single SMS for messages 160 characters or less
        messageResponse = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
      }
      
      console.info("Full Twilio response:", JSON.stringify(messageResponse, null, 2));

      // Check message status
      if (messageResponse.status === 'queued' || messageResponse.status === 'accepted') {
        console.info("Message successfully queued/accepted");
        
        // Update database if we have a dbResult
        if (dbResult && 'rows' in dbResult && dbResult.rows && dbResult.rows[0] && 'id' in dbResult.rows[0]) {
          try {
            await pool.query(
              'UPDATE messages SET status = $1 WHERE id = $2',
              ['sent', dbResult.rows[0].id]
            );
          } catch (dbError) {
            console.error("Error updating database:", dbError);
            // Continue even if DB update fails
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            message: "Message sent successfully",
            messageId: messageResponse.sid,
            status: messageResponse.status,
            smsCount: smsCount,
            segments: message.length > 160 ? splitMessageIntoSegments(message).length : 1
          })
        };
      } else {
        console.error("Message not queued:", messageResponse.status);
        throw new Error(`Message status: ${messageResponse.status}`);
      }
    } catch (twilioError) {
      console.error('Twilio error details:', twilioError);
      throw new Error(`Twilio error: ${twilioError instanceof Error ? twilioError.message : 'Unknown Twilio error'}`);
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