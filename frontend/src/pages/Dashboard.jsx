import React from 'react';
import { Calendar, Clock, CheckCircle, Plus, Settings, LogOut, Sprout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const navigate = useNavigate();

  // サンプルの実績データ（実際にはここをデータベースから取得するようにしていきます）
  const tasks = [
    { 
      id: 1, 
      date: '2026/05/11', 
      time: '08:00 - 10:00', 
      location: '鎌田排水機場用地', 
      activity: '共同活動（草刈り）', 
      status: '予定' 
    },
    { 
      id: 2, 
      date: '2026/05/15', 
      time: '09:00 - 11:00', 
      location: '内郷地区水路', 
      activity: '泥上げ・清掃', 
      status: '予定' 
    },
  ];

  const handleLogout = () => {
    // ログイン画面に戻る処理
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* ヘッダーエリア */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
          {/* ロゴ画像（public/logo.png を参照） */}
          <Sprout className="w-8 h-8 mr-2 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800">
            農地維持管理システム by 鎌田緑保護会
          </h1>
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          title="ログアウト"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4 max-w-md mx-auto">
        {/* 新規実績入力ボタン */}
        <button className="w-full mb-6 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 text-center text-gray-600 hover:bg-gray-50 hover:border-green-500 hover:text-green-600 transition-all flex flex-col items-center justify-center group">
          <div className="bg-gray-100 p-3 rounded-full mb-2 group-hover:bg-green-100 transition-colors">
            <Plus className="h-6 w-6 text-gray-400 group-hover:text-green-600" />
          </div>
          <span className="font-bold">予定外の実績を直接記録する</span>
        </button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-700 flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-green-600" />
            今後の活動予定
          </h2>
          <span className="text-xs text-gray-500">{tasks.length} 件の予定</span>
        </div>

        {/* 予定カード一覧 */}
        <div className="space-y-4">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-green-500 p-4 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-900">{task.activity}</h3>
                <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                  {task.status}
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="mr-2 h-4 w-4" />
                  {task.date} {task.time}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  場所：{task.location}
                </div>
              </div>
              
              <button className="mt-4 w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition-colors text-sm">
                この活動の実績を入力
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* 下部ナビゲーション（モバイル用） */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center">
        <button className="flex flex-col items-center text-green-600">
          <Calendar size={24} />
          <span className="text-[10px] mt-1 font-bold">予定</span>
        </button>
        <button className="flex flex-col items-center text-gray-400">
          <CheckCircle size={24} />
          <span className="text-[10px] mt-1">完了</span>
        </button>
        <button className="flex flex-col items-center text-gray-400">
          <Settings size={24} />
          <span className="text-[10px] mt-1">設定</span>
        </button>
      </nav>
    </div>
  );
};
