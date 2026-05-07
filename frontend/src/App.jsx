import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ActivityForm } from './pages/ActivityForm'; 
import { GroupManagement } from './pages/GroupManagement';
import { UserManagement } from './pages/UserManagement';
import { BulkActivityForm } from './pages/BulkActivityForm'; // 🚀 追加

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/activity-form" element={<ActivityForm />} /> 
        <Route path="/bulk-activity" element={<BulkActivityForm />} /> {/* 🚀 追加 */}
        <Route path="/groups" element={<GroupManagement />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;