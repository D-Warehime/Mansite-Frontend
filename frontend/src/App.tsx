import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';

const theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    primary: {
      main: '#00ff00', // Green color
    },
    background: {
      default: '#000000', // Black background
      paper: '#121212', // Slightly lighter for contrast
    },
    text: {
      primary: '#00ff00', // Green text
      secondary: '#ffffff', // White text for secondary elements
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#00ff00', // Green border
            },
            '&:hover fieldset': {
              borderColor: '#00ff00', // Green border on hover
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00ff00', // Green border when focused
            },
            '& input': {
              color: '#00ff00', // Green input text
            },
            '& label': {
              color: '#00ff00', // Green label text
            },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: '#00ff00', // Green checkbox
          '&.Mui-checked': {
            color: '#00ff00', // Green when checked
          },
        },
      },
    },
  },
});

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [selfUseChecked, setSelfUseChecked] = useState(false);
  const [antiHarassmentChecked, setAntiHarassmentChecked] = useState(false);
  const [ageVerifiedChecked, setAgeVerifiedChecked] = useState(false);

  // Function to detect hyperlinks/URLs in text
  const containsHyperlinks = (text: string): boolean => {
    // Common URL patterns to detect
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

  // Function to detect phone numbers in text
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

  // Function to validate message content
  const validateMessage = (text: string): string | null => {
    if (containsHyperlinks(text)) {
      return 'Messages cannot contain hyperlinks or URLs due to SMS compliance requirements.';
    }
    
    if (containsPhoneNumbers(text)) {
      return 'Messages cannot contain phone numbers due to SMS compliance requirements.';
    }
    
    if (text.length > 480) {
      return 'Message is too long. Maximum 480 characters (3 SMS messages) allowed.';
    }
    
    return null;
  };

  // Function to calculate SMS count
  const calculateSmsCount = (text: string): number => {
    if (text.length <= 160) return 1;
    if (text.length <= 320) return 2;
    return 3;
  };

  // Function to get SMS count display text
  const getSmsCountText = (text: string): string => {
    const smsCount = calculateSmsCount(text);
    if (smsCount === 1) return '1 SMS';
    return `${smsCount} SMS messages`;
  };

  // Function to check if all consent checkboxes are checked
  const allConsentChecked = consentChecked && selfUseChecked && antiHarassmentChecked && ageVerifiedChecked;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Check if user has given all required consent
    if (!allConsentChecked) {
      setSubmitStatus('You must check all consent boxes before sending.');
      return;
    }
    
    // Validate message before submitting
    const validationError = validateMessage(message);
    if (validationError) {
      setSubmitStatus(validationError);
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`/.netlify/functions/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          message,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSubmitStatus('Message sent successfully!');
        setPhoneNumber('');
        setMessage('');
        // Reset all consent checkboxes for next use
        setConsentChecked(false);
        setSelfUseChecked(false);
        setAntiHarassmentChecked(false);
        setAgeVerifiedChecked(false);
      } else {
        setSubmitStatus(`Error: ${data.error || 'Failed to send message'}`);
      }
    } catch (error) {
      setSubmitStatus('Error: Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real-time validation feedback
  const messageValidationError = message ? validateMessage(message) : null;

  return (
    <ThemeProvider theme={theme}>
      <Container style={{ textAlign: 'center', paddingTop: '50px' }}>
        <Typography variant="h1" gutterBottom>Mansite</Typography>
        <Typography variant="h5" gutterBottom>Alibi for your wife (as a joke)</Typography>
        <Typography variant="h5" gutterBottom>Just save the contact details as that of a friend</Typography>
        
        {/* Service Purpose Warning */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'rgba(255, 68, 68, 0.1)', border: '1px solid #ff4444', borderRadius: 2 }}>
          <Typography variant="h6" color="#ff4444" gutterBottom>
            ⚠️ IMPORTANT: SELF-USE ONLY
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This service is designed EXCLUSIVELY for sending SMS messages to YOUR OWN phone number. 
            You may NOT use this service to contact others or send messages to phone numbers you do not own.
          </Typography>
        </Box>
        
        <form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <TextField 
            label="Your Phone Number" 
            variant="outlined" 
            fullWidth 
            margin="normal"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            helperText="Enter the phone number you personally own and control"
          />
          <TextField 
            label="Message" 
            variant="outlined" 
            fullWidth 
            margin="normal"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            multiline
            rows={3}
            error={!!messageValidationError}
            helperText={
              messageValidationError || 
              `${message.length}/480 characters • ${getSmsCountText(message)}`
            }
          />
          <Typography variant="body2" gutterBottom>
            Standard message rates apply. No hyperlinks, URLs, or phone numbers allowed.
            {message.length > 160 && (
              <span style={{ color: '#ffaa00' }}>
                {' '}⚠️ Long message will be sent as {getSmsCountText(message)}.
              </span>
            )}
          </Typography>
          
          {/* Enhanced Consent Checkboxes */}
          <Box sx={{ mt: 3, mb: 3, textAlign: 'left' }}>
            <Typography variant="h6" gutterBottom color="primary">
              Required Consent and Agreements
            </Typography>
            
            {/* SMS Consent */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  required
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  <strong>I consent to receive SMS messages</strong> from Mansite and acknowledge that standard message rates apply.
                </Typography>
              }
            />
            
            {/* Self-Use Agreement */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={selfUseChecked}
                  onChange={(e) => setSelfUseChecked(e.target.checked)}
                  required
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  <strong>I agree to use this service ONLY to send messages to MY OWN phone number.</strong> I will not attempt to send messages to others.
                </Typography>
              }
            />
            
            {/* Anti-Harassment Agreement */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={antiHarassmentChecked}
                  onChange={(e) => setAntiHarassmentChecked(e.target.checked)}
                  required
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  <strong>I agree not to use this service for harassment, threats, or any harmful purposes.</strong> I understand this is for entertainment only.
                </Typography>
              }
            />
            
            {/* Age Verification */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={ageVerifiedChecked}
                  onChange={(e) => setAgeVerifiedChecked(e.target.checked)}
                  required
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  <strong>I confirm I am at least 18 years old</strong> and legally able to consent to SMS services.
                </Typography>
              }
            />
          </Box>
          
          {/* Legal Disclaimer */}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, textAlign: 'left' }}>
            By using this service, you agree to our{' '}
            <Link href="/terms.html" color="primary" underline="hover" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy.html" color="primary" underline="hover" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            . This service is for entertainment purposes only. Users are responsible for compliance with applicable laws and regulations.
            {' '}Report violations{' '}
            <Link href="/report.html" color="primary" underline="hover" target="_blank" rel="noopener noreferrer">
              here
            </Link>.
          </Typography>
          
          <Button 
            variant="contained" 
            color="primary" 
            type="submit"
            disabled={isSubmitting || !!messageValidationError || !allConsentChecked}
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </Button>
          {submitStatus && (
            <Typography 
              variant="body1" 
              style={{ 
                marginTop: '1rem',
                color: submitStatus.includes('Error') ? '#ff4444' : '#00ff00'
              }}
            >
              {submitStatus}
            </Typography>
          )}
        </form>
        <Box 
          sx={{ 
            mt: 4, // margin top
            mb: 4, // margin bottom
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <img 
            src="/iphone-HVBT.png" 
            alt="iPhone Message Preview" 
            style={{
              maxWidth: '300px',
              width: '100%',
              height: 'auto',
              borderRadius: '8px',
              boxShadow: '0 4px 8px rgba(0,255,0,0.2)'
            }}
          />
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;