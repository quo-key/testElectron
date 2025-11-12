import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import CountersPage from './pages/CountersPage'
import CategoriesPage from './pages/CategoriesPage'

export default function App(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<CountersPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Routes>
    </HashRouter>
  )
}
