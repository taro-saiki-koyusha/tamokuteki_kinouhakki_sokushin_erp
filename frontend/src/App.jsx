import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ActivityForm } from './pages/ActivityForm'; 
import { GroupManagement } from './pages/GroupManagement';
import { UserManagement } from './pages/UserManagement';
import { BulkActivityForm } from './pages/BulkActivityForm';
import { MasterManagement } from './pages/MasterManagement';
import { ProfileSettings } from './pages/ProfileSettings';
import { CostManagement } from './pages/CostManagement';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* 🚀 IDなし(新規登録) と IDあり(個別リンク表示) の両方を共存させます */}
        <Route path="/activity-form" element={<ActivityForm />} />
        <Route path="/activity-form/:id" element={<ActivityForm />} />
        
        <Route path="/bulk-activity" element={<BulkActivityForm />} />
        <Route path="/groups" element={<GroupManagement />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/masters" element={<MasterManagement />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<ProfileSettings />} />
        <Route path="/costs" element={<CostManagement />} />
      </Routes>
    </Router>
  );
}

export default App;