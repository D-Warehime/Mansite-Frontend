import React, { useRef, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

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
  },
});

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      } else {
        setSubmitStatus(`Error: ${data.error || 'Failed to send message'}`);
      }
    } catch (error) {
      setSubmitStatus('Error: Failed to connect to server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container style={{ textAlign: 'center', paddingTop: '50px' }}>
        <Typography variant="h1" gutterBottom>Mansite</Typography>
        <Typography variant="h5" gutterBottom>Alibi for your wife (as a joke)</Typography>
        <Typography variant="h5" gutterBottom>Just save the contact details as that of a friend</Typography>
        <form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <TextField 
            label="Your Phone Number" 
            variant="outlined" 
            fullWidth 
            margin="normal"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
          <TextField 
            label="Message" 
            variant="outlined" 
            fullWidth 
            margin="normal"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <Typography variant="body2" gutterBottom>Standard message rates apply.</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            type="submit"
            disabled={isSubmitting}
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