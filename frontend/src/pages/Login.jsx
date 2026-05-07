import React, { useState } from 'react';
import { Sprout, LogIn, AlertCircle, Mail, Lock, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'; 
import { auth, googleProvider, db } from '../firebase'; 

export const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 🚀 メールアドレス認証用のState
  const [isSignUp, setIsSignUp] = useState(false); // ログインと新規登録の切り替え
  const [email, setEmail] = useState('');
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

  // 🚀 メールアドレスでのログイン/登録
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        // 新規登録
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: displayName });
        await createUserData(result.user, displayName);
        alert("アカウントを作成しました。管理者の承認をお待ちください。");
      } else {
        // ログイン
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') setError("このメールアドレスは既に登録されています。");
      else if (err.code === 'auth/weak-password') setError("パスワードは6文字以上で入力してください。");
      else if (err.code === 'auth/invalid-credential') setError("メールアドレスまたはパスワードが正しくありません。");
      else setError("認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center text-green-600 mb-4"><Sprout size={48} /></div>
        <h2 className="text-2xl font-extrabold text-gray-900">農事組合法人カマタ ERP</h2>
        <p className="mt-2 text-sm text-gray-600">多面的機能発揮促進事業 管理システム</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow sm:rounded-2xl border border-gray-100">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 text-red-700 text-sm flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* メールアドレスフォーム */}
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            {isSignUp && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">お名前</label>
                <div className="relative">
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500" placeholder="農園 太郎" required={isSignUp} />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Mail className="h-4 w-4 text-gray-400" /></div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">メールアドレス</label>
              <div className="relative">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500" placeholder="example@mail.com" required />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Mail className="h-4 w-4 text-gray-400" /></div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">パスワード</label>
              <div className="relative">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500" placeholder="••••••••" required />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Lock className="h-4 w-4 text-gray-400" /></div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md active:scale-95">
              {isSignUp ? <UserPlus className="mr-2 h-5 w-5" /> : <LogIn className="mr-2 h-5 w-5" />}
              {loading ? '通信中...' : (isSignUp ? 'アカウントを作成する' : 'メールアドレスでログイン')}
            </button>
          </form>

          <div className="text-center mb-6">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-green-600 font-bold hover:underline">
              {isSignUp ? '既にアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">またはGoogleでログイン</span></div>
          </div>

          <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex justify-center items-center py-3 border border-gray-300 rounded-xl font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all shadow-sm">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5 mr-2" />
            Googleアカウントを使用
          </button>
        </div>
      </div>
    </div>
  );
};