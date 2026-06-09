import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Lock, MapPin, Phone, CheckCircle, AlertTriangle, Loader2, Plus, CreditCard, Trash2, Mail } from 'lucide-react';
// 🚀 ログ記録用に addDoc, collection を追加
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { updatePassword, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

export const ProfileSettings = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ログインプロバイダとID種別の判定状態
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = useState(false); 

  // 基本プロフィール情報
  const [profileData, setProfileData] = useState({
    name: '', 
    email: '',
    address: '',
    phone1: '',
    phone2: ''
  });

  // 口座情報（配列で管理）
  const [bankAccounts, setBankAccounts] = useState([
    {
      id: Date.now(),
      isPrimary: true,
      bankType: 'other',
      bankCode: '',
      bankName: '',
      branchCode: '',
      branchName: '',
      accountType: '普通',
      accountNumber: '',
      accountHolder: '',
      accountHolderKana: ''
    }
  ]);

  // パスワード変更用
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // プロバイダの判定（Googleログインかどうか）
        const hasGoogleProvider = user.providerData.some(provider => provider.providerId === 'google.com');
        const hasPasswordProvider = user.providerData.some(provider => provider.providerId === 'password');
        setIsGoogleUser(hasGoogleProvider && !hasPasswordProvider);

        const userEmail = user.email || '';
        const emailPrefix = userEmail.split('@')[0];
        const isPhoneLoginUser = /^[0-9]{10,15}$/.test(emailPrefix);
        setIsPhoneLogin(isPhoneLoginUser);

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            setProfileData({
              name: data.name || user.displayName || '未設定', 
              email: userEmail,
              address: data.address || '',
              phone1: isPhoneLoginUser ? emailPrefix : (data.phone1 || ''),
              phone2: data.phone2 || ''
            });

            if (data.bankAccounts && data.bankAccounts.length > 0) {
              setBankAccounts(data.bankAccounts);
            } 
            else if (data.bankName || data.accountNumber) {
              setBankAccounts([{
                id: Date.now(),
                isPrimary: true,
                bankType: data.bankName === 'ゆうちょ銀行' ? 'yucho' : 'other',
                bankCode: '',
                bankName: data.bankName || '',
                branchCode: '',
                branchName: data.branchName || '',
                accountType: data.accountType || '普通',
                accountNumber: data.accountNumber || '',
                accountHolder: data.accountHolder || '',
                accountHolderKana: ''
              }]);
            }
          } else {
            setProfileData(prev => ({ 
              ...prev, 
              name: user.displayName || '未設定', 
              email: userEmail,
              phone1: isPhoneLoginUser ? emailPrefix : '' 
            }));
          }
        } catch (error) {
          console.error("ユーザー情報の取得エラー:", error);
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/'); 
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePhoneChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[^0-9]/g, '');

    setProfileData({ ...profileData, [name]: numericValue });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleBankChange = (index, field, value) => {
    const newAccounts = [...bankAccounts];
    newAccounts[index][field] = value;
    setBankAccounts(newAccounts);
  };

  const setPrimaryAccount = (index) => {
    const newAccounts = bankAccounts.map((acc, i) => ({
      ...acc,
      isPrimary: i === index
    }));
    setBankAccounts(newAccounts);
  };

  const addBankAccount = () => {
    if (bankAccounts.length >= 2) return;
    setBankAccounts([...bankAccounts, {
      id: Date.now(),
      isPrimary: false,
      bankType: 'other',
      bankCode: '',
      bankName: '',
      branchCode: '',
      branchName: '',
      accountType: '普通',
      accountNumber: '',
      accountHolder: '',
      accountHolderKana: ''
    }]);
  };

  const removeBankAccount = (index) => {
    const newAccounts = bankAccounts.filter((_, i) => i !== index);
    if (bankAccounts[index].isPrimary && newAccounts.length > 0) {
      newAccounts[0].isPrimary = true;
    }
    setBankAccounts(newAccounts);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setMessage({ type: '', text: '' });

    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, {
        address: profileData.address,
        phone1: profileData.phone1,
        phone2: profileData.phone2,
        bankAccounts: bankAccounts,
        updatedAt: serverTimestamp()
      });

      // 🚀 操作履歴（ログ）の書き込み
      await addDoc(collection(db, 'audit_logs'), {
        action: 'UPDATE',
        userName: profileData.name || currentUser.displayName || '名称未設定',
        userId: currentUser.uid,
        target: 'アカウント設定',
        details: '基本情報・口座情報を更新しました',
        createdAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: '基本情報・口座情報を更新しました。' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (error) {
      console.error("更新エラー:", error);
      setMessage({ type: 'error', text: '情報の更新に失敗しました。' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: '新しいパスワードと確認用パスワードが一致しません。' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください。' });
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(currentUser, passwordData.newPassword);

      // 🚀 操作履歴（ログ）の書き込み
      await addDoc(collection(db, 'audit_logs'), {
        action: 'UPDATE',
        userName: profileData.name || currentUser.displayName || '名称未設定',
        userId: currentUser.uid,
        target: 'アカウント設定',
        details: 'パスワードを変更しました',
        createdAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: 'パスワードを変更しました。次回から新しいパスワードでログインしてください。' });
      setPasswordData({ newPassword: '', confirmPassword: '' }); 
      
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (error) {
      console.error("パスワード変更エラー:", error);
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'セキュリティ上の理由により、パスワードを変更するには一度ログアウトし、再度ログインし直してから実行してください。' });
      } else {
        setMessage({ type: 'error', text: 'パスワードの変更に失敗しました。' });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass = "w-full min-w-0 box-border border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-green-500 bg-white disabled:bg-gray-100 disabled:text-gray-500";
  const bankInputClass = "w-full min-w-0 box-border border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <p className="text-green-800 font-bold">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12 w-full overflow-x-hidden">
      
      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
          <User className="w-6 h-6 mr-2 text-green-600" />
          アカウント設定
        </h1>
      </header>

      <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        
        {message.text && (
          <div className={`p-4 rounded-xl flex items-center font-bold animate-in fade-in ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          <div className="space-y-6">
            <form onSubmit={handleSaveProfile} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
              
              <div className="border-b pb-2 mb-4">
                <h2 className="font-bold text-gray-800 flex items-center text-lg">
                  <User className="w-5 h-5 mr-2 text-blue-600" />
                  基本情報・連絡先
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                    <User size={16} className="mr-1 text-gray-400" /> 表示名（お名前）
                  </label>
                  <input
                    type="text"
                    value={profileData.name}
                    disabled
                    className="w-full box-border border border-gray-200 rounded-xl p-3 bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">
                    ※表示名の変更はシステム管理者にご連絡ください。
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center">
                    <Mail size={16} className="mr-1 text-gray-400" /> ログインID (メールアドレス)
                  </label>
                  <input 
                    type="email" 
                    name="email" 
                    value={profileData.email} 
                    className={inputClass} 
                    disabled
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-bold">※ログインIDとして使用しているため変更できません。</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center"><MapPin size={16} className="mr-1 text-gray-400" /> 住所</label>
                  <input type="text" name="address" value={profileData.address} onChange={handleProfileChange} className={inputClass} placeholder="例：新潟県柏崎市西山町..." />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center"><Phone size={16} className="mr-1 text-gray-400" /> 電話番号1 (メイン)</span>
                    </label>
                    <input 
                      type="tel" 
                      name="phone1" 
                      value={profileData.phone1} 
                      onChange={handlePhoneChange} 
                      className={inputClass} 
                      placeholder="09012345678" 
                      maxLength={15}
                      inputMode="numeric"
                      disabled={isPhoneLogin} 
                    />
                    {isPhoneLogin ? (
                      <p className="text-[10px] text-gray-400 mt-1 font-bold">※ログインIDのため変更できません。</p>
                    ) : (
                      <p className="text-[10px] text-gray-400 mt-1">※ハイフンなし・半角数字</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center"><Phone size={16} className="mr-1 text-gray-400" /> 電話番号2 (サブ)</span>
                    </label>
                    <input 
                      type="tel" 
                      name="phone2" 
                      value={profileData.phone2} 
                      onChange={handlePhoneChange} 
                      className={inputClass} 
                      placeholder="0251234567" 
                      maxLength={15}
                      inputMode="numeric"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">※ハイフンなし・半角数字</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6 mt-6">
                <h3 className="font-bold text-gray-600 flex items-center mb-4 text-md">
                  <CreditCard className="w-5 h-5 mr-2 text-gray-500" />
                  振込口座情報
                </h3>
                
                <div className="space-y-4 bg-gray-50/50 p-2 sm:p-4 rounded-xl">
                  {bankAccounts.map((acc, index) => (
                    <div key={acc.id} className={`relative bg-white border-2 rounded-xl p-4 sm:p-5 transition-colors ${acc.isPrimary ? 'border-purple-400 shadow-sm' : 'border-gray-200'}`}>
                      
                      <div className="flex justify-between items-center mb-4">
                        <div className="font-bold text-gray-700 flex items-center">
                          口座情報 {index + 1}
                          {index > 0 && (
                            <button type="button" onClick={() => removeBankAccount(index)} className="ml-3 text-red-400 hover:text-red-600 p-1 bg-red-50 rounded-md transition-colors" title="削除">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        <label className={`flex items-center space-x-2 text-sm font-bold px-3 py-1.5 border rounded-lg cursor-pointer transition-colors ${acc.isPrimary ? 'border-purple-200 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100'}`}>
                          <input type="radio" checked={acc.isPrimary} onChange={() => setPrimaryAccount(index)} className="w-4 h-4 text-blue-600 bg-white border-gray-300 focus:ring-blue-500 cursor-pointer" />
                          <span>振込先に指定</span>
                        </label>
                      </div>

                      <div className="flex items-center space-x-6 mb-4">
                        <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-700 text-sm">
                          <input type="radio" checked={acc.bankType === 'other'} onChange={() => handleBankChange(index, 'bankType', 'other')} className="w-5 h-5 text-blue-600 bg-white border-gray-300 focus:ring-blue-500" />
                          <span>ゆうちょ銀行以外</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-700 text-sm">
                          <input type="radio" checked={acc.bankType === 'yucho'} onChange={() => handleBankChange(index, 'bankType', 'yucho')} className="w-5 h-5 text-blue-600 bg-white border-gray-300 focus:ring-blue-500" />
                          <span>ゆうちょ銀行</span>
                        </label>
                      </div>

                      {acc.bankType === 'other' ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                            <div className="col-span-1">
                              <label className="block text-xs text-gray-500 mb-1">銀行番号</label>
                              <input type="text" value={acc.bankCode} onChange={(e) => handleBankChange(index, 'bankCode', e.target.value)} className={bankInputClass} placeholder="0001" />
                            </div>
                            <div className="col-span-1 sm:col-span-1">
                              <label className="block text-xs text-gray-500 mb-1">金融機関名</label>
                              <input type="text" value={acc.bankName} onChange={(e) => handleBankChange(index, 'bankName', e.target.value)} className={bankInputClass} placeholder="例：〇〇銀行" />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-xs text-gray-500 mb-1">支店番号</label>
                              <input type="text" value={acc.branchCode} onChange={(e) => handleBankChange(index, 'branchCode', e.target.value)} className={bankInputClass} placeholder="123" />
                            </div>
                            <div className="col-span-1 sm:col-span-1">
                              <label className="block text-xs text-gray-500 mb-1">支店名</label>
                              <input type="text" value={acc.branchName} onChange={(e) => handleBankChange(index, 'branchName', e.target.value)} className={bankInputClass} placeholder="例：××支店" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">記号（5桁）</label>
                            <input type="text" value={acc.bankCode} onChange={(e) => handleBankChange(index, 'bankCode', e.target.value)} className={bankInputClass} placeholder="12345" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">番号（8桁以下）</label>
                            <input type="text" value={acc.accountNumber} onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)} className={bankInputClass} placeholder="12345678" />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="col-span-1">
                          <label className="block text-xs text-gray-500 mb-1">種目</label>
                          <select value={acc.accountType} onChange={(e) => handleBankChange(index, 'accountType', e.target.value)} className={bankInputClass}>
                            <option value="普通">普通</option>
                            <option value="当座">当座</option>
                            <option value="貯蓄">貯蓄</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">口座番号</label>
                          <input type="text" value={acc.accountNumber} onChange={(e) => handleBankChange(index, 'accountNumber', e.target.value)} className={bankInputClass} placeholder="1234567" disabled={acc.bankType === 'yucho'} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">口座名義人</label>
                          <input type="text" value={acc.accountHolder} onChange={(e) => handleBankChange(index, 'accountHolder', e.target.value)} className={bankInputClass} placeholder="山田 太郎" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">フリガナ</label>
                          <input type="text" value={acc.accountHolderKana} onChange={(e) => handleBankChange(index, 'accountHolderKana', e.target.value)} className={bankInputClass} placeholder="ヤマダ タロウ" />
                        </div>
                      </div>

                    </div>
                  ))}

                  {bankAccounts.length < 2 && (
                    <button type="button" onClick={addBankAccount} className="w-full py-4 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl font-bold flex justify-center items-center hover:bg-gray-100 hover:text-gray-700 transition-all">
                      <Plus size={18} className="mr-2" /> 口座情報 {bankAccounts.length + 1}（予備）を追加する
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button type="submit" disabled={savingProfile} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed">
                  {savingProfile ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  {savingProfile ? '保存中...' : '基本情報・口座を保存する'}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            {isGoogleUser ? (
              <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <div className="border-b pb-2 mb-4">
                  <h2 className="font-bold text-gray-800 flex items-center text-lg">
                    <Lock className="w-5 h-5 mr-2 text-gray-400" />
                    パスワードの変更
                  </h2>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold flex items-start leading-relaxed">
                  <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500 shrink-0" />
                  <p>Googleアカウントでログインしているため、このシステムから直接パスワードを変更することはできません。<br/><br/>パスワードの変更が必要な場合は、Googleアカウントの設定画面からお手続きください。</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePassword} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5 h-fit">
                <div className="border-b pb-2 mb-4">
                  <h2 className="font-bold text-gray-800 flex items-center text-lg">
                    <Lock className="w-5 h-5 mr-2 text-purple-600" />
                    パスワードの変更
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">初回ログイン後や、セキュリティのためにパスワードを変更してください。</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">新しいパスワード (6文字以上)</label>
                    <input 
                      type="password" 
                      name="newPassword" 
                      value={passwordData.newPassword} 
                      onChange={handlePasswordChange} 
                      className={inputClass} 
                      placeholder="••••••••" 
                      required 
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">新しいパスワード (確認用)</label>
                    <input 
                      type="password" 
                      name="confirmPassword" 
                      value={passwordData.confirmPassword} 
                      onChange={handlePasswordChange} 
                      className={inputClass} 
                      placeholder="••••••••" 
                      required 
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={savingPassword || !passwordData.newPassword} className="w-full py-3.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-md active:scale-95 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed">
                    {savingPassword ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
                    {savingPassword ? '変更中...' : 'パスワードを変更する'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default ProfileSettings;
