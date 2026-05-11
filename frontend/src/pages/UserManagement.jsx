import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, UserCog, Edit, Trash2, X, ShieldCheck, Mail } from 'lucide-react';
import { db } from '../firebase';

export const UserManagement = () => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), snapshot => {
      setUsersList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubGroups = onSnapshot(collection(db, 'groups'), snapshot => {
      setGroupsList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubUsers(); unsubGroups(); };
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        displayName: editingUser.displayName,
        role: editingUser.role,
        groupIds: editingUser.groupIds,
        canEditOwn: editingUser.canEditOwn || false,
        canEditGroup: editingUser.canEditGroup || false
      });
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("更新に失敗しました");
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`${name} のユーザー情報を削除しますか？\n※ログイン権限自体はFirebaseコンソールから削除する必要があります。`)) {
      try { await deleteDoc(doc(db, 'users', id)); } 
      catch (e) { console.error(e); alert('削除失敗'); }
    }
  };

  const toggleGroup = (groupId) => {
    setEditingUser(prev => {
      const newGroups = prev.groupIds.includes(groupId) 
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId];
      return { ...prev, groupIds: newGroups };
    });
  };

  const getRoleLabel = (role) => {
    if (role === 'admin') return '👑 システム管理者';
    if (role === 'manager') return '📝 事務・役員';
    return '🚜 現場リーダー';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          <UserCog className="w-6 h-6 mr-2 text-purple-600" />
          ユーザー管理
        </h1>
      </header>

      <main className="p-4 max-w-6xl mx-auto mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="font-bold text-gray-700">登録ユーザー一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b">
                  <th className="px-6 py-3 font-bold">表示名</th>
                  <th className="px-6 py-3 font-bold">メールアドレス</th>
                  <th className="px-6 py-3 font-bold">権限</th>
                  <th className="px-6 py-3 font-bold">担当グループ</th>
                  <th className="px-6 py-3 font-bold text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersList.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{user.displayName || '未設定'}</td>
                    
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.email || <span className="text-gray-400 text-xs">未設定</span>}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                        user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        user.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        {getRoleLabel(user.role)}
                      </span>
                      {user.role === 'reporter' && user.canEditOwn && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-[9px] font-bold">
                          自活 編集可
                        </span>
                      )}
                      {user.role === 'reporter' && user.canEditGroup && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-bold">
                          同一グループ 編集可
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {(user.groupIds || []).map(gid => {
                        const g = groupsList.find(x => x.id === gid);
                        return g ? <span key={gid} className="inline-block bg-gray-100 px-2 py-1 rounded mr-1 mb-1">{g.name}</span> : null;
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center space-x-2">
                        <button onClick={() => setEditingUser(user)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"><Edit size={18}/></button>
                        <button onClick={() => handleDelete(user.id, user.displayName)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">ユーザー情報の修正</h2>
              <button onClick={() => setEditingUser(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">表示名</label>
                <input 
                  type="text" 
                  value={editingUser.displayName || ''} 
                  onChange={e => setEditingUser({...editingUser, displayName: e.target.value})}
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    value={editingUser.email || ''} 
                    readOnly
                    className="w-full pl-10 border border-gray-200 rounded-xl p-3 text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
                    placeholder="未設定"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">※ログインIDとして使用されているため、ここでは変更できません。</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">システム権限</label>
                {/* 🚀 プルダウンの説明文を実態に合わせてアップデート */}
                <select 
                  value={editingUser.role || 'reporter'} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full border-2 border-purple-400 rounded-xl p-3 font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="admin">👑 システム管理者 (マスタ管理を含む全機能へのアクセス)</option>
                  <option value="manager">📝 事務・役員 (全グループの実績閲覧・編集・Excel出力)</option>
                  <option value="reporter">🚜 現場リーダー (担当グループの実績登録 ※編集/削除は個別設定)</option>
                </select>

                {editingUser.role === 'reporter' && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center space-x-3 bg-yellow-50 p-3 rounded-xl border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={editingUser.canEditOwn || false} 
                        onChange={e => setEditingUser({...editingUser, canEditOwn: e.target.checked})}
                        className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-yellow-900 flex items-center">
                          <ShieldCheck size={16} className="mr-1" /> 自身が登録した活動の「編集・削除」を許可
                        </span>
                        <span className="text-[10px] text-yellow-700 mt-0.5">自分が登録した実績のみ編集できるようになります。</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 bg-blue-50 p-3 rounded-xl border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={editingUser.canEditGroup || false} 
                        onChange={e => setEditingUser({...editingUser, canEditGroup: e.target.checked})}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-900 flex items-center">
                          <ShieldCheck size={16} className="mr-1" /> 同一グループの活動の「編集・削除」を許可
                        </span>
                        <span className="text-[10px] text-blue-700 mt-0.5">所属しているグループ内であれば他人の実績も編集できるようになります。</span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">担当グループ</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-gray-50">
                  {groupsList.map(g => {
                    const isChecked = (editingUser.groupIds || []).includes(g.id);
                    return (
                      <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleGroup(g.id)}
                          className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <span className={`text-sm ${isChecked ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{g.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex space-x-3 bg-gray-50">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 border border-gray-300 bg-white rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button onClick={handleUpdate} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-md transition-all active:scale-95">
                更新する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};