import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminComponents from './pages/admin/Components';
import FGProducts from './pages/admin/FGProducts';
import BOMMaster from './pages/admin/BOMMaster';
import Reports from './pages/admin/Reports';
import StockUpdate from './pages/admin/StockUpdate';
import Users from './pages/admin/Users';
import Email from './pages/admin/Email';
import { getCurrentUser } from './services/session';
import { canOpenRoute } from './services/permissions';

function ProtectedRoute({ routeKey, children }) {
  const user = getCurrentUser();
  if (!user) return <Login />;
  if (!canOpenRoute(user, routeKey)) return <AdminDashboard />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<ProtectedRoute routeKey="dashboard"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/components" element={<ProtectedRoute routeKey="components"><AdminComponents /></ProtectedRoute>} />
        <Route path="/admin/fgproducts" element={<ProtectedRoute routeKey="products"><FGProducts /></ProtectedRoute>} />
        <Route path="/admin/bommaster" element={<ProtectedRoute routeKey="bom"><BOMMaster /></ProtectedRoute>} />
        <Route path="/admin/stock" element={<ProtectedRoute routeKey="stock"><StockUpdate /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute routeKey="reports"><Reports /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute routeKey="users"><Users /></ProtectedRoute>} />
        <Route path="/admin/email" element={<ProtectedRoute routeKey="email"><Email /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
