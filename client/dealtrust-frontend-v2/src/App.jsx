import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import HomePage from './pages/HomePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import DealPage from './pages/DealPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/"                    element={<HomePage />} />
          <Route path="/category/:slug"      element={<CategoryPage />} />
          <Route path="/deal/:id"            element={<DealPage />} />
          <Route path="/search"              element={<SearchPage />} />
          <Route path="/alerts"              element={<AlertsPage />} />
          <Route path="*"                    element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
