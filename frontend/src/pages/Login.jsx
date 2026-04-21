import React, { useState } from 'react';
import { Sprout, LogIn, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase'; // firebase.jsからインポート

export const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Googleログイン処理
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Googleのログインポップアップを表示
      const result = await signInWithPopup(auth, googleProvider);
      console.log("ログイン成功:", result.user.displayName);
      
      // ログイン成功後、ダッシュボードへ遷移
      navigate('/dashboard');
    } catch (err) {
      console.error("ログインエラー:", err);
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-green-600">
          <Sprout size={48} />
        </div>
        <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900">
          農地維持管理システム by 鎌田緑保護会
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          多面的機能発揮促進事業 ERP
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            
            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 flex items-center text-red-700 text-sm">
                <AlertCircle className="mr-2 h-5 w-5" />
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <LogIn className="mr-2 h-5 w-5" />
              {loading ? '通信中...' : 'Googleアカウントでログイン'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">または</span>
              </div>
            </div>

            <button 
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
              ゲストとして閲覧（デモ用）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
