import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore'; // 🚀 setDocを追加
import { ArrowLeft, UserCog, Edit, Trash2, X, ShieldCheck, Mail, Wallet, Plus, CheckCircle, UserPlus, Phone } from 'lucide-react'; // 🚀 UserPlus, Phoneを追加
import { db, auth } from '../firebase'; // 🚀 authを追加
import { initializeApp, deleteApp } from 'firebase/app'; // 🚀 管理者がログアウトしないための裏技用
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

export const UserManagement = () => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('reporter');

  // 🚀 新規ユーザー登録用のState
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: '',
    phone: '',
    password: '',
    role: 'reporter',
    groupIds: [],
    canEditOwn: false,
    canEditGroup: false
  });

  useEffect(() => {
    // 現在のログインユーザーの権限を取得（新規追加ボタンの表示制御のため）
    const fetchRole = async () => {
      if (auth.currentUser) {
        onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
          if (doc.exists()) setCurrentUserRole(doc.data().role || 'reporter');
        });
      }
    };
    fetchRole();

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
        canEditGroup: editingUser.canEditGroup || false,
        primaryBankAccount: editingUser.primaryBankAccount || 'bank1',
        bank1IsYucho: editingUser.bank1IsYucho || false,
        bank1Code: editingUser.bank1Code || '',
        bank1Name: editingUser.bank1Name || '',
        bank1BranchCode: editingUser.bank1BranchCode || '',
        bank1Branch: editingUser.bank1Branch || '',
        bank1Type: editingUser.bank1Type || '普通',
        bank1Number: editingUser.bank1Number || '',
        bank1Holder: editingUser.bank1Holder || '',
        bank1HolderKana: editingUser.bank1HolderKana || '',
        bank2Enabled: editingUser.bank2Enabled || false,
        bank2IsYucho: editingUser.bank2IsYucho || false,
        bank2Code: editingUser.bank2Code || '',
        bank2Name: editingUser.bank2Name || '',
        bank2BranchCode: editingUser.bank2BranchCode || '',
        bank2Branch: editingUser.bank2Branch || '',
        bank2Type: editingUser.bank2Type || '普通',
        bank2Number: editingUser.bank2Number || '',
        bank2Holder: editingUser.bank2Holder || '',
        bank2HolderKana: editingUser.bank2HolderKana || ''
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

  // 🚀 電話番号による新規ユーザー作成（バックグラウンド処理）
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.displayName || !newUser.phone || !newUser.password) {
      alert("名前、電話番号、初期パスワードは必須です。");
      return;
    }
    if (newUser.password.length < 6) {
      alert("パスワードは6文字以上で設定してください。");
      return;
    }

    setIsCreating(true);
    try {
      // 1. 電話番号のハイフンを抜き、架空のメールアドレスを作成
      const cleanPhone = newUser.phone.replace(/[^0-9]/g, '');
      const dummyEmail = `${cleanPhone}@kamata.local`;

      // 2. 現在の管理者がログアウトしないように、一時的なFirebaseアプリを生成してユーザー登録
      const tempApp = initializeApp(auth.app.options, `temp_${Date.now()}`);
      const tempAuth = getAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, dummyEmail, newUser.password);
      
      // 3. 成功したらFirestoreにユーザー情報を書き込む
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        displayName: newUser.displayName,
        email: dummyEmail, // 連絡用ではなくログインIDとして保存
        isPhoneAccount: true, // 電話番号アカウントである目印
        role: newUser.role,
        groupIds: newUser.groupIds,
        canEditOwn: newUser.canEditOwn,
        canEditGroup: newUser.canEditGroup,
        createdAt: new Date()
      });

      // 4. 一時アプリを削除して完了
      await deleteApp(tempApp);
      
      alert("ユーザーを作成しました！\nログインID: " + cleanPhone + "\nパスワード: " + newUser.password);
      setIsAddingUser(false);
      setNewUser({ displayName: '', phone: '', password: '', role: 'reporter', groupIds: [], canEditOwn: false, canEditGroup: false });
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        alert('この電話番号はすでに登録されています。');
      } else {
        alert('ユーザー作成エラーが発生しました。');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const toggleGroup = (groupId, isNewUser = false) => {
    if (isNewUser) {
      setNewUser(prev => {
        const newGroups = prev.groupIds.includes(groupId) ? prev.groupIds.filter(id => id !== groupId) : [...prev.groupIds, groupId];
        return { ...prev, groupIds: newGroups };
      });
    } else {
      setEditingUser(prev => {
        const newGroups = prev.groupIds.includes(groupId) ? prev.groupIds.filter(id => id !== groupId) : [...prev.groupIds, groupId];
        return { ...prev, groupIds: newGroups };
      });
    }
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
        
        {/* 🚀 管理者のみに表示される「新規ユーザー追加」ボタン */}
        {currentUserRole === 'admin' && (
          <div className="mb-4 flex justify-end">
            <button 
              onClick={() => setIsAddingUser(true)}
              className="flex items-center px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-sm transition-all"
            >
              <UserPlus size={18} className="mr-2" />
              新規ユーザーを追加 (電話番号可)
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="font-bold text-gray-700">登録ユーザー一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b">
                  <th className="px-6 py-3 font-bold">表示名</th>
                  <th className="px-6 py-3 font-bold">ログインID (メール/電話)</th>
                  <th className="px-6 py-3 font-bold text-center">口座情報</th>
                  <th className="px-6 py-3 font-bold">権限</th>
                  <th className="px-6 py-3 font-bold">担当グループ</th>
                  <th className="px-6 py-3 font-bold text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersList.map((user) => {
                  // 電話番号アカウントの場合は「@kamata.local」を隠して表示する
                  const displayId = user.isPhoneAccount && user.email 
                    ? user.email.replace('@kamata.local', '') 
                    : user.email;

                  return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-800">{user.displayName || '未設定'}</td>
                    
                    <td className="px-6 py-4 text-sm text-gray-600 flex items-center mt-2.5">
                      {user.isPhoneAccount ? <Phone size={14} className="mr-1.5 text-gray-400"/> : <Mail size={14} className="mr-1.5 text-gray-400"/>}
                      {displayId || <span className="text-gray-400 text-xs">未設定</span>}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {(user.bank1Number || (user.bank2Enabled && user.bank2Number)) ? (
                        <span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded text-[10px] font-bold">登録済</span>
                      ) : (
                        <span className="text-gray-300 text-[10px]">未登録</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                        user.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        user.role === 'manager' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-green-50 text-green-700 border-green-100'
                      }`}>
                        {getRoleLabel(user.role)}
                      </span>
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
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 🚀 新規ユーザー追加モーダル */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b shrink-0 bg-purple-50">
              <h2 className="text-lg font-bold text-purple-900 flex items-center"><UserPlus size={20} className="mr-2"/> 新規ユーザー追加</h2>
              <button onClick={() => setIsAddingUser(false)} className="p-1.5 text-purple-400 hover:bg-purple-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs leading-relaxed border border-blue-100">
                <b>【電話番号での登録について】</b><br/>
                メールアドレスを持たない方のために、固定電話や携帯番号を「ログインID」として登録できます。（例：0258123456）
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">氏名 (表示名) <span className="text-red-500">*</span></label>
                <input type="text" value={newUser.displayName} onChange={e => setNewUser({...newUser, displayName: e.target.value})} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500" placeholder="山田 太郎" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ログインID (電話番号 または メール) <span className="text-red-500">*</span></label>
                <input type="text" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500" placeholder="09012345678" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">初期パスワード (6文字以上) <span className="text-red-500">*</span></label>
                <input type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-purple-500" placeholder="password123" />
                <p className="text-[10px] text-gray-500 mt-1">※このパスワードをユーザーにお伝えください。</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">システム権限</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full border-2 border-purple-400 rounded-xl p-3 font-bold text-gray-800 focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="admin">👑 システム管理者 (マスタ管理を含む全機能へのアクセス)</option>
                  <option value="manager">📝 事務・役員 (全グループの実績閲覧・編集・Excel出力)</option>
                  <option value="reporter">🚜 現場リーダー (担当グループの実績登録)</option>
                </select>
                {newUser.role === 'reporter' && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center space-x-3 bg-yellow-50 p-3 rounded-xl border border-yellow-200 cursor-pointer">
                      <input type="checkbox" checked={newUser.canEditOwn} onChange={e => setNewUser({...newUser, canEditOwn: e.target.checked})} className="w-5 h-5 text-yellow-600 rounded" />
                      <span className="text-sm font-bold text-yellow-900">自身が登録した活動の「編集・削除」を許可</span>
                    </label>
                    <label className="flex items-center space-x-3 bg-blue-50 p-3 rounded-xl border border-blue-200 cursor-pointer">
                      <input type="checkbox" checked={newUser.canEditGroup} onChange={e => setNewUser({...newUser, canEditGroup: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                      <span className="text-sm font-bold text-blue-900">同一グループの活動の「編集・削除」を許可</span>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">担当グループ</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
                  {groupsList.map(g => (
                    <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                      <input type="checkbox" checked={newUser.groupIds.includes(g.id)} onChange={() => toggleGroup(g.id, true)} className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                      <span className={`text-sm ${newUser.groupIds.includes(g.id) ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{g.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex space-x-3 bg-gray-50 shrink-0">
              <button onClick={() => setIsAddingUser(false)} className="flex-1 py-3 border border-gray-300 bg-white rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button onClick={handleCreateUser} disabled={isCreating} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:bg-purple-300 shadow-md transition-all">
                {isCreating ? '作成中...' : 'ユーザーを作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 以下、既存の編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-800">ユーザー情報の修正</h2>
              <button onClick={() => setEditingUser(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-6 overflow-y-auto flex-1">
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
                <label className="block text-sm font-bold text-gray-700 mb-1">ログインID (メール または 電話)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {editingUser.isPhoneAccount ? <Phone size={16} className="text-gray-400"/> : <Mail size={16} className="text-gray-400" />}
                  </div>
                  <input 
                    type="text" 
                    value={editingUser.isPhoneAccount && editingUser.email ? editingUser.email.replace('@kamata.local', '') : (editingUser.email || '')} 
                    readOnly
                    className="w-full pl-10 border border-gray-200 rounded-xl p-3 text-sm bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
                    placeholder="未設定"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 text-right">※システム内部のIDとして使用されているため、変更できません。</p>
              </div>

              {/* 口座情報は既存のまま */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-5">
                <h3 className="text-sm font-bold text-gray-700 flex items-center border-b border-gray-200 pb-2">
                  <Wallet size={16} className="mr-1.5 text-gray-500" />
                  振込口座情報
                </h3>
                
                {/* 🏦 口座情報 1 */}
                <div className={`border rounded-lg p-3 space-y-3 transition-colors relative ${editingUser.primaryBankAccount !== 'bank2' ? 'bg-purple-50/30 border-purple-400 shadow-sm ring-1 ring-purple-400' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <h4 className="text-xs font-bold text-gray-700">口座情報 1</h4>
                    <label className="flex items-center space-x-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
                      <input 
                        type="radio" 
                        name="primaryBank" 
                        checked={editingUser.primaryBankAccount !== 'bank2'} 
                        onChange={() => setEditingUser({...editingUser, primaryBankAccount: 'bank1'})} 
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" 
                      />
                      <span className={`text-[10px] font-bold ${editingUser.primaryBankAccount !== 'bank2' ? 'text-purple-700' : 'text-gray-500'}`}>振込先に指定</span>
                    </label>
                  </div>
                  
                  <div className="flex space-x-4 mb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" checked={!editingUser.bank1IsYucho} onChange={() => setEditingUser({...editingUser, bank1IsYucho: false})} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                      <span className="text-xs font-bold text-gray-700">ゆうちょ銀行以外</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="radio" checked={editingUser.bank1IsYucho} onChange={() => setEditingUser({...editingUser, bank1IsYucho: true})} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                      <span className="text-xs font-bold text-gray-700">ゆうちょ銀行</span>
                    </label>
                  </div>

                  {!editingUser.bank1IsYucho ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex space-x-2">
                          <div className="w-1/3">
                            <label className="block text-[10px] text-gray-500 mb-0.5">銀行番号</label>
                            <input type="text" value={editingUser.bank1Code || ''} onChange={e => setEditingUser({...editingUser, bank1Code: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="0001" />
                          </div>
                          <div className="w-2/3">
                            <label className="block text-[10px] text-gray-500 mb-0.5">金融機関名</label>
                            <input type="text" value={editingUser.bank1Name || ''} onChange={e => setEditingUser({...editingUser, bank1Name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="例: ○○銀行" />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <div className="w-1/3">
                            <label className="block text-[10px] text-gray-500 mb-0.5">支店番号</label>
                            <input type="text" value={editingUser.bank1BranchCode || ''} onChange={e => setEditingUser({...editingUser, bank1BranchCode: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="123" />
                          </div>
                          <div className="w-2/3">
                            <label className="block text-[10px] text-gray-500 mb-0.5">支店名</label>
                            <input type="text" value={editingUser.bank1Branch || ''} onChange={e => setEditingUser({...editingUser, bank1Branch: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="例: ××支店" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-[10px] text-gray-500 mb-0.5">種目</label>
                          <select value={editingUser.bank1Type || '普通'} onChange={e => setEditingUser({...editingUser, bank1Type: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:ring-1 focus:ring-purple-500">
                            <option value="普通">普通</option>
                            <option value="当座">当座</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] text-gray-500 mb-0.5">口座番号</label>
                          <input type="text" value={editingUser.bank1Number || ''} onChange={e => setEditingUser({...editingUser, bank1Number: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="1234567" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">口座名義人</label>
                          <input type="text" value={editingUser.bank1Holder || ''} onChange={e => setEditingUser({...editingUser, bank1Holder: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="山田 太郎" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">フリガナ</label>
                          <input type="text" value={editingUser.bank1HolderKana || ''} onChange={e => setEditingUser({...editingUser, bank1HolderKana: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="ヤマダ タロウ" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-1">
                          <label className="block text-[10px] text-gray-500 mb-0.5">店番（3桁）</label>
                          <input type="text" value={editingUser.bank1BranchCode || ''} onChange={e => setEditingUser({...editingUser, bank1BranchCode: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="123" />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-[10px] text-gray-500 mb-0.5">種目</label>
                          <select value={editingUser.bank1Type || '普通'} onChange={e => setEditingUser({...editingUser, bank1Type: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:ring-1 focus:ring-purple-500">
                            <option value="普通">普通</option>
                            <option value="当座">当座</option>
                          </select>
                        </div>
                        <div className="col-span-1">
                          <label className="block text-[10px] text-gray-500 mb-0.5">口座番号</label>
                          <input type="text" value={editingUser.bank1Number || ''} onChange={e => setEditingUser({...editingUser, bank1Number: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="1234567" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">口座名義人</label>
                          <input type="text" value={editingUser.bank1Holder || ''} onChange={e => setEditingUser({...editingUser, bank1Holder: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="山田 太郎" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-0.5">フリガナ</label>
                          <input type="text" value={editingUser.bank1HolderKana || ''} onChange={e => setEditingUser({...editingUser, bank1HolderKana: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="ヤマダ タロウ" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 🏦 口座情報 2（予備） */}
                {!editingUser.bank2Enabled ? (
                  <button type="button" onClick={() => setEditingUser({...editingUser, bank2Enabled: true})} className="w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-white transition-colors flex items-center justify-center">
                    <Plus size={16} className="mr-1" /> 口座情報 2（予備）を追加する
                  </button>
                ) : (
                  <div className={`border rounded-lg p-3 space-y-3 transition-colors relative ${editingUser.primaryBankAccount === 'bank2' ? 'bg-purple-50/30 border-purple-400 shadow-sm ring-1 ring-purple-400' : 'bg-white border-gray-200 shadow-sm'}`}>
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-xs font-bold text-gray-700">口座情報 2</h4>
                        <label className="flex items-center space-x-1.5 cursor-pointer bg-white px-2 py-1 rounded border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
                          <input 
                            type="radio" 
                            name="primaryBank" 
                            checked={editingUser.primaryBankAccount === 'bank2'} 
                            onChange={() => setEditingUser({...editingUser, primaryBankAccount: 'bank2'})} 
                            className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" 
                          />
                          <span className={`text-[10px] font-bold ${editingUser.primaryBankAccount === 'bank2' ? 'text-purple-700' : 'text-gray-500'}`}>振込先に指定</span>
                        </label>
                      </div>
                      
                      <button type="button" onClick={() => setEditingUser({...editingUser, bank2Enabled: false, primaryBankAccount: 'bank1'})} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="削除">
                        <Trash2 size={14}/>
                      </button>
                    </div>

                    <div className="flex space-x-4 mb-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" checked={!editingUser.bank2IsYucho} onChange={() => setEditingUser({...editingUser, bank2IsYucho: false})} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                        <span className="text-xs font-bold text-gray-700">ゆうちょ銀行以外</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" checked={editingUser.bank2IsYucho} onChange={() => setEditingUser({...editingUser, bank2IsYucho: true})} className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                        <span className="text-xs font-bold text-gray-700">ゆうちょ銀行</span>
                      </label>
                    </div>

                    {!editingUser.bank2IsYucho ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex space-x-2">
                            <div className="w-1/3">
                              <label className="block text-[10px] text-gray-500 mb-0.5">銀行番号</label>
                              <input type="text" value={editingUser.bank2Code || ''} onChange={e => setEditingUser({...editingUser, bank2Code: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="0001" />
                            </div>
                            <div className="w-2/3">
                              <label className="block text-[10px] text-gray-500 mb-0.5">金融機関名</label>
                              <input type="text" value={editingUser.bank2Name || ''} onChange={e => setEditingUser({...editingUser, bank2Name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="例: ○○銀行" />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <div className="w-1/3">
                              <label className="block text-[10px] text-gray-500 mb-0.5">支店番号</label>
                              <input type="text" value={editingUser.bank2BranchCode || ''} onChange={e => setEditingUser({...editingUser, bank2BranchCode: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="123" />
                            </div>
                            <div className="w-2/3">
                              <label className="block text-[10px] text-gray-500 mb-0.5">支店名</label>
                              <input type="text" value={editingUser.bank2Branch || ''} onChange={e => setEditingUser({...editingUser, bank2Branch: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="例: ××支店" />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <label className="block text-[10px] text-gray-500 mb-0.5">種目</label>
                            <select value={editingUser.bank2Type || '普通'} onChange={e => setEditingUser({...editingUser, bank2Type: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:ring-1 focus:ring-purple-500">
                              <option value="普通">普通</option>
                              <option value="当座">当座</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[10px] text-gray-500 mb-0.5">口座番号</label>
                            <input type="text" value={editingUser.bank2Number || ''} onChange={e => setEditingUser({...editingUser, bank2Number: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="1234567" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">口座名義人</label>
                            <input type="text" value={editingUser.bank2Holder || ''} onChange={e => setEditingUser({...editingUser, bank2Holder: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="山田 太郎" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">フリガナ</label>
                            <input type="text" value={editingUser.bank2HolderKana || ''} onChange={e => setEditingUser({...editingUser, bank2HolderKana: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="ヤマダ タロウ" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <label className="block text-[10px] text-gray-500 mb-0.5">店番（3桁）</label>
                            <input type="text" value={editingUser.bank2BranchCode || ''} onChange={e => setEditingUser({...editingUser, bank2BranchCode: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="123" />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] text-gray-500 mb-0.5">種目</label>
                            <select value={editingUser.bank2Type || '普通'} onChange={e => setEditingUser({...editingUser, bank2Type: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white focus:ring-1 focus:ring-purple-500">
                              <option value="普通">普通</option>
                              <option value="当座">当座</option>
                            </select>
                          </div>
                          <div className="col-span-1">
                            <label className="block text-[10px] text-gray-500 mb-0.5">口座番号</label>
                            <input type="text" value={editingUser.bank2Number || ''} onChange={e => setEditingUser({...editingUser, bank2Number: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-1 focus:ring-purple-500" placeholder="1234567" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">口座名義人</label>
                            <input type="text" value={editingUser.bank2Holder || ''} onChange={e => setEditingUser({...editingUser, bank2Holder: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="山田 太郎" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-0.5">フリガナ</label>
                            <input type="text" value={editingUser.bank2HolderKana || ''} onChange={e => setEditingUser({...editingUser, bank2HolderKana: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-1 focus:ring-purple-500" placeholder="ヤマダ タロウ" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">システム権限</label>
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
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
                  {groupsList.map(g => {
                    const isChecked = (editingUser.groupIds || []).includes(g.id);
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
    </div>
  );
};