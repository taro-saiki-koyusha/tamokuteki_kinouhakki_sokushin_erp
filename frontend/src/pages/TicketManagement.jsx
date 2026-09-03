import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, CheckCircle, Search, Save, X, Image as ImageIcon, AlertTriangle, Loader2, Plus, Trash2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const TicketCard = ({ title, ticket, onClear, type }) => {
  const safeImageUrls = ticket ? (Array.isArray(ticket.imageUrls) ? ticket.imageUrls : []) : [];
  const imgCount = ticket ? safeImageUrls.length + (ticket.imageUrl && !safeImageUrls.includes(ticket.imageUrl) ? 1 : 0) : 0;

  return (
    <div className={`p-4 rounded-xl border-2 ${type === 'base' ? 'border-blue-200 bg-blue-50' : 'border-indigo-200 bg-indigo-50'} flex-1 relative`}>
      <div className={`text-sm font-bold mb-3 flex items-center ${type === 'base' ? 'text-blue-800' : 'text-indigo-800'}`}>
        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 text-white ${type === 'base' ? 'bg-blue-600' : 'bg-indigo-600'}`}>
          {type === 'base' ? '1' : '2'}
        </span>
        {title}
      </div>
      
      {ticket ? (
        <div className="bg-white p-3 rounded-lg shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-xs text-gray-500 font-bold">{ticket.date}</div>
              <div className="font-bold text-gray-900 line-clamp-1">{ticket.activityType || '（内容未入力）'}</div>
            </div>
            <button onClick={onClear} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
            <ImageIcon size={14} className="mr-1.5" />
            含まれる画像: 
            <span className="font-bold ml-1 text-gray-900">{imgCount} 枚</span>
          </div>
        </div>
      ) : (
        <div className="h-[84px] bg-white/50 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-sm text-gray-400 font-bold">
          下の一覧から選択してください
        </div>
      )}
    </div>
  );
};

export const TicketManagement = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [baseTicketId, setBaseTicketId] = useState(null);
  const [sourceTicketId, setSourceTicketId] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentUser, setCurrentUser] = useState(null);
  const [systemUsers, setSystemUsers] = useState([]); 

  useEffect(() => {
    let unsubscribeData = null;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSystemUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const role = userDoc.exists() ? (userDoc.data().role || 'reporter') : 'reporter';
          
          if (role !== 'admin') {
            navigate('/dashboard');
            return;
          }

          // 🚀 ダッシュボード同様、すべてのチケットを取得（後でフィルタリングする）
          const q = query(collection(db, 'activities'));
          unsubscribeData = onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => {
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              return dateB - dateA;
            });
            setActivities(data);
            setLoading(false);
          });
        } catch (error) {
          console.error("Auth check error:", error);
          setLoading(false);
        }
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubscribeAuth();
      unsubUsers();
      if (unsubscribeData) unsubscribeData();
    };
  }, [navigate]);

  const baseTicket = useMemo(() => activities.find(a => a.id === baseTicketId), [activities, baseTicketId]);
  const sourceTicket = useMemo(() => activities.find(a => a.id === sourceTicketId), [activities, sourceTicketId]);

  // 🚀 アクティブなチケット（削除されていないもの）
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      if (act.isDeleted === true) return false; // 確実に削除フラグを除外
      if (!searchTerm) return true;
      return (act.activityType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
             (act.date || '').includes(searchTerm) ||
             (act.location || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [activities, searchTerm]);

  // 🚀 削除済みのチケット（ごみ箱）
  const deletedActivities = useMemo(() => {
    return activities.filter(act => act.isDeleted === true); // 確実に削除フラグが立っているものを抽出
  }, [activities]);

  const handleMerge = async () => {
    if (!baseTicket || !sourceTicket) return;
    if (baseTicket.id === sourceTicket.id) {
      alert("ベースとコピー元に同じチケットは指定できません。");
      return;
    }

    const confirmMsg = `「${sourceTicket.activityType || '無題'}」(${sourceTicket.date}) の画像を、\n「${baseTicket.activityType || '無題'}」(${baseTicket.date}) にコピー追加します。\n\n※ダッシュボード上ではコピー元がベース側の配下にツリー表示されます。\nよろしいですか？`;
    
    if (!window.confirm(confirmMsg)) return;

    setIsMerging(true);
    try {
      let baseImages = Array.isArray(baseTicket.imageUrls) ? [...baseTicket.imageUrls] : [];
      if (baseTicket.imageUrl && !baseImages.includes(baseTicket.imageUrl)) {
        baseImages.push(baseTicket.imageUrl);
      }

      let sourceImages = Array.isArray(sourceTicket.imageUrls) ? [...sourceTicket.imageUrls] : [];
      if (sourceTicket.imageUrl && !sourceImages.includes(sourceTicket.imageUrl)) {
        sourceImages.push(sourceTicket.imageUrl);
      }

      const combinedImages = [...new Set([...baseImages, ...sourceImages])];

      await updateDoc(doc(db, 'activities', baseTicket.id), {
        imageUrls: combinedImages
      });

      await updateDoc(doc(db, 'activities', sourceTicket.id), {
        mergedInto: baseTicket.id
      });

      const currentUserName = systemUsers.find(u => u.id === currentUser?.uid)?.name || currentUser?.displayName || '管理者';
      await addDoc(collection(db, 'audit_logs'), {
        action: 'UPDATE',
        userName: currentUserName,
        userId: currentUser?.uid || 'unknown',
        target: '活動実績(画像統合)',
        details: `ID: ${sourceTicket.id} の画像を ID: ${baseTicket.id} へコピー統合しました。`,
        createdAt: serverTimestamp()
      });

      alert("画像のコピーと合体が完了しました！");
      setBaseTicketId(null);
      setSourceTicketId(null);
    } catch (error) {
      console.error("Merge error:", error);
      alert("統合処理に失敗しました。");
    } finally {
      setIsMerging(false);
    }
  };

  // 🚀 復元処理
  const handleRestore = async (id, title) => {
    if (!window.confirm(`「${title || '無題'}」を復元しますか？\nダッシュボードの一覧に再度表示されるようになります。`)) return;
    try {
      await updateDoc(doc(db, 'activities', id), {
        isDeleted: false, 
        deletedAt: null
      });
      const currentUserName = systemUsers.find(u => u.id === currentUser?.uid)?.name || currentUser?.displayName || '管理者';
      await addDoc(collection(db, 'audit_logs'), {
        action: 'RESTORE',
        userName: currentUserName,
        userId: currentUser?.uid || 'unknown',
        target: '活動実績',
        details: `ID: ${id} の活動記録をごみ箱から復元しました。`,
        createdAt: serverTimestamp()
      });
      alert('チケットを復元しました！');
    } catch (error) {
      console.error("Restore error:", error);
      alert('復元に失敗しました。');
    }
  };

  // 🚀 完全削除処理
  const handlePermanentDelete = async (id, title) => {
    if (!window.confirm(`「${title || '無題'}」をデータベースから完全に削除しますか？\n※この操作は元に戻せません！`)) return;
    try {
      await deleteDoc(doc(db, 'activities', id));
      const currentUserName = systemUsers.find(u => u.id === currentUser?.uid)?.name || currentUser?.displayName || '管理者';
      await addDoc(collection(db, 'audit_logs'), {
        action: 'DELETE',
        userName: currentUserName,
        userId: currentUser?.uid || 'unknown',
        target: '活動実績',
        details: `ID: ${id} の活動記録をデータベースから完全削除しました。`,
        createdAt: serverTimestamp()
      });
      alert('完全に削除しました。');
    } catch (error) {
      console.error("Permanent delete error:", error);
      alert('削除に失敗しました。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="p-2 text-gray-500 hover:text-gray-800 transition-colors mr-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          チケット管理（画像合体ツール）
        </h1>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-extrabold text-gray-800">⚙️ 合体設定</h2>
            <p className="text-xs text-gray-500 mt-1">
              2つ目のチケットの画像を、1つ目のチケットにコピーし、リスト上でもツリー化させます。
            </p>
          </div>
          
          <div className="p-5 flex flex-col md:flex-row gap-4">
            <TicketCard 
              title="ベースチケット（残す側）" 
              ticket={baseTicket} 
              onClear={() => setBaseTicketId(null)} 
              type="base" 
            />
            
            <div className="hidden md:flex items-center justify-center text-gray-300">
              <Plus size={24} />
            </div>

            <TicketCard 
              title="コピー元（画像を提供し、ベースの配下に入る）" 
              ticket={sourceTicket} 
              onClear={() => setSourceTicketId(null)} 
              type="source" 
            />
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end items-center">
            {baseTicketId === sourceTicketId && baseTicketId !== null && (
              <span className="text-red-500 text-xs font-bold mr-4 flex items-center">
                <AlertTriangle size={14} className="mr-1" />
                同じチケット同士は合体できません
              </span>
            )}
            <button
              onClick={handleMerge}
              disabled={!baseTicketId || !sourceTicketId || baseTicketId === sourceTicketId || isMerging}
              className={`flex items-center px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
                !baseTicketId || !sourceTicketId || baseTicketId === sourceTicketId || isMerging
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
              }`}
            >
              {isMerging ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              {isMerging ? '合体中...' : '画像をコピーして合体'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
            <h2 className="font-extrabold text-gray-800">📋 活動チケット一覧</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="活動名や日付で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-xs text-gray-600">
                  <th className="p-3 font-bold pl-5">日付</th>
                  <th className="p-3 font-bold w-1/3">活動内容</th>
                  <th className="p-3 font-bold text-center">画像</th>
                  <th className="p-3 font-bold text-center">アクション</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-10 text-gray-400">読み込み中...</td></tr>
                ) : filteredActivities.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-10 text-gray-400">データがありません</td></tr>
                ) : (
                  filteredActivities.map(act => {
                    const safeImageUrls = Array.isArray(act.imageUrls) ? act.imageUrls : [];
                    const imgCount = safeImageUrls.length + (act.imageUrl && !safeImageUrls.includes(act.imageUrl) ? 1 : 0);
                    
                    const isBase = baseTicketId === act.id;
                    const isSource = sourceTicketId === act.id;
                    const isAlreadyMerged = !!act.mergedInto;

                    return (
                      <tr 
                        key={act.id} 
                        className={`border-b border-gray-100 transition-colors ${
                          isAlreadyMerged ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'
                        } border-l-4 ${
                          isBase ? 'bg-blue-50/80 border-l-blue-500' : 
                          isSource ? 'bg-indigo-50/80 border-l-indigo-500' : 'border-l-transparent'
                        }`}
                      >
                        <td className="p-3 pl-4 text-sm text-gray-700 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span>{act.date}</span>
                            {isBase && <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">1 ベース</span>}
                            {isSource && <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">2 コピー元</span>}
                            {isAlreadyMerged && <span className="bg-gray-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">合体済み</span>}
                          </div>
                        </td>
                        <td className="p-3 text-sm font-bold text-gray-900">
                          {act.activityType || '-'}
                          <div className="text-[10px] text-gray-500 font-normal mt-0.5">{act.location}</div>
                        </td>
                        <td className="p-3 text-center">
                          {imgCount > 0 ? (
                            <span className="inline-flex items-center bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-700 border border-gray-200">
                              <ImageIcon size={12} className="mr-1" /> {imgCount}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => setBaseTicketId(isBase ? null : act.id)}
                              disabled={isSource || isAlreadyMerged} 
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center ${
                                isBase 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                  : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
                              } ${(isSource || isAlreadyMerged) ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              {isBase ? (
                                <><span className="bg-white text-blue-600 rounded-full w-4 h-4 inline-flex items-center justify-center mr-1.5 text-[10px]">1</span> 選択中</>
                              ) : 'ベースにセット'}
                            </button>
                            
                            <button
                              onClick={() => setSourceTicketId(isSource ? null : act.id)}
                              disabled={isBase || isAlreadyMerged} 
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center ${
                                isSource 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                              } ${(isBase || isAlreadyMerged) ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              {isSource ? (
                                <><span className="bg-white text-indigo-600 rounded-full w-4 h-4 inline-flex items-center justify-center mr-1.5 text-[10px]">2</span> 選択中</>
                              ) : 'コピー元にセット'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 🚀 ごみ箱（削除済みチケット一覧） */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden opacity-95">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-100 text-gray-700">
            <h2 className="font-extrabold flex items-center">
              <Trash2 className="mr-2" size={18} />
              ごみ箱（削除済みチケット一覧）
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                  <th className="p-3 font-bold pl-5">日付</th>
                  <th className="p-3 font-bold w-1/3">活動内容</th>
                  <th className="p-3 font-bold text-center">画像</th>
                  <th className="p-3 font-bold text-center">アクション</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-6 text-gray-400">読み込み中...</td></tr>
                ) : deletedActivities.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-6 text-gray-400">削除されたチケットはありません</td></tr>
                ) : (
                  deletedActivities.map(act => {
                    const safeImageUrls = Array.isArray(act.imageUrls) ? act.imageUrls : [];
                    const imgCount = safeImageUrls.length + (act.imageUrl && !safeImageUrls.includes(act.imageUrl) ? 1 : 0);

                    return (
                      <tr key={act.id} className="border-b border-gray-100 transition-colors bg-gray-50/50 hover:bg-gray-100 text-gray-500">
                        <td className="p-3 pl-4 text-sm whitespace-nowrap">{act.date}</td>
                        <td className="p-3 text-sm font-bold">
                          <span className="line-through">{act.activityType || '-'}</span>
                          <div className="text-[10px] text-gray-400 font-normal mt-0.5">{act.location}</div>
                        </td>
                        <td className="p-3 text-center">
                          {imgCount > 0 ? (
                            <span className="inline-flex items-center bg-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-500 border border-gray-300">
                              <ImageIcon size={12} className="mr-1" /> {imgCount}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleRestore(act.id, act.activityType)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            >
                              <RotateCcw size={14} className="mr-1"/> 復元
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(act.id, act.activityType)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                            >
                              <X size={14} className="mr-1"/> 完全削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
};

export default TicketManagement;