import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Schrift lokal ausgeliefert (kein Abruf bei Google Fonts)
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/600.css'
import '@fontsource/noto-serif/700.css'
import '@fontsource/noto-serif/400-italic.css'
import '@fontsource/noto-serif/600-italic.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
