import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/i18n'
import { installGlobalErrorToasts } from '@/lib/globalErrors'

// Failed saves that a screen didn't handle itself still show their message.
installGlobalErrorToasts()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
