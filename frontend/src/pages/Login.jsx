import React, { useState, useEffect } from 'react';
import { Sprout, LogIn, AlertCircle, Mail, Lock, UserPlus, Phone, Download, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
// 🚀 ログ記録用に addDoc, collection を追加
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore'; 
import { auth, googleProvider, db } from '../firebase'; 

export const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [isSignUp, setIsSignUp] = useState(false); 
  const [loginIdInput, setLoginIdInput] = useState(''); 
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  const [saveId, setSaveId] = useState(false);

  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const [isSafeChrome, setIsSafeChrome] = useState(false);

  const isLineBrowser = /Line/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isIOSChrome = isIOS && /CriOS/i.test(navigator.userAgent);

  useEffect(() => {
    const checkBrowserEnvironment = () => {
      try {
        const ua = window.navigator.userAgent.toLowerCase();
        
        const isChromeBrowser = (ua.includes('chrome') || ua.includes('crios')) && 
                                !ua.includes('edg') && !ua.includes('opr') && !ua.includes('brave');

        if (!isChromeBrowser) {
          setIsSafeChrome(false);
          return;
        }

        if (window.navigator.standalone === true) {
          setIsSafeChrome(false);
          return;
        }
        
        if (window.matchMedia && (
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches
        )) {
          setIsSafeChrome(false);
          return;
        }

        if (document.referrer.includes('android-app://')) {
          setIsSafeChrome(false);
          return;
        }

        const isIOSDevice = /iphone|ipad|ipod/.test(ua);
        if (isIOSDevice) {
          const browserUIHeight = window.screen.height - window.innerHeight;
          if (browserUIHeight < 120) {
            setIsSafeChrome(false);
            return;
          }
        }

        setIsSafeChrome(true);
      } catch (err) {
        setIsSafeChrome(false);
      }
    };

    checkBrowserEnvironment();
    window.addEventListener('resize', checkBrowserEnvironment);

    if (window.navigator.standalone === true || document.referrer.includes('android-app://')) {
      document.body.classList.add('is-pwa');
    }
    const ua2 = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua2) && (window.screen.height - window.innerHeight < 120)) {
      document.body.classList.add('is-pwa');
    }

    return () => {
      window.removeEventListener('resize', checkBrowserEnvironment);
      document.body.classList.remove('is-pwa');
    };
  }, []);

  const handleForceUpdate = async () => {
    setLoading(true);
    setError("システムを最新状態に更新中...");
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.update();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) {
          await caches.delete(key);
        }
      }
      const cleanUrl = window.location.origin + window.location.pathname;
      window.location.href = `${cleanUrl}?u=${Date.now()}`;
    } catch (err) {
      console.error("強制更新エラー:", err);
      window.location.reload();
    }
  };

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

  useEffect(() => {
    const savedId = localStorage.getItem('kamata_saved_login_id');
    if (savedId) {
      setLoginIdInput(savedId);
      setSaveId(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSafeChrome) return; 
    
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserData(result.user, result.user.displayName);
      
      // 🚀 操作履歴（ログ）の書き込み
      await addDoc(collection(db, 'audit_logs'), {
        action: 'LOGIN',
        userName: result.user.displayName || '名称未設定',
        userId: result.user.uid,
        target: 'システムログイン',
        details: 'Googleアカウントを使用してログインしました',
        createdAt: serverTimestamp()
      });

      navigate('/dashboard');
    } catch (err) {
      console.error("Google Login Error:", err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
         setError("Googleログインに失敗しました。もう一度お試しください。");
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp && (!displayName.trim() || !loginIdInput.trim() || !password.trim())) {
      setError("すべての項目（お名前、メールアドレス、パスワード）を入力してください。");
      setLoading(false); return;
    }
    if (!isSignUp && (!loginIdInput.trim() || !password.trim())) {
      setError("ログインIDとパスワードを入力してください。");
      setLoading(false); return;
    }

    try {
      let finalLoginId = loginIdInput;
      if (!loginIdInput.includes('@')) {
        if (isSignUp) {
          setError("電話番号での新規登録はシステム管理者のみ可能です。");
          setLoading(false); return;
        }
        const cleanPhone = loginIdInput.replace(/[^0-9]/g, '');
        finalLoginId = `${cleanPhone}@kamata.local`;
      }

      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, finalLoginId, password);
        await updateProfile(result.user, { displayName: displayName.trim() });
        await createUserData(result.user, displayName.trim());

        // 🚀 操作履歴（ログ）の書き込み
        await addDoc(collection(db, 'audit_logs'), {
          action: 'CREATE',
          userName: displayName.trim(),
          userId: result.user.uid,
          target: 'システムログイン',
          details: '新規アカウント作成（メール・電話番号）を行いました',
          createdAt: serverTimestamp()
        });

        alert("アカウントを作成しました。管理者の承認をお待ちください。");
      } else {
        const result = await signInWithEmailAndPassword(auth, finalLoginId, password);
        
        // 🚀 操作履歴（ログ）の書き込み
        await addDoc(collection(db, 'audit_logs'), {
          action: 'LOGIN',
          userName: result.user.displayName || '名称未設定',
          userId: result.user.uid,
          target: 'システムログイン',
          details: 'IDとパスワードを使用してログインしました',
          createdAt: serverTimestamp()
        });
      }

      if (saveId) localStorage.setItem('kamata_saved_login_id', loginIdInput);
      else localStorage.removeItem('kamata_saved_login_id');

      navigate('/dashboard');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError("このメールアドレスは既に登録されています。");
      else if (err.code === 'auth/weak-password') setError("パスワードは6文字以上で入力してください。");
      else if (err.code === 'auth/invalid-credential') setError("ログインIDまたはパスワードが正しくありません。");
      else setError("認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  if (isLineBrowser) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-8 px-4">
        <div className="bg-white py-8 px-5 sm:px-8 shadow-xl rounded-2xl border-t-8 border-green-600 w-full text-center" style={{ maxWidth: '400px' }}>
          <div className="flex justify-center text-red-500 mb-4"><AlertCircle size={56} /></div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-3 tracking-tight">LINEから直接開けません</h2>
          <p className="text-gray-700 font-bold mb-6 text-sm leading-relaxed">
            写真の追加などを正常に行うため、<br/>お使いの標準ブラウザ（Safari や Chrome）で<br/>開き直す必要があります。
          </p>
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-sm text-gray-700 text-left space-y-5">
            <div>
              <span className="font-extrabold text-blue-600 block mb-1 text-base">【iPhone の方】</span>
              右下の <span className="font-bold border border-gray-300 bg-white px-1.5 py-0.5 rounded text-lg">🧭</span> （コンパス）マーク、<br/>または <span className="font-bold border border-gray-300 bg-white px-1.5 py-0.5 rounded text-lg">↗️</span> （共有）から<br/>「Safariで開く」を押してください。
            </div>
            <div className="border-t border-gray-200 pt-4">
              <span className="font-extrabold text-green-600 block mb-1 text-base">【Android の方】</span>
              右上の <span className="font-bold border border-gray-300 bg-white px-1.5 py-0.5 rounded text-lg">︙</span> を押して<br/>「他のアプリで開く」または<br/>「ブラウザで開く」を押してください。
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-8 px-4 relative">
      
      <style>{`
        .pwa-warning-section { display: none; }
        
        @media all and (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui) {
          .google-login-section { display: none !important; }
          .pwa-warning-section { display: block !important; }
        }

        body.is-pwa .google-login-section { display: none !important; }
        body.is-pwa .pwa-warning-section { display: block !important; }
      `}</style>

      {showInstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Download size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">ホーム画面に追加</h3>
              <p className="text-sm text-gray-600 mb-4">
                このシステムをスマホの画面に追加して、<br />次回からアプリのように開けます。
              </p>
              
              <div className="bg-gray-50 p-4 rounded-xl w-full border border-gray-200 text-left space-y-4">
                {isIOSChrome ? (
                  <div>
                    <span className="font-extrabold text-blue-600 block mb-2 text-base">【iPhone (Chrome) の手順】</span>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-3 font-bold leading-relaxed">
                      <li>画面<strong>右上</strong>の <span className="font-bold border border-gray-300 bg-white px-1.5 py-1 rounded mx-1">↗️ 共有マーク</span> を押す</li>
                      <li>少し下にスクロールして<br/><span className="text-black bg-gray-200 px-2 py-1 rounded">＋ ホーム画面に追加</span> を押す</li>
                      <li>右上の<strong>「追加」</strong>を押す</li>
                    </ol>
                    <p className="text-[10px] text-red-500 mt-3 font-bold">※「ホーム画面に追加」が出ない場合は、Safariブラウザで開き直してお試しください。</p>
                  </div>
                ) : isIOS ? (
                  <div>
                    <span className="font-extrabold text-blue-600 block mb-2 text-base">【iPhone (Safari) の手順】</span>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-3 font-bold leading-relaxed">
                      <li>画面<strong>下部</strong>の <span className="font-bold border border-gray-300 bg-white px-1.5 py-1 rounded mx-1">↗️ 共有マーク</span> を押す</li>
                      <li>少し下にスクロールして<br/><span className="text-black bg-gray-200 px-2 py-1 rounded">＋ ホーム画面に追加</span> を押す</li>
                      <li>右上の<strong>「追加」</strong>を押す</li>
                    </ol>
                  </div>
                ) : (
                  <div>
                    <span className="font-extrabold text-green-600 block mb-2 text-base">【Android (Chrome) の手順】</span>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-3 font-bold leading-relaxed">
                      <li>画面右上の <span className="font-bold border border-gray-300 bg-white px-1.5 py-1 rounded mx-1">︙ メニュー</span> を押す</li>
                      <li><span className="text-black bg-gray-200 px-2 py-1 rounded">ホーム画面に追加</span><br/>または「アプリをインストール」を押す</li>
                      <li><strong>「追加」</strong>を押す</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
              <button onClick={() => setShowInstallModal(false)} className="w-full py-2.5 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full text-center" style={{ maxWidth: '400px' }}>
        <div className="flex justify-center text-green-600 mb-3"><Sprout size={44} /></div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">多面的機能発揮促進事業 管理システム</h2>
        <p className="mt-1 text-sm text-gray-500 font-bold">[鎌田地区]</p>
      </div>

      <div className="mt-6 w-full" style={{ maxWidth: '400px' }}>
        <div className="bg-white py-6 px-6 shadow-xl rounded-2xl border border-gray-100">
          
          {loading && (
             <div className="mb-4 bg-blue-50 border border-blue-200 p-3 text-blue-700 text-sm font-bold flex items-center justify-center rounded-lg">
               通信中... しばらくお待ちください。
             </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-3 text-red-700 text-sm flex items-center rounded-lg">
              <AlertCircle className="mr-2 h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">お名前 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" 
                    placeholder="農園 太郎" 
                    required={isSignUp}
                    autoComplete="name" 
                  />
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
                  autoComplete="username" 
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center">
                  {loginIdInput.includes('@') || loginIdInput === '' ? <Mail className="h-4 w-4 text-gray-400" /> : <Phone className="h-4 w-4 text-gray-400" />}
                </div>
              </div>
            </div>

            {/* 🚀 タイポ修正完了部分 */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">パスワード <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm" 
                  placeholder="••••••••" 
                  required 
                  autoComplete={isSignUp ? "new-password" : "current-password"} 
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center"><Lock className="h-4 w-4 text-gray-400" /></div>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center pt-1">
                <input id="saveIdCheckbox" type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer" />
                <label htmlFor="saveIdCheckbox" className="ml-2 text-xs font-bold text-gray-600 cursor-pointer select-none">次回からログインIDの入力を省略する</label>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex justify-center items-center py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all shadow-sm active:scale-95 mt-2 text-sm">
              {isSignUp ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
              {loading ? '通信中...' : (isSignUp ? 'アカウントを作成する' : 'ログイン')}
            </button>
          </form>

          <div className="text-center mb-5">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="text-xs sm:text-sm text-green-600 font-bold hover:underline">
              {isSignUp ? '既にアカウントをお持ちの方はこちら' : '初めての方はこちら（新規登録）'}
            </button>
          </div>

          <div className="google-login-section">
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">またはGoogleでログイン</span></div>
            </div>

            <button 
              type="button" 
              onClick={handleGoogleLogin} 
              disabled={loading || !isSafeChrome} 
              className={`w-full flex justify-center items-center py-2.5 border rounded-lg font-bold text-sm transition-all shadow-sm ${(!isSafeChrome || loading) ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:scale-95'}`}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className={`w-4 h-4 mr-2 ${!isSafeChrome ? 'opacity-40 grayscale' : ''}`} />
              Googleアカウントを使用
            </button>
          </div>

          <div className="pwa-warning-section mt-4">
            <div className="text-center bg-orange-50 p-2.5 rounded-lg border border-orange-100 shadow-sm">
              <p className="text-xs text-orange-700 font-bold leading-relaxed">
                ※セキュリティ上の理由により、Googleログインは<span className="underline">Chromeブラウザ専用</span>です（アプリ版やSafariは不可）。<br/>IDとパスワードでログインしてください。
              </p>
            </div>
          </div>

        </div>

        <div className="mt-6 w-full space-y-3">
          <button 
            type="button"
            onClick={handleInstallClick}
            className="w-full flex justify-center items-center py-3.5 bg-white text-gray-800 border-2 border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm text-sm"
          >
            <Download className="mr-2 h-5 w-5 text-green-600" />
            スマホのホーム画面に追加する（アプリ化）
          </button>

          <button 
            type="button"
            onClick={handleForceUpdate}
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 bg-gray-200 text-gray-600 border border-gray-300 rounded-xl font-bold hover:bg-gray-300 transition-all text-xs"
            title="アプリに最新の修正内容を強制反映します"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            アプリを最新状態に更新（強制キャッシュクリア）
          </button>
        </div>

      </div>
    </div>
  );
};

export default Login;
