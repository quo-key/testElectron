import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import CountersPage from './pages/CountersPage'

export default function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<CountersPage />} />
      </Routes>
    </HashRouter>
  )
}
