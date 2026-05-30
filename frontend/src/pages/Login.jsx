import React, { useState } from 'react';
import { Sprout, LogIn, AlertCircle, Mail, Lock, UserPlus, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, googleProvider, db } from '../firebase'; 

export const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [isSignUp, setIsSignUp] = useState(false); 
  const [loginIdInput, setLoginIdInput] = useState(''); 
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // 共通のユーザー登録処理
  const createUserData = async (user, name) => {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        name: name || user.displayName || '名称未設定',
        email: user.email || '',
        role: 'reporter',
        groupIds: [],
        createdAt: serverTimestamp()
      });
    }
  };

  // Googleログイン
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserData(result.user);
      navigate('/dashboard');
    } catch (err) {
      setError("Googleログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // メールアドレス/電話番号でのログイン/登録処理
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 厳密な空欄チェック
    if (isSignUp && (!displayName.trim() || !loginIdInput.trim() || !password.trim())) {
      setError("すべての項目（お名前、メールアドレス、パスワード）を入力してください。");
      setLoading(false);
      return;
    }
    if (!isSignUp && (!loginIdInput.trim() || !password.trim())) {
      setError("ログインIDとパスワードを入力してください。");
      setLoading(false);
      return;
    }

    try {
      let finalLoginId = loginIdInput;
      
      // @が含まれていない場合は「電話番号」として扱う
      if (!loginIdInput.includes('@')) {
        if (isSignUp) {
          // 一般ユーザーが電話番号で新規登録しようとした場合は弾く
          setError("電話番号での新規登録はシステム管理者のみ可能です。管理者にアカウント作成をご依頼ください。");
          setLoading(false);
          return;
        }
        // ハイフン等を除去してダミーメールアドレスを生成
        const cleanPhone = loginIdInput.replace(/[^0-9]/g, '');
        finalLoginId = `${cleanPhone}@kamata.local`;
      }

      if (isSignUp) {
        // 新規登録（メールアドレスのみ）
        const result = await createUserWithEmailAndPassword(auth, finalLoginId, password);
        await updateProfile(result.user, { displayName: displayName.trim() });
        await createUserData(result.user, displayName.trim());
        alert("アカウントを作成しました。管理者の承認をお待ちください。");
      } else {
        // ログイン（メールアドレス or 変換済み電話番号）
        await signInWithEmailAndPassword(auth, finalLoginId, password);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') setError("このメールアドレスは既に登録されています。");
      else if (err.code === 'auth/weak-password') setError("パスワードは6文字以上で入力してください。");
      else if (err.code === 'auth/invalid-credential') setError("ログインIDまたはパスワードが正しくありません。");
      else setError("認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
      {/* 🚀 どんな画面サイズでも幅を固定し、上下の余白を調整 */}
      <div className="w-full max-w-[420px] mx-auto text-center">
        <div className="flex justify-center text-green-600 mb-3"><Sprout size={44} /></div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">多面的機能発揮促進事業 管理システム</h2>
        <p className="mt-1.5 text-sm text-gray-500 font-bold">[鎌田地区]</p>
      </div>

      <div className="mt-6 w-full max-w-[420px] mx-auto">
        <div className="bg-white py-6 px-6 shadow-xl rounded-2xl border border-gray-100">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 text-red-700 text-sm flex items-center rounded-lg">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* フォーム */}
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" placeholder="農園 太郎" required={isSignUp} />
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center"><UserPlus className="h-4 w-4 text-gray-400" /></div>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {isSignUp ? 'メールアドレス' : 'ログインID (メール または 電話番号)'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={loginIdInput} 
                  onChange={(e) => setLoginIdInput(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" 
                  placeholder={isSignUp ? "example@mail.com" : "example@mail.com または 09012345678"} 
                  required 
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center">
                  {loginIdInput.includes('@') || loginIdInput === '' ? <Mail className="h-4 w-4 text-gray-400" /> : <Phone className="h-4 w-4 text-gray-400" />}
                </div>
              </div>
              {isSignUp && (
                <p className="text-[10px] text-gray-500 mt-1 ml-1">※電話番号での新規登録は管理者にご依頼ください</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                パスワード <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" placeholder="••••••••" required />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center"><Lock className="h-4 w-4 text-gray-400" /></div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all shadow-sm active:scale-95 mt-2 text-sm sm:text-base">
              {isSignUp ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
              {loading ? '通信中...' : (isSignUp ? 'アカウントを作成する' : 'ログイン')}
            </button>
          </form>

          <div className="text-center mb-5">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-xs sm:text-sm text-green-600 font-bold hover:underline">
              {isSignUp ? '既にアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
            </button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">またはGoogleでログイン</span></div>
          </div>

          <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full flex justify-center items-center py-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 text-sm bg-white hover:bg-gray-50 transition-all shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-4 h-4 mr-2" />
            Googleアカウントを使用
          </button>
        </div>
      </div>
    </div>
  );
};
