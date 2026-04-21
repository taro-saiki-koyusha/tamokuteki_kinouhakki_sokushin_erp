import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout } from 'lucide-react';

export const ActivityForm = () => {
  const navigate = useNavigate();
  // フォームの入力データを管理する状態（State）
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // 今日の日付を初期値に
    startTime: '08:00',
    endTime: '10:00',
    location: '',
    activityType: '',
    participants: 1,
    memo: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: ここでFirebaseなどのデータベースに保存する処理を書きます
    console.log('保存するデータ:', formData);
    alert('実績を保存しました！');
    navigate('/dashboard'); // 保存後にダッシュボードへ戻る
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-10">
        <button 
          onClick={() => navigate('/dashboard')}
          className="mr-4 text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          <Sprout className="w-5 h-5 mr-2 text-green-600" />
          活動実績の入力
        </h1>
      </header>

      {/* 入力フォーム */}
      <main className="p-4 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 日時入力 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                <Calendar className="w-4 h-4 mr-1 text-green-600" /> 日付
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                  <Clock className="w-4 h-4 mr-1 text-green-600" /> 開始
                </label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                  終了
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* 場所・内容入力 */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                <MapPin className="w-4 h-4 mr-1 text-green-600" /> 活動場所
              </label>
              <select
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                required
              >
                <option value="">選択してください</option>
                <option value="鎌田排水機場用地">鎌田排水機場用地</option>
                <option value="内郷地区水路">内郷地区水路</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                <Sprout className="w-4 h-4 mr-1 text-green-600" /> 活動内容
              </label>
              <select
                name="activityType"
                value={formData.activityType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                required
              >
                <option value="">選択してください</option>
                <option value="共同活動（草刈り）">共同活動（草刈り）</option>
                <option value="泥上げ・清掃">泥上げ・清掃</option>
                <option value="農道補修">農道補修</option>
                <option value="その他">その他</option>
              </select>
            </div>
          </div>

          {/* 参加人数・写真・メモ */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                <Users className="w-4 h-4 mr-1 text-green-600" /> 参加人数 (人)
              </label>
              <input
                type="number"
                name="participants"
                min="1"
                value={formData.participants}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              />
            </div>
            
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <Camera className="w-4 h-4 mr-1 text-green-600" /> 現場写真
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-green-500 cursor-pointer transition-colors">
                <Camera size={32} className="mb-2 text-gray-400" />
                <span className="text-sm">タップして写真を撮影・選択</span>
                <input type="file" accept="image/*" className="hidden" />
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">
                備考・特記事項
              </label>
              <textarea
                name="memo"
                value={formData.memo}
                onChange={handleChange}
                rows="3"
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="機材の故障などがあれば記入..."
              ></textarea>
            </div>
          </div>

          {/* 保存ボタン */}
          <button
            type="submit"
            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 active:scale-95 transition-transform"
          >
            <Save className="mr-2 h-6 w-6" />
            実績を登録する
          </button>
        </form>
      </main>
    </div>
  );
};
