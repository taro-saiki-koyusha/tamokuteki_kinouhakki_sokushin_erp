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
import { AuditLogs } from './pages/AuditLogs';
import { TicketManagement } from './pages/TicketManagement';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        <Route path="/activity-form" element={<ActivityForm />} />
        <Route path="/activity-form/:id" element={<ActivityForm />} />
        
        <Route path="/bulk-activity" element={<BulkActivityForm />} />
        <Route path="/groups" element={<GroupManagement />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/masters" element={<MasterManagement />} />
        <Route path="/profile" element={<ProfileSettings />} />
        <Route path="/costs" element={<CostManagement />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        
        {/* 新規：チケット管理（合体ツール） */}
        <Route path="/ticket-management" element={<TicketManagement />} />

        {/* ⚠️ 未定義のURLにアクセスした場合はログイン画面に戻す */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;