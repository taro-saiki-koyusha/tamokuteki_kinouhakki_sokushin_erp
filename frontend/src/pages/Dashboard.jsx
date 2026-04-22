import React, { useState, useEffect } from 'react';
// 👇 Edit(編集) と Trash2(ゴミ箱) のアイコンを追加
import { Calendar, Clock, CheckCircle, Plus, Settings, LogOut, Sprout, Users, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// 👇 doc, deleteDoc を追加
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // 🗑️ 削除ボタンが押された時の処理
  const handleDelete = async (id) => {
    // 誤操作防止の確認ダイアログ
    if (window.confirm('本当にこの実績を削除しますか？\n（この操作は取り消せません）')) {
      try {
        await deleteDoc(doc(db, 'activities', id));
        // ※onSnapshotが監視しているので、削除すると自動で画面から消えます！
      } catch (error) {
        console.error('削除エラー:', error);
        alert('削除に失敗しました。');
      }
    }
  };

  // ✏️ 編集ボタンが押された時の処理
  const handleEdit = (activity) => {
    // フォーム画面へ移動しつつ、現在のデータ（activity）を裏側で渡す
    navigate('/activity-form', { state: { editData: activity } });
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          <Sprout className="w-8 h-8 mr-2 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800">
            農地維持管理システム
          </h1>
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
            activities.map((activity) => (
              <div key={activity.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-green-500 p-4">
                
                {/* ヘッダー部分（タイトルと編集・削除ボタン） */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-900">{activity.activityType}</h3>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleEdit(activity)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="編集"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(activity.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center text-sm text-gray-600"><Calendar className="mr-2 h-4 w-4 text-gray-400" />{activity.date}</div>
                  <div className="flex items-center text-sm text-gray-600"><Clock className="mr-2 h-4 w-4 text-gray-400" />{activity.startTime} - {activity.endTime}</div>
                  <div className="flex items-center text-sm text-gray-600"><CheckCircle className="mr-2 h-4 w-4 text-gray-400" />場所：{activity.location}</div>
                  <div className="flex items-center text-sm text-gray-600"><Users className="mr-2 h-4 w-4 text-gray-400" />参加：{activity.participants} 名</div>
                  {activity.memo && (
                    <div className="flex items-start text-sm text-gray-500 bg-gray-50 p-2 rounded-lg mt-2">
                      <MessageSquare className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />{activity.memo}
                    </div>
                  )}
                </div>

                {activity.imageUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-gray-100">
                    <img src={activity.imageUrl} alt="活動現場の写真" className="w-full h-48 object-cover" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* ナビゲーション */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-20">
        <button className="flex flex-col items-center text-green-600"><Calendar size={24} /><span className="text-[10px] mt-1 font-bold">実績</span></button>
        <button className="flex flex-col items-center text-gray-400"><CheckCircle size={24} /><span className="text-[10px] mt-1">集計</span></button>
        <button className="flex flex-col items-center text-gray-400"><Settings size={24} /><span className="text-[10px] mt-1">設定</span></button>
      </nav>
    </div>
  );
};