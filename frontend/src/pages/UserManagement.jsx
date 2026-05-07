import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'; 
import { ArrowLeft, UserCog, Edit, X, Save, Shield, Trash2 } from 'lucide-react'; 
import { db } from '../firebase';

const ROLE_LABELS = {
  admin: '👑 システム管理者',
  manager: '📝 事務・役員',
  reporter: '🚜 現場リーダー'
};

export const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState(''); // 🚀 名前の編集用Stateを追加
  const [editRole, setEditRole] = useState('');
  const [editGroupIds, setEditGroupIds] = useState([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uData = [];
      snapshot.forEach(doc => uData.push({ id: doc.id, ...doc.data() }));
      setUsers(uData);
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const gData = [];
      snapshot.forEach(doc => gData.push({ id: doc.id, ...doc.data() }));
      setGroups(gData);
    });

    return () => {
      unsubUsers();
      unsubGroups();
    };
  }, []);

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.name || ''); // 🚀 既存の名前をセット
    setEditRole(user.role || 'reporter');
    setEditGroupIds(user.groupIds || []);
  };

  const handleGroupToggle = (groupId) => {
    setEditGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  const handleUpdate = async () => {
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editName, // 🚀 名前も更新するように追加
        role: editRole,
        groupIds: editGroupIds
      });
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      alert('ユーザー情報の更新に失敗しました。');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const displayName = userName || 'このユーザー';
    if (window.confirm(`${displayName} をシステムから削除しますか？\n※この操作は取り消せません。該当ユーザーは再度ログインするまでシステムを利用できなくなります。`)) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        console.error(error);
        alert('ユーザーの削除に失敗しました。');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
          <UserCog className="w-6 h-6 mr-2 text-purple-600" />
          ユーザー権限管理
        </h1>
      </header>

      <main className="p-4 md:p-8 max-w-md md:max-w-4xl mx-auto space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-600 mb-4 flex items-center bg-purple-50 p-3 rounded-lg border border-purple-100">
            <Shield className="w-5 h-5 mr-2 text-purple-600 flex-shrink-0" />
            ここでユーザーのシステム権限と、担当するグループ（複数可）を設定できます。新しいメンバーがログインすると自動的に一覧に追加されます。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map(user => (
              <div key={user.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col justify-between relative group">
                {/* 削除ボタン */}
                <button 
                  onClick={() => handleDeleteUser(user.id, user.name)}
                  className="absolute top-3 right-3 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="ユーザーを削除"
                >
                  <Trash2 size={18} />
                </button>

                <div>
                  <div className="flex justify-between items-start mb-2 pr-8">
                    {/* 🚀 名前が空の場合はプレースホルダーを表示 */}
                    <h3 className="font-bold text-gray-900">{user.name || '名前未設定'}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ml-2 ${
                      user.role === 'admin' ? 'bg-red-100 text-red-700' : 
                      user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {ROLE_LABELS[user.role] || ROLE_LABELS['reporter']}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{user.email || 'メールアドレス未取得'}</p>
                  
                  <div className="mb-4">
                    <span className="text-xs font-bold text-gray-500 block mb-1">担当グループ:</span>
                    <div className="flex flex-wrap gap-1">
                      {(user.groupIds || []).length > 0 ? (
                        (user.groupIds || []).map(gid => {
                          const gName = groups.find(g => g.id === gid)?.name || '不明なグループ';
                          return <span key={gid} className="text-xs bg-white border border-gray-300 px-2 py-0.5 rounded text-gray-600">{gName}</span>;
                        })
                      ) : (
                        <span className="text-xs text-gray-400">担当グループなし</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => openEditModal(user)} 
                  className="w-full flex items-center justify-center py-2 bg-white border border-purple-200 text-purple-600 rounded-lg text-sm font-bold hover:bg-purple-50 transition-colors"
                >
                  <Edit size={16} className="mr-1.5" /> ユーザー情報を修正
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">ユーザー情報の修正</h3>
              <button onClick={() => setEditingUser(null)} className="p-1.5 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-5 space-y-5 overflow-y-auto max-h-[60vh]">
              {/* 🚀 表示名の編集を追加 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">表示名</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  placeholder="例：山田 太郎"
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">システム権限</label>
                <select 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value)} 
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="admin">👑 システム管理者 (全権限)</option>
                  <option value="manager">📝 事務・役員 (全グループ閲覧・出力可能)</option>
                  <option value="reporter">🚜 現場リーダー (担当グループの入力のみ)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">担当グループ (複数選択可)</label>
                {editRole === 'admin' || editRole === 'manager' ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    ※ 管理者・事務局は自動的に「全てのグループ」のデータを閲覧・操作できるため、個別の割り当ては不要です。
                  </p>
                ) : (
                  <div className="space-y-2 border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                    {groups.map(g => (
                      <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editGroupIds.includes(g.id)} 
                          onChange={() => handleGroupToggle(g.id)}
                          className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="text-gray-800 font-medium">{g.name}</span>
                      </label>
                    ))}
                    {groups.length === 0 && <p className="text-sm text-gray-500">グループが登録されていません</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex space-x-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-white border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">キャンセル</button>
              <button onClick={handleUpdate} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 flex items-center justify-center">
                <Save size={20} className="mr-2" /> 更新する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};