-- Database Schema Update for Enhanced A2P 10DLC Compliance Monitoring
-- Run this script to add new fields to your existing messages table

-- Add new compliance monitoring fields
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(32),
ADD COLUMN IF NOT EXISTS has_special_chars BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contains_emojis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_long_message BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for better query performance on compliance monitoring
CREATE INDEX IF NOT EXISTS idx_messages_content_hash ON messages(content_hash);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sms_count ON messages(sms_count);
CREATE INDEX IF NOT EXISTS idx_messages_is_long_message ON messages(is_long_message);

-- Add a view for compliance reporting
CREATE OR REPLACE VIEW compliance_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_messages,
    SUM(sms_count) as total_sms_sent,
    COUNT(CASE WHEN is_long_message THEN 1 END) as long_messages,
    COUNT(CASE WHEN has_special_chars THEN 1 END) as messages_with_special_chars,
    COUNT(CASE WHEN contains_emojis THEN 1 END) as messages_with_emojis,
    AVG(word_count) as avg_words_per_message,
    AVG(LENGTH(message)) as avg_message_length
FROM messages 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Add a view for user behavior analysis
CREATE OR REPLACE VIEW user_behavior_analysis AS
SELECT 
    phone_number,
    COUNT(*) as message_count,
    SUM(sms_count) as total_sms_used,
    MAX(created_at) as last_activity,
    AVG(LENGTH(message)) as avg_message_length,
    COUNT(CASE WHEN is_long_message THEN 1 END) as long_message_count,
    COUNT(CASE WHEN has_special_chars THEN 1 END) as special_char_count
FROM messages 
GROUP BY phone_number
ORDER BY message_count DESC;

-- Add a view for A2P 10DLC compliance monitoring
CREATE OR REPLACE VIEW a2p_compliance_status AS
SELECT 
    'Content Compliance' as compliance_area,
    COUNT(*) as total_checked,
    COUNT(CASE WHEN content_hash IS NOT NULL THEN 1 END) as properly_hashed,
    COUNT(CASE WHEN has_special_chars = FALSE THEN 1 END) as clean_content,
    COUNT(CASE WHEN contains_emojis = FALSE THEN 1 END) as no_emojis
FROM messages
UNION ALL
SELECT 
    'Message Length Compliance' as compliance_area,
    COUNT(*) as total_checked,
    COUNT(CASE WHEN LENGTH(message) <= 480 THEN 1 END) as within_limits,
    COUNT(CASE WHEN is_long_message = FALSE THEN 1 END) as single_sms,
    COUNT(CASE WHEN sms_count <= 3 THEN 1 END) as proper_segmentation
FROM messages
UNION ALL
SELECT 
    'User Consent Compliance' as compliance_area,
    COUNT(*) as total_checked,
    COUNT(CASE WHEN consent_confirmed = TRUE THEN 1 END) as consent_given,
    COUNT(CASE WHEN ip_address != 'unknown' THEN 1 END) as ip_tracked,
    COUNT(CASE WHEN user_agent != 'unknown' THEN 1 END) as user_agent_tracked
FROM messages;

-- Add a function to get compliance statistics
CREATE OR REPLACE FUNCTION get_compliance_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
    metric_name TEXT,
    metric_value BIGINT,
    compliance_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Total Messages'::TEXT,
        COUNT(*)::BIGINT,
        100.0::NUMERIC
    FROM messages 
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    
    UNION ALL
    
    SELECT 
        'Messages with Hyperlinks'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM messages WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL))::NUMERIC
    FROM messages 
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    AND message ~* 'https?://|www\.|[^\s]+\.[a-z]{2,}'
    
    UNION ALL
    
    SELECT 
        'Messages with Phone Numbers'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM messages WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL))::NUMERIC
    FROM messages 
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    AND message ~* '\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}|\b\d{10}\b'
    
    UNION ALL
    
    SELECT 
        'Long Messages (>160 chars)'::TEXT,
        COUNT(*)::BIGINT,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM messages WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL))::NUMERIC
    FROM messages 
    WHERE created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
    AND LENGTH(message) > 160;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON compliance_summary TO your_app_user;
-- GRANT SELECT ON user_behavior_analysis TO your_app_user;
-- GRANT SELECT ON a2p_compliance_status TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_compliance_stats TO your_app_user;

-- Example queries for monitoring:

-- 1. Check recent compliance violations
-- SELECT * FROM messages 
-- WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
-- AND (message ~* 'https?://|www\.' OR message ~* '\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}');

-- 2. Monitor SMS usage patterns
-- SELECT DATE(created_at), SUM(sms_count) as daily_sms_usage
-- FROM messages 
-- WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;

-- 3. Check user consent compliance
-- SELECT COUNT(*) as total_messages,
--        COUNT(CASE WHEN consent_confirmed = TRUE THEN 1 END) as with_consent,
--        COUNT(CASE WHEN consent_confirmed = FALSE THEN 1 END) as without_consent
-- FROM messages 
-- WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
