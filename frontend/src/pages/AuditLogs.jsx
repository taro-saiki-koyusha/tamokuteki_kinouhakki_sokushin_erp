import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Search, Loader2, ShieldAlert, FileText, User, Trash2, Edit, PlusCircle, LogIn } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';

// 日付フォーマット関数
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  if (typeof timestamp.toDate === 'function') {
    const d = timestamp.toDate();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }
  return '-';
};

// アクションに応じたアイコンと色を返す関数
const getActionBadge = (action) => {
  switch (action?.toUpperCase()) {
    case 'CREATE':
      return { icon: <PlusCircle size={14} className="mr-1" />, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: '新規作成' };
    case 'UPDATE':
      return { icon: <Edit size={14} className="mr-1" />, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: '更新・編集' };
    case 'DELETE':
      return { icon: <Trash2 size={14} className="mr-1" />, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: '削除' };
    case 'LOGIN':
      return { icon: <LogIn size={14} className="mr-1" />, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'ログイン' };
    default:
      return { icon: <FileText size={14} className="mr-1" />, bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', label: action || '操作' };
  }
};

export const AuditLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    
    let unsubscribeLogs = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            
            // 🚀 'audit_logs' コレクションから最新100件を取得
            const q = query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(100));
            unsubscribeLogs = onSnapshot(q, (snapshot) => {
              const logData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setLogs(logData);
              setLoading(false);
            }, (error) => {
              console.error("ログ取得エラー:", error);
              setLoading(false);
            });

          } else {
            // 管理者以外はアクセス不可
            setIsAdmin(false);
            setLoading(false);
          }
        } catch (error) {
          console.error("権限確認エラー:", error);
          setLoading(false);
        }
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [navigate]);

  // 検索フィルタリング
  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const lower = searchTerm.toLowerCase();
    return logs.filter(log => 
      (log.userName && log.userName.toLowerCase().includes(lower)) ||
      (log.target && log.target.toLowerCase().includes(lower)) ||
      (log.details && log.details.toLowerCase().includes(lower))
    );
  }, [logs, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <p className="text-green-800 font-bold text-lg tracking-wider">読み込み中...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center max-w-md w-full border-t-8 border-red-500">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-6">この画面はシステム管理者のみ閲覧可能です。</p>
          <button onClick={() => navigate('/dashboard')} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-colors">
            ダッシュボードへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
            <History className="w-6 h-6 mr-2 text-orange-500" />
            システム操作履歴 (直近100件)
          </h1>
        </div>
      </header>

      <main className="p-4 md:p-8 w-full max-w-6xl mx-auto">
        
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="w-full md:w-96 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="ユーザー名、対象、詳細で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-shadow"
              />
            </div>
            <div className="text-sm text-gray-500 font-bold">
              表示件数: {filteredLogs.length}件
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                  <th className="p-4 font-bold w-48 whitespace-nowrap">日時</th>
                  <th className="p-4 font-bold w-32 whitespace-nowrap">操作</th>
                  <th className="p-4 font-bold w-48 whitespace-nowrap">ユーザー</th>
                  <th className="p-4 font-bold w-48 whitespace-nowrap">対象データ</th>
                  <th className="p-4 font-bold w-full whitespace-nowrap">詳細情報</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400 font-bold">
                      操作履歴が見つかりません。
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const badge = getActionBadge(log.action);
                    return (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                        <td className="p-4 text-xs font-mono text-gray-600 whitespace-nowrap">
                          {formatTimestamp(log.createdAt)}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`flex items-center w-max px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-800 whitespace-nowrap flex items-center">
                          <User size={14} className="mr-1.5 text-gray-400" />
                          {log.userName || '不明なユーザー'}
                        </td>
                        <td className="p-4 text-sm text-gray-700 whitespace-nowrap font-mono text-xs">
                          {log.target || '-'}
                        </td>
                        <td className="p-4 text-xs text-gray-600 truncate max-w-xs" title={log.details}>
                          {log.details || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AuditLogs;
