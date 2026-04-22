import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, Plus, Settings, LogOut, Sprout, Users, MessageSquare, Edit, Trash2, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  const userName = auth.currentUser?.displayName || 'ユーザー';

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setActivities(data);
      setLoading(false);
    }, (error) => {
      console.error("データ取得エラー:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('本当にこの実績を削除しますか？\n（この操作は取り消せません）')) {
      try {
        await deleteDoc(doc(db, 'activities', id));
        setSelectedActivity(null);
      } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました。');
      }
    }
  };

  const handleEdit = (activity) => {
    navigate('/activity-form', { state: { editData: activity } });
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <Sprout className="w-8 h-8 mr-2 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800">農地維持管理システム</h1>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="ログアウト">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <div className="mb-6">
          <p className="text-gray-600 text-sm">こんにちは、</p>
          <h2 className="text-xl font-bold text-gray-900">{userName} さん</h2>
        </div>

        <button 
          onClick={() => navigate('/activity-form')}
          className="w-full mb-8 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-600 hover:bg-gray-50 hover:border-green-500 hover:text-green-600 transition-all flex flex-col items-center justify-center shadow-sm"
        >
          <div className="bg-gray-100 p-3 rounded-full mb-2">
            <Plus className="h-6 w-6 text-gray-400" />
          </div>
          <span className="font-bold">活動実績を報告する</span>
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-700 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
            最近の活動実績
          </h2>
          <span className="text-xs text-gray-500">{activities.length} 件の記録</span>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-gray-400">読み込み中...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
              まだ実績が登録されていません
            </div>
          ) : (
            activities.map((activity) => {
              // 👇 古いデータ(imageUrl)と新しいデータ(imageUrls)を両方とも配列として扱う
              const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);

              return (
                <div 
                  key={activity.id} 
                  onClick={() => setSelectedActivity(activity)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-green-500 p-4 active:scale-95 transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{activity.activityType}</h3>
                    <div className="flex space-x-2">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(activity); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(activity.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center text-sm text-gray-600"><Calendar className="mr-2 h-4 w-4 text-gray-400" />{activity.date}</div>
                    <div className="flex items-center text-sm text-gray-600"><Clock className="mr-2 h-4 w-4 text-gray-400" />{activity.startTime} - {activity.endTime}</div>
                    <div className="flex items-center text-sm text-gray-600"><CheckCircle className="mr-2 h-4 w-4 text-gray-400" />場所：{activity.location}</div>
                  </div>

                  {/* 📸 一覧画面での画像表示（1枚目だけ表示し、複数ある場合はバッジを付ける） */}
                  {images.length > 0 && (
                    <div className="mt-3 relative rounded-lg overflow-hidden border border-gray-100 h-48 bg-gray-50">
                      <img src={images[0]} alt="活動現場の写真" className="w-full h-full object-cover" />
                      {images.length > 1 && (
                        <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm">
                          +{images.length - 1} 枚
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* --- 詳細画面（モーダルポップアップ） --- */}
      {selectedActivity && (() => {
        // 詳細画面用の画像配列
        const modalImages = selectedActivity.imageUrls || (selectedActivity.imageUrl ? [selectedActivity.imageUrl] : []);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedActivity(null)}>
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900 flex items-center"><Sprout className="w-5 h-5 mr-2 text-green-600" />活動の詳細</h3>
                <button onClick={() => setSelectedActivity(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
              </div>

              <div className="overflow-y-auto p-4 space-y-4">
                
                {/* 📸 複数画像をグリッド表示 */}
                {modalImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {modalImages.map((img, idx) => (
                      <div key={idx} className={`rounded-lg overflow-hidden bg-gray-100 border border-gray-200 ${modalImages.length === 1 ? 'col-span-2' : ''}`}>
                        <img src={img} alt={`活動画像 ${idx + 1}`} className="w-full h-auto object-contain max-h-48 mx-auto" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-green-50 p-4 rounded-xl space-y-3 border border-green-100 mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xl text-green-800">{selectedActivity.activityType}</span>
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold shadow-sm">完了</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700"><Calendar className="mr-2 h-4 w-4 text-green-600" /> 日付：{selectedActivity.date}</div>
                  <div className="flex items-center text-sm text-gray-700"><Clock className="mr-2 h-4 w-4 text-green-600" /> 時間：{selectedActivity.startTime} - {selectedActivity.endTime}</div>
                  <div className="flex items-center text-sm text-gray-700"><MapPin className="mr-2 h-4 w-4 text-green-600" /> 場所：{selectedActivity.location}</div>
                  <div className="flex items-center text-sm text-gray-700"><Users className="mr-2 h-4 w-4 text-green-600" /> 参加：{selectedActivity.participants} 名</div>
                </div>

                {selectedActivity.memo && (
                  <div>
                    <h4 className="font-bold text-gray-700 text-sm mb-2 flex items-center"><MessageSquare className="w-4 h-4 mr-1 text-gray-500" /> 備考・特記事項</h4>
                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap leading-relaxed">{selectedActivity.memo}</div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 flex space-x-3 bg-gray-50">
                <button onClick={() => { setSelectedActivity(null); handleEdit(selectedActivity); }} className="flex-1 flex items-center justify-center py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                  <Edit size={16} className="mr-2" /> 編集する
                </button>
                <button onClick={() => handleDelete(selectedActivity.id)} className="flex-1 flex items-center justify-center py-3 bg-white border border-red-200 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={16} className="mr-2" /> 削除する
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-20">
        <button className="flex flex-col items-center text-green-600"><Calendar size={24} /><span className="text-[10px] mt-1 font-bold">実績</span></button>
        <button className="flex flex-col items-center text-gray-400"><CheckCircle size={24} /><span className="text-[10px] mt-1">集計</span></button>
        <button className="flex flex-col items-center text-gray-400"><Settings size={24} /><span className="text-[10px] mt-1">設定</span></button>
      </nav>
    </div>
  );
};
