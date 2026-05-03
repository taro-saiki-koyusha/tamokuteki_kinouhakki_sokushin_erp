import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Edit, X, Users, Check } from 'lucide-react';
import { db } from '../firebase';

export const GroupManagement = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  
  // 編集用の状態管理
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  // Firestoreからグループ一覧をリアルタイム取得
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const groupData = [];
      snapshot.forEach((doc) => {
        groupData.push({ id: doc.id, ...doc.data() });
      });
      // 作成日時などで並び替える場合はここでsort可能
      setGroups(groupData);
    });
    return () => unsubscribe();
  }, []);

  // 新規グループの追加
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        createdAt: serverTimestamp()
      });
      setNewGroupName('');
    } catch (error) {
      console.error(error);
      alert('グループの追加に失敗しました。');
    }
  };

  // グループの削除
  const handleDelete = async (id) => {
    if (window.confirm('本当にこのグループを削除しますか？\n※すでにこのグループで登録された活動実績の表示に影響が出る可能性があります。')) {
      try {
        await deleteDoc(doc(db, 'groups', id));
      } catch (error) {
        console.error(error);
        alert('削除に失敗しました。');
      }
    }
  };

  // 編集モードへの切り替え
  const startEdit = (group) => {
    setEditingId(group.id);
    setEditName(group.name);
  };

  // グループ名の更新
  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, 'groups', id), {
        name: editName.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
          <Users className="w-6 h-6 mr-2 text-blue-600" />
          グループ管理
        </h1>
      </header>

      <main className="p-4 md:p-8 max-w-md md:max-w-3xl mx-auto space-y-6">
        
        {/* 新規追加フォーム */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center">
            <Plus className="w-5 h-5 mr-1 text-blue-600"/> 新規グループ追加
          </h2>
          <form onSubmit={handleAdd} className="flex space-x-2">
            <input 
              type="text" 
              value={newGroupName} 
              onChange={(e) => setNewGroupName(e.target.value)} 
              placeholder="新しいグループ名を入力..." 
              className="flex-1 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500" 
            />
            <button 
              type="submit" 
              disabled={!newGroupName.trim()} 
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors whitespace-nowrap"
            >
              追加
            </button>
          </form>
        </div>

        {/* グループ一覧 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-1 text-blue-600"/> 登録済みグループ一覧
          </h2>
          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                {editingId === group.id ? (
                  <div className="flex-1 flex space-x-2 mr-2">
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="flex-1 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500" 
                      autoFocus 
                    />
                    <button onClick={() => handleUpdate(group.id)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"><Check size={20}/></button>
                    <button onClick={() => setEditingId(null)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"><X size={20}/></button>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-gray-800">{group.name}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => startEdit(group)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><Edit size={18}/></button>
                      <button onClick={() => handleDelete(group.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18}/></button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                グループが登録されていません
              </p>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};