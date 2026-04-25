import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, CheckCircle, Plus, Settings, LogOut, Sprout, Users, MessageSquare, Edit, Trash2, X, MapPin, BarChart2, Activity, Printer, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('home');

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

  const handlePrint = () => {
    window.print();
  };

  // 📊 【CSV書き出し機能】Excelでそのまま開ける形式で生成します
  const handleExportCSV = () => {
    if (activities.length === 0) {
      alert('書き出すデータがありません。');
      return;
    }

    // CSVのヘッダー（1行目）
    const headers = ['日付', '開始時間', '終了時間', '活動場所', '活動内容', '参加人数', '備考'];
    
    // データをCSVの行形式に変換
    const csvRows = [
      headers.join(','), // ヘッダー行を追加
      ...activities.map(act => [
        act.date,
        act.startTime,
        act.endTime,
        `"${act.location}"`, // カンマが含まれる可能性があるのでダブルクォーテーションで囲む
        `"${act.activityType}"`,
        act.participants,
        `"${(act.memo || '').replace(/\n/g, ' ')}"` // 改行をスペースに置換
      ].join(','))
    ].join('\n');

    // Excelで文字化けしないようにBOM（Byte Order Mark）を付与
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvRows], { type: 'text/csv;charset=utf-8;' });
    
    // ダウンロード用のリンクを生成してクリックさせる
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `農地維持管理実績_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summaryData = useMemo(() => {
    let totalParticipants = 0;
    let totalHours = 0;
    const typeStats = {};

    activities.forEach(act => {
      totalParticipants += Number(act.participants || 0);
      if (act.startTime && act.endTime) {
        const [startH, startM] = act.startTime.split(':').map(Number);
        const [endH, endM] = act.endTime.split(':').map(Number);
        let hours = (endH + endM / 60) - (startH + startM / 60);
        if (hours < 0) hours += 24;
        totalHours += hours;

        const type = act.activityType || 'その他';
        if (!typeStats[type]) typeStats[type] = { count: 0, hours: 0, participants: 0 };
        typeStats[type].count += 1;
        typeStats[type].hours += hours;
        typeStats[type].participants += Number(act.participants || 0);
      }
    });

    const maxHours = Math.max(...Object.values(typeStats).map(t => t.hours), 1);
    return { totalActivities: activities.length, totalParticipants, totalHours: totalHours.toFixed(1), typeStats, maxHours };
  }, [activities]);

  return (
    <div className="min-h-screen bg-gray-100 pb-20 print:bg-white print:pb-0">
      
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10 print:hidden">
        <div className="flex items-center">
          <Sprout className="w-8 h-8 mr-2 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800">農地維持管理システム</h1>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="p-4 max-w-md mx-auto print:hidden">
        <div className="mb-6">
          <p className="text-gray-600 text-sm">こんにちは、</p>
          <h2 className="text-xl font-bold text-gray-900">{userName} さん</h2>
        </div>

        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button onClick={() => navigate('/activity-form')} className="w-full mb-8 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-green-50 hover:border-green-500 transition-colors shadow-sm">
              <div className="bg-gray-100 p-3 rounded-full mb-2"><Plus className="h-6 w-6 text-gray-400" /></div>
              <span className="font-bold text-gray-600">活動実績を報告する</span>
            </button>

            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-700 flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-600" />最近の活動実績</h2>
              <span className="text-xs text-gray-500">{activities.length} 件の記録</span>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-10 text-gray-400">読み込み中...</div>
              ) : activities.map((activity) => {
                const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
                return (
                  <div key={activity.id} onClick={() => setSelectedActivity(activity)} className="bg-white rounded-2xl shadow-sm border-l-4 border-green-500 p-4 cursor-pointer active:scale-95 transition-transform">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-900">{activity.activityType}</h3>
                    </div>
                    <div className="space-y-1.5 mb-3 text-sm text-gray-600">
                      <div className="flex items-center"><Calendar className="mr-2 h-4 w-4" />{activity.date}</div>
                      <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" />{activity.location}</div>
                    </div>
                    {images.length > 0 && (
                      <div className="mt-3 relative rounded-lg overflow-hidden h-48 bg-gray-50 border border-gray-100">
                        <img src={images[0]} alt="活動写真" className="w-full h-full object-cover" />
                        {images.length > 1 && <div className="absolute bottom-2 right-2 bg-black/75 text-white px-2 py-1 rounded-md text-xs font-bold">+{images.length - 1} 枚</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
            <h2 className="font-bold text-gray-800 text-xl flex items-center mb-6"><BarChart2 className="w-6 h-6 mr-2 text-green-600" />今年度の活動サマリー</h2>
            
            {/* 📥 CSV書き出しボタン */}
            <button 
              onClick={handleExportCSV}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center shadow-md hover:bg-blue-700 active:scale-95 transition-all mb-6"
            >
              <Download size={20} className="mr-2" />
              実績データをCSV出力 (Excel用)
            </button>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Activity className="w-8 h-8 text-blue-500 mb-2 opacity-80" />
                <span className="text-gray-500 text-xs font-bold mb-1">総活動回数</span>
                <div className="text-3xl font-black text-gray-800">{summaryData.totalActivities}<span className="text-sm font-normal ml-1">回</span></div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                <Users className="w-8 h-8 text-orange-500 mb-2 opacity-80" />
                <span className="text-gray-500 text-xs font-bold mb-1">延べ参加人数</span>
                <div className="text-3xl font-black text-gray-800">{summaryData.totalParticipants}<span className="text-sm font-normal ml-1">人</span></div>
              </div>
              <div className="col-span-2 bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl shadow-sm text-white flex justify-between items-center">
                <div><span className="text-green-100 text-sm font-bold block mb-1">総活動時間</span><div className="text-4xl font-black">{summaryData.totalHours}<span className="text-lg font-normal ml-1">時間</span></div></div>
                <Clock className="w-12 h-12 text-white opacity-20" />
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-5 flex items-center"><Sprout className="w-4 h-4 mr-2 text-green-600" />活動内容別の内訳</h3>
              <div className="space-y-5">
                {Object.entries(summaryData.typeStats).sort((a, b) => b[1].hours - a[1].hours).map(([type, stats]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm font-bold text-gray-700 mb-1"><span>{type}</span><span>{stats.hours.toFixed(1)} 時間</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${(stats.hours / summaryData.maxHours) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 詳細画面モーダル */}
      {selectedActivity && (() => {
        const modalImages = selectedActivity.imageUrls || (selectedActivity.imageUrl ? [selectedActivity.imageUrl] : []);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden" onClick={() => setSelectedActivity(null)}>
            <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900 flex items-center"><Sprout className="w-5 h-5 mr-2 text-green-600" />活動の詳細</h3>
                <button onClick={() => setSelectedActivity(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto p-4 space-y-4">
                
                <button 
                  onClick={handlePrint}
                  className="w-full bg-blue-50 text-blue-700 border border-blue-200 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-blue-100 transition-colors"
                >
                  <Printer size={20} className="mr-2" />
                  写真台帳を出力する (PDF)
                </button>

                {modalImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {modalImages.map((img, idx) => (
                      <div key={idx} className={`rounded-lg overflow-hidden bg-gray-100 border border-gray-200 ${modalImages.length === 1 ? 'col-span-2' : ''}`}>
                        <img src={img} alt={`活動画像 ${idx + 1}`} className="w-full h-auto object-contain max-h-48 mx-auto" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-green-50 p-4 rounded-xl space-y-3 border border-green-100">
                  <div className="flex items-center text-sm font-bold text-green-800"><Calendar className="mr-2 h-4 w-4" /> {selectedActivity.date}</div>
                  <div className="flex items-center text-sm text-gray-700"><Clock className="mr-2 h-4 w-4" /> {selectedActivity.startTime} - {selectedActivity.endTime}</div>
                  <div className="flex items-center text-sm text-gray-700"><MapPin className="mr-2 h-4 w-4" /> {selectedActivity.location}</div>
                  <div className="flex items-center text-sm text-gray-700"><Sprout className="mr-2 h-4 w-4" /> {selectedActivity.activityType}</div>
                  <div className="flex items-center text-sm text-gray-700"><Users className="mr-2 h-4 w-4" /> 参加：{selectedActivity.participants} 名</div>
                </div>
                {selectedActivity.memo && (
                  <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap leading-relaxed">{selectedActivity.memo}</div>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-20 pb-safe print:hidden">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center transition-colors ${activeTab === 'home' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <Calendar size={24} />
          <span className="text-[10px] mt-1 font-bold">実績</span>
        </button>
        <button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center transition-colors ${activeTab === 'summary' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
          <BarChart2 size={24} />
          <span className="text-[10px] mt-1 font-bold">集計</span>
        </button>
        <button className="flex flex-col items-center text-gray-400 hover:text-gray-600 cursor-not-allowed">
          <Settings size={24} />
          <span className="text-[10px] mt-1">設定</span>
        </button>
      </nav>

      {/* 印刷用レイアウト（変更なし） */}
      {selectedActivity && (() => {
        const printImages = selectedActivity.imageUrls || (selectedActivity.imageUrl ? [selectedActivity.imageUrl] : []);
        return (
          <div className="hidden print:block w-full text-black bg-white">
            <div className="text-center mb-8 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-bold tracking-widest">活動記録簿（写真台帳）</h1>
            </div>
            <table className="w-full mb-8 border-collapse border border-black text-sm">
              <tbody>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 w-32 text-left">実施年月日</th>
                  <td className="border border-black p-2">{selectedActivity.date}</td>
                  <th className="border border-black bg-gray-100 p-2 w-32 text-left">作業時間</th>
                  <td className="border border-black p-2">{selectedActivity.startTime} 〜 {selectedActivity.endTime}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 text-left">実施場所</th>
                  <td className="border border-black p-2">{selectedActivity.location}</td>
                  <th className="border border-black bg-gray-100 p-2 text-left">参加人数</th>
                  <td className="border border-black p-2">{selectedActivity.participants} 名</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 text-left">活動内容</th>
                  <td className="border border-black p-2" colSpan="3">{selectedActivity.activityType}</td>
                </tr>
                {selectedActivity.memo && (
                  <tr>
                    <th className="border border-black bg-gray-100 p-2 text-left">備考</th>
                    <td className="border border-black p-2" colSpan="3">{selectedActivity.memo}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div>
              <h2 className="font-bold border-l-4 border-black pl-2 mb-4 text-lg">活動写真</h2>
              <div className="grid grid-cols-2 gap-4">
                {printImages.map((img, idx) => (
                  <div key={idx} className="border border-gray-400 p-2 text-center h-[350px] flex flex-col justify-center bg-gray-50">
                    <img src={img} alt={`活動写真 ${idx + 1}`} className="max-w-full max-h-[300px] object-contain mx-auto" />
                    <p className="mt-2 text-xs text-gray-500">写真 {idx + 1}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-12 text-right text-sm">
              <p>出力日：{new Date().toLocaleDateString('ja-JP')}</p>
              <p className="mt-2">組織名：農事組合法人カマタ</p>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
