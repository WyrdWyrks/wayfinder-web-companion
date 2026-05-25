import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@emotion/react'
import { createTheme } from '@mui/material'

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  components: {
    MuiCircularProgress: {
      styleOverrides: {
        root: {
          transition: 'none',
        }
      }
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
