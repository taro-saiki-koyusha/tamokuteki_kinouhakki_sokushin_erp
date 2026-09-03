import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, writeBatch, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, Database, Download, Upload, AlertTriangle, ShieldCheck, CheckCircle, Loader2, Info, FileJson } from 'lucide-react';
import { db, auth } from '../firebase';

export const BackupManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const [backupStatus, setBackupStatus] = useState('idle'); // idle, loading, success, error
  const [restoreStatus, setRestoreStatus] = useState('idle');
  const [restoreFile, setRestoreFile] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 🚀 個別リストア（JSON貼り付け）用のステート
  const [pastedJson, setPastedJson] = useState('');
  const [pasteRestoreStatus, setPasteRestoreStatus] = useState('idle');
  const [pasteCollection, setPasteCollection] = useState('activities');

  // バックアップ対象の全コレクション
  const COLLECTIONS_TO_BACKUP = [
    'users', 'groups', 'members', 'machines', 'materials', 'activities', 'settings', 'audit_logs'
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
            setUserName(userDoc.data().displayName || userDoc.data().name || '管理者');
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("権限確認エラー:", error);
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleBackup = async () => {
    setBackupStatus('loading');
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        collections: {}
      };

      for (const colName of COLLECTIONS_TO_BACKUP) {
        const querySnapshot = await getDocs(collection(db, colName));
        backupData.collections[colName] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `kamata_erp_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await addDoc(collection(db, 'audit_logs'), {
        action: 'BACKUP',
        userName: userName,
        userId: auth.currentUser.uid,
        target: 'システム設定',
        details: 'データベースのフルバックアップ（JSONエクスポート）を実行しました',
        createdAt: serverTimestamp()
      });

      setBackupStatus('success');
      setTimeout(() => setBackupStatus('idle'), 5000);
    } catch (error) {
      console.error("バックアップエラー:", error);
      setBackupStatus('error');
      setTimeout(() => setBackupStatus('idle'), 5000);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setRestoreFile(e.target.files[0]);
    }
  };

  const executeRestore = async () => {
    if (!restoreFile) return;
    
    setShowConfirmModal(false);
    setRestoreStatus('loading');
    
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);

      if (!backupData.collections) {
        throw new Error("無効なバックアップファイル形式です。");
      }

      for (const colName of Object.keys(backupData.collections)) {
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const item of backupData.collections[colName]) {
          const { id, ...docData } = item;
          const docRef = doc(db, colName, id);
          
          batch.set(docRef, docData);
          operationCount++;

          if (operationCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }
        
        if (operationCount > 0) {
          await batch.commit();
        }
      }

      await addDoc(collection(db, 'audit_logs'), {
        action: 'RESTORE',
        userName: userName,
        userId: auth.currentUser.uid,
        target: 'システム設定',
        details: `バックアップファイル（${restoreFile.name}）からデータベースを復元しました`,
        createdAt: serverTimestamp()
      });

      setRestoreStatus('success');
      setRestoreFile(null);
      document.getElementById('restoreFileInput').value = '';
      
    } catch (error) {
      console.error("リストアエラー:", error);
      setRestoreStatus('error');
    }
  };

  // 🚀 個別リストア（JSON貼り付け）実行
  const executePasteRestore = async () => {
    if (!pastedJson.trim()) return;
    if (!window.confirm(`貼り付けられたデータを「${pasteCollection}」に復元（上書き・追加）しますか？`)) return;
    
    setPasteRestoreStatus('loading');
    try {
      const parsedData = JSON.parse(pastedJson);
      // 単一オブジェクトの場合は配列に変換
      const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];
      
      let batch = writeBatch(db);
      let count = 0;

      for (const item of dataArray) {
        const { id, ...docData } = item;
        if (!id) throw new Error("JSON内に 'id' フィールドが含まれていないデータがあります。");

        // 日付型（Timestamp）の復元処理（seconds があるものは Timestamp クラスに変換）
        const convertTimestamps = (obj) => {
          for (const key in obj) {
            if (obj[key] !== null && typeof obj[key] === 'object') {
              if ('seconds' in obj[key] && 'nanoseconds' in obj[key]) {
                obj[key] = new Timestamp(obj[key].seconds, obj[key].nanoseconds);
              } else {
                convertTimestamps(obj[key]);
              }
            }
          }
        };
        convertTimestamps(docData);

        const docRef = doc(db, pasteCollection, id);
        batch.set(docRef, docData, { merge: true }); // マージで安全に上書き・追加
        count++;

        if (count % 400 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
      }
      
      if (count % 400 !== 0) {
        await batch.commit();
      }

      await addDoc(collection(db, 'audit_logs'), {
        action: 'RESTORE',
        userName: userName,
        userId: auth.currentUser.uid,
        target: 'システム設定',
        details: `JSONの直接貼り付けにより「${pasteCollection}」へ ${count}件 の個別復元を実行しました`,
        createdAt: serverTimestamp()
      });

      setPasteRestoreStatus('success');
      setPastedJson('');
      setTimeout(() => setPasteRestoreStatus('idle'), 5000);
    } catch (error) {
      console.error("個別リストアエラー:", error);
      alert('復元に失敗しました。JSONの形式が正しいか確認してください。\n\n詳細エラー: ' + error.message);
      setPasteRestoreStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-blue-800 font-bold">読み込み中...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <ShieldCheck size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-600 mb-6">Backup/Restore管理画面はシステム管理者のみアクセス可能です。</p>
          <button onClick={() => navigate('/dashboard')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">ダッシュボードへ戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">データの復元（リストア）警告</h3>
              <p className="text-sm text-gray-600 mb-4">
                本当にこのバックアップファイルからデータを復元しますか？<br/>
                <span className="text-red-500 font-bold mt-2 block">現在のシステムデータは上書きされ、元に戻すことはできません！</span>
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex space-x-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button onClick={executeRestore} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center">
                復元を実行する
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
          <Database className="w-6 h-6 mr-2 text-indigo-600" />
          Backup/Restore管理
        </h1>
      </header>

      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start text-sm text-blue-800 font-bold shadow-sm">
          <Info className="w-5 h-5 mr-3 shrink-0 text-blue-600 mt-0.5" />
          <p>
            この画面ではデータベース（活動実績、マスタ、ユーザー情報等）のJSONバックアップを作成・復元できます。<br/>
            画像ファイルの実体はFirebase StorageのGoogle Cloud Consoleから管理してください。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* バックアップ（エクスポート） */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <Download className="text-green-600" size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">データベースのバックアップ</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              現在のシステム上のすべてのデータを1つのファイル（JSON形式）としてダウンロードします。定期的なバックアップを推奨します。
            </p>

            {backupStatus === 'success' && (
              <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center text-green-700 text-sm font-bold animate-in fade-in">
                <CheckCircle size={16} className="mr-2" /> バックアップファイルの作成が完了しました。
              </div>
            )}
            {backupStatus === 'error' && (
              <div className="mb-4 bg-red-50 border border-red-200 p-3 rounded-lg flex items-center text-red-700 text-sm font-bold animate-in fade-in">
                <AlertTriangle size={16} className="mr-2" /> バックアップ中にエラーが発生しました。
              </div>
            )}

            <button 
              onClick={handleBackup} 
              disabled={backupStatus === 'loading'}
              className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backupStatus === 'loading' ? (
                <><Loader2 size={18} className="mr-2 animate-spin" /> データをエクスポート中...</>
              ) : (
                <><Download size={18} className="mr-2" /> バックアップファイルを生成</>
              )}
            </button>
          </div>

          {/* リストア（フルインポート） */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                <Upload className="text-red-600" size={20} />
              </div>
              <h2 className="text-lg font-bold text-gray-800">システムの全体復元 (フルリストア)</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              事前に作成したバックアップファイル（JSON形式）を読み込み、システムの状態を完全に復元します。
            </p>

            <div className="border border-red-200 bg-red-50 p-3 rounded-xl mb-6 flex items-start text-xs text-red-700 font-bold">
              <AlertTriangle size={14} className="mr-2 mt-0.5 shrink-0" />
              現在のシステム上のデータはすべてバックアップの内容で上書きされ、元に戻せません。
            </div>

            {restoreStatus === 'success' && (
              <div className="mb-4 bg-green-50 border border-green-200 p-3 rounded-lg flex items-center text-green-700 text-sm font-bold animate-in fade-in">
                <CheckCircle size={16} className="mr-2" /> データベースの復元が完了しました！
              </div>
            )}

            <div className="space-y-4">
              <div>
                <input 
                  type="file" 
                  id="restoreFileInput"
                  accept=".json" 
                  onChange={handleFileChange}
                  disabled={restoreStatus === 'loading'}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors"
                />
              </div>

              <button 
                onClick={() => setShowConfirmModal(true)} 
                disabled={!restoreFile || restoreStatus === 'loading'}
                className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoreStatus === 'loading' ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" /> 復元中...画面を閉じないでください</>
                ) : (
                  <><Upload size={18} className="mr-2" /> 選択したファイルで全体復元を開始</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 🚀 追加：個別データ復元（JSON貼り付け） */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-200 mt-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
              <FileJson className="text-indigo-600" size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800">個別データの復元（JSON貼り付け）</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            誤って削除してしまったチケットなど、特定のデータのみをバックアップから抽出して復元します。既存の他のデータには影響しません。
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-gray-700">復元先のコレクション:</label>
              <select 
                value={pasteCollection} 
                onChange={(e) => setPasteCollection(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
              >
                {COLLECTIONS_TO_BACKUP.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <textarea 
              value={pastedJson} 
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder='[ { "id": "...", "activityType": "...", ... } ] のように、復元したいデータのJSON配列をここに貼り付けてください。'
              className="w-full h-48 border border-gray-300 rounded-xl p-3 text-sm font-mono text-gray-700 focus:ring-2 focus:ring-indigo-500"
            ></textarea>

            {pasteRestoreStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-center text-green-700 text-sm font-bold animate-in fade-in">
                <CheckCircle size={16} className="mr-2" /> 個別データの復元に成功しました！
              </div>
            )}

            <button 
              onClick={executePasteRestore} 
              disabled={!pastedJson.trim() || pasteRestoreStatus === 'loading'}
              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pasteRestoreStatus === 'loading' ? (
                <><Loader2 size={18} className="mr-2 animate-spin" /> 復元中...</>
              ) : (
                <><Upload size={18} className="mr-2" /> 貼り付けたデータを復元する</>
              )}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
};

export default BackupManagement;