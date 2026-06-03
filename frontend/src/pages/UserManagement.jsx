import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore'; 
// 🚀 ここに Loader2 を追加しました！
import { ArrowLeft, UserCog, Edit, Trash2, X, ShieldCheck, Mail, Wallet, Plus, CheckCircle, UserPlus, Phone, Hash, Users, Loader2 } from 'lucide-react'; 
import { db, auth } from '../firebase'; 
import { initializeApp, deleteApp } from 'firebase/app'; 
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

export const UserManagement = () => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('reporter'); 

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [successModal, setSuccessModal] = useState({ show: false, loginId: '', password: '' });

  const [newUser, setNewUser] = useState({
    displayName: '',
    phone: '',
    password: '',
    role: 'reporter',
    memberNo: '', 
    groupIds: [],
    canEditOwn: false,
    canEditGroup: false
  });

  useEffect(() => {
    const fetchRole = async () => {
      if (auth.currentUser) {
        onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUserRole(docSnap.data().role || 'reporter');
          }
        });
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersList(data);
    });

    const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGroupsList(data);
    });

    return () => { unsubscribeUsers(); unsubscribeGroups(); };
  }, []);

  const handleDelete = async (id, name) => {
    if (id === auth.currentUser?.uid) {
      alert("自分自身のアカウントは削除できません。");
      return;
    }
    if (window.confirm(`ユーザー「${name}」をシステムから削除しますか？\n※この操作は元に戻せません。`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        console.error(error);
        alert('削除に失敗しました。');
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingUser.displayName && !editingUser.name) {
      alert('氏名は空にできません。');
      return;
    }
    try {
      const { id, ...updateData } = editingUser;
      await updateDoc(doc(db, 'users', id), updateData);
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  const toggleGroup = (groupId) => {
    if (!editingUser) return;
    const currentGroups = editingUser.groupIds || [];
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter(id => id !== groupId)
      : [...currentGroups, groupId];
    setEditingUser({ ...editingUser, groupIds: newGroups });
  };

  const toggleNewUserGroup = (groupId) => {
    const currentGroups = newUser.groupIds || [];
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter(id => id !== groupId)
      : [...currentGroups, groupId];
    setNewUser({ ...newUser, groupIds: newGroups });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.displayName || !newUser.phone || !newUser.password) {
      alert("氏名、電話番号、パスワードは必須です。");
      return;
    }
    
    setIsCreating(true);
    const cleanPhone = newUser.phone.replace(/[^0-9]/g, '');
    const dummyEmail = `${cleanPhone}@kamata.local`;

    try {
      const secondaryApp = initializeApp(auth.app.options, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, newUser.password);
      const createdUser = userCredential.user;

      await setDoc(doc(db, 'users', createdUser.uid), {
        name: newUser.displayName,
        displayName: newUser.displayName,
        email: dummyEmail,
        role: newUser.role,
        memberNo: newUser.memberNo || '', 
        groupIds: newUser.groupIds,
        canEditOwn: newUser.canEditOwn,
        canEditGroup: newUser.canEditGroup,
        createdAt: new Date()
      });

      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      setSuccessModal({ show: true, loginId: cleanPhone, password: newUser.password });

      setNewUser({
        displayName: '', phone: '', password: '', role: 'reporter', memberNo: '', groupIds: [], canEditOwn: false, canEditGroup: false
      });
      setIsAddingUser(false);

    } catch (error) {
      console.error("ユーザー作成エラー:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("この電話番号は既に登録されています。");
      } else if (error.code === 'auth/weak-password') {
        alert("パスワードは6文字以上にしてください。");
      } else {
        alert("ユーザーの作成に失敗しました。\n" + error.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-bold border border-red-200 flex items-center w-max"><ShieldCheck size={12} className="mr-1"/>管理者</span>;
      case 'manager': return <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs font-bold border border-purple-200 flex items-center w-max"><UserCog size={12} className="mr-1"/>事務・役員</span>;
      default: return <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold border border-blue-100 w-max">現場リーダー</span>;
    }
  };

  if (currentUserRole !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <ShieldCheck size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-6">ユーザー管理画面はシステム管理者のみアクセス可能です。</p>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">ダッシュボードへ戻る</button>
        </div>
      </div>
    );
  }

  const formatEmailForDisplay = (email) => {
    if (!email) return '-';
    if (typeof email === 'string' && email.includes('@kamata.local')) {
      return email.split('@')[0];
    }
    return email;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* 登録完了モーダル */}
      {successModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">ユーザー作成完了</h3>
              <p className="text-sm text-gray-600 mb-4">対象のユーザーに以下のログイン情報を<br/>お伝えください。</p>
              
              <div className="bg-gray-50 p-4 rounded-xl w-full border border-gray-200 text-left space-y-2">
                <div>
                  <span className="text-xs text-gray-500 font-bold block mb-0.5">ログインID (電話番号)</span>
                  <div className="text-lg font-mono font-bold text-blue-700 bg-white px-3 py-1.5 rounded border border-blue-100 select-all">
                    {successModal.loginId}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-bold block mb-0.5">初期パスワード</span>
                  <div className="text-lg font-mono font-bold text-red-600 bg-white px-3 py-1.5 rounded border border-red-100 select-all">
                    {successModal.password}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
              <button
                onClick={() => setSuccessModal({ show: false, loginId: '', password: '' })}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <UserPlus size={20} className="mr-2 text-blue-600" />
                新規ユーザー追加
              </h2>
              <button onClick={() => setIsAddingUser(false)} className="p-1 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              <form id="newUserForm" onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                  <input type="text" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} required className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500" placeholder="例：農園 太郎" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">電話番号（ログインIDになります） <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone size={16} className="text-gray-400" /></div>
                    <input type="tel" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} required className="w-full pl-9 border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500" placeholder="ハイフンなし（例：09012345678）" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">※この番号がログイン時のIDとして使用されます。</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">構成員番号 (Excel出力用・任意)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Hash size={16} className="text-gray-400" /></div>
                    <input type="text" value={newUser.memberNo} onChange={e => setNewUser({...newUser, memberNo: e.target.value})} className="w-full pl-9 border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500" placeholder="例：1234 または 法人名" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">※Excel出力時にこの番号が反映されます。</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">初期パスワード <span className="text-red-500">*</span></label>
                  <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required minLength="6" className="w-full border border-gray-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 font-mono" placeholder="6文字以上" />
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">システム権限</label>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={`border rounded-lg p-2 text-center cursor-pointer transition-all ${newUser.role === 'reporter' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="newRole" value="reporter" checked={newUser.role === 'reporter'} onChange={() => setNewUser({...newUser, role: 'reporter'})} className="hidden" />
                      <span className="text-xs">現場リーダー</span>
                    </label>
                    <label className={`border rounded-lg p-2 text-center cursor-pointer transition-all ${newUser.role === 'manager' ? 'bg-purple-50 border-purple-500 text-purple-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="newRole" value="manager" checked={newUser.role === 'manager'} onChange={() => setNewUser({...newUser, role: 'manager'})} className="hidden" />
                      <span className="text-xs">事務・役員</span>
                    </label>
                    <label className={`border rounded-lg p-2 text-center cursor-pointer transition-all ${newUser.role === 'admin' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <input type="radio" name="newRole" value="admin" checked={newUser.role === 'admin'} onChange={() => setNewUser({...newUser, role: 'admin'})} className="hidden" />
                      <span className="text-xs">管理者</span>
                    </label>
                  </div>
                </div>

                {newUser.role === 'reporter' && (
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 space-y-2 mt-2">
                    <p className="text-xs font-bold text-blue-800 mb-1">現場リーダーの特別権限</p>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={newUser.canEditOwn} onChange={e => setNewUser({...newUser, canEditOwn: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-gray-700">自分が登録した記録の編集・削除を許可する</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" checked={newUser.canEditGroup} onChange={e => setNewUser({...newUser, canEditGroup: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-gray-700">所属グループ全員の記録の編集・削除を許可する</span>
                    </label>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2">所属グループ (複数選択可)</label>
                  <div className="border border-gray-200 rounded-xl max-h-32 overflow-y-auto bg-white">
                    {groupsList.map(g => {
                      const isChecked = newUser.groupIds.includes(g.id);
                      return (
                        <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleNewUserGroup(g.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                          <span className={`text-sm ${isChecked ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{g.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex space-x-3 shrink-0">
              <button type="button" onClick={() => setIsAddingUser(false)} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors">キャンセル</button>
              <button type="submit" form="newUserForm" disabled={isCreating} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center">
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : '登録する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Edit size={20} className="mr-2 text-purple-600" />
                ユーザー権限・所属の編集
              </h2>
              <button onClick={() => setEditingUser(null)} className="p-1 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 flex items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-xl mr-4 shrink-0">
                  {(editingUser?.displayName || editingUser?.name || 'U')[0]}
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-extrabold text-gray-900 truncate">{editingUser?.displayName || editingUser?.name || '名称未設定'}</h3>
                  <div className="text-sm text-gray-500 flex items-center mt-1 truncate">
                    <Mail size={14} className="mr-1 shrink-0" />
                    {formatEmailForDisplay(editingUser?.email)}
                  </div>
                </div>
              </div>

              {/* 🚀 ユーザー名の編集フィールドを追加 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  氏名 (表示名) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={editingUser?.displayName || editingUser?.name || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="例：農園 太郎"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <Hash size={16} className="mr-1 text-gray-500" />
                  構成員番号 (Excel出力用)
                </label>
                <input 
                  type="text" 
                  value={editingUser?.memberNo || ''} 
                  onChange={(e) => setEditingUser({ ...editingUser, memberNo: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="例：1234 または 法人名"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <ShieldCheck size={16} className="mr-1 text-gray-500" />
                  システム権限
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${editingUser?.role === 'reporter' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name="role" value="reporter" checked={editingUser?.role === 'reporter'} onChange={() => setEditingUser({ ...editingUser, role: 'reporter' })} className="hidden" />
                    <div className="font-bold text-sm mb-1">現場リーダー</div>
                    <div className="text-[10px] opacity-80 leading-tight">実績の入力・閲覧</div>
                  </label>
                  
                  <label className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${editingUser?.role === 'manager' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name="role" value="manager" checked={editingUser?.role === 'manager'} onChange={() => setEditingUser({ ...editingUser, role: 'manager' })} className="hidden" />
                    <div className="font-bold text-sm mb-1">事務・役員</div>
                    <div className="text-[10px] opacity-80 leading-tight">全データの閲覧・Excel</div>
                  </label>
                  
                  <label className={`border-2 rounded-xl p-3 text-center cursor-pointer transition-all ${editingUser?.role === 'admin' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <input type="radio" name="role" value="admin" checked={editingUser?.role === 'admin'} onChange={() => setEditingUser({ ...editingUser, role: 'admin' })} className="hidden" />
                    <div className="font-bold text-sm mb-1">管理者</div>
                    <div className="text-[10px] opacity-80 leading-tight">マスタ管理・フル権限</div>
                  </label>
                </div>
              </div>

              {editingUser?.role === 'reporter' && (
                <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <p className="text-sm font-bold text-blue-800 border-b border-blue-200 pb-2">現場リーダーの特別権限</p>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="checkbox" checked={editingUser?.canEditOwn || false} onChange={(e) => setEditingUser({ ...editingUser, canEditOwn: e.target.checked })} className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">自分が登録した記録の編集・削除</span>
                      <span className="text-xs text-gray-500">自分が過去に登録した実績データを後から修正できます。</span>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input type="checkbox" checked={editingUser?.canEditGroup || false} onChange={(e) => setEditingUser({ ...editingUser, canEditGroup: e.target.checked })} className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">所属グループ全員の記録の編集・削除</span>
                      <span className="text-xs text-gray-500">同じグループのメンバーが登録したデータも修正可能になります。（班長向け）</span>
                    </div>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                  <Users size={16} className="mr-1 text-gray-500" />
                  所属グループ設定
                </label>
                <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto bg-white">
                  {groupsList.map(g => {
                    const isChecked = (editingUser?.groupIds || []).includes(g.id);
                    return (
                      <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
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

            <div className="p-4 border-t flex space-x-3 bg-gray-50 shrink-0">
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

      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
            <UserCog className="w-6 h-6 mr-2 text-purple-600" />
            ユーザー・権限管理
          </h1>
        </div>
        <button onClick={() => setIsAddingUser(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 transition-colors shadow-sm">
          <UserPlus size={18} className="mr-1.5" /> <span className="hidden sm:inline">新規ユーザー</span>追加
        </button>
      </header>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-purple-50 border-b border-purple-100">
            <p className="text-sm text-purple-800 font-bold">システムに登録されているユーザーの権限や所属グループを管理します。</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b">
                  <th className="px-4 py-3 font-bold">ユーザー名 / 連絡先</th>
                  <th className="px-4 py-3 font-bold">構成員番号</th>
                  <th className="px-4 py-3 font-bold">権限</th>
                  <th className="px-4 py-3 font-bold">所属グループ</th>
                  <th className="px-4 py-3 font-bold text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersList.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold mr-3 shrink-0">
                          {(user?.displayName || user?.name || 'U')[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 text-sm truncate">{user?.displayName || user?.name || '名称未設定'}</div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {user?.email?.includes('@kamata.local') ? `📞 ${formatEmailForDisplay(user?.email)}` : `✉️ ${formatEmailForDisplay(user?.email)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700 font-mono">{user.memberNo || <span className="text-gray-300 text-xs">未設定</span>}</span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col space-y-1">
                        {getRoleBadge(user.role)}
                        {user.role === 'reporter' && (user.canEditOwn || user.canEditGroup) && (
                          <span className="text-[9px] text-blue-500 font-bold border border-blue-200 px-1.5 rounded w-max">特別編集権限あり</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.groupIds && user.groupIds.length > 0 ? (
                          user.groupIds.map(gid => {
                            const g = groupsList.find(x => x.id === gid);
                            return g ? <span key={gid} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200">{g.name}</span> : null;
                          })
                        ) : (
                          <span className="text-xs text-gray-400">所属なし</span>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="flex justify-center space-x-2">
                        <button onClick={() => setEditingUser(user)} className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors" title="権限・グループ編集">
                          <Edit size={16}/>
                        </button>
                        <button onClick={() => handleDelete(user.id, user.displayName || user.name)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors" disabled={user.id === auth.currentUser?.uid} title="ユーザー削除">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usersList.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-400 font-bold">ユーザーが見つかりません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};