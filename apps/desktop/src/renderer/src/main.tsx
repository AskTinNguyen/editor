import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app'
import '../../../../editor/app/globals.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Missing #root container')
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
