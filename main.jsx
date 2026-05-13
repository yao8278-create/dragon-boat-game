import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // 這會讀取你之前建立的 App.jsx

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
