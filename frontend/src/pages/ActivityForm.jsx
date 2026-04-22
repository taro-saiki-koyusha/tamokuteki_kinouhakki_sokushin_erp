import React, { useState } from 'react';
// 👇 useLocation を追加
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout, X } from 'lucide-react';
// 👇 doc, updateDoc を追加
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; 

export const ActivityForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // ダッシュボードから渡された「編集用のデータ」を受け取る（新規の場合は空っぽになります）
  const editData = location.state?.editData;

  // 初期値の設定：編集データがあればそれを、無ければ空の初期値をセット
  const [formData, setFormData] = useState(
    editData ? {
      date: editData.date,
      startTime: editData.startTime,
      endTime: editData.endTime,
      location: editData.location,
      activityType: editData.activityType,
      participants: editData.participants,
      memo: editData.memo || ''
    } : {
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '10:00',
      location: '',
      activityType: '',
      participants: 1,
      memo: ''
    }
  );
  
  const [imageFile, setImageFile] = useState(null); 
  // 編集データに画像URLがあれば、それを初期プレビューとして表示
  const [previewUrl, setPreviewUrl] = useState(editData?.imageUrl || ''); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setPreviewUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 元々画像があって、新しく画像を選び直さなかった場合は、元のURLを維持する
      let imageUrl = editData?.imageUrl || ''; 

      // 新しい画像ファイルが選択された場合はアップロード
      if (imageFile) {
        const fileName = `photos/${Date.now()}_${imageFile.name}`;
        const imageRef = ref(storage, fileName);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      // 送信するデータのかたまり
      const submitData = {
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        activityType: formData.activityType,
        participants: Number(formData.participants),
        memo: formData.memo,
        imageUrl: imageUrl, 
        updatedAt: serverTimestamp() // 常に更新時間を記録
      };

      if (editData) {
        // ✏️ 編集モードの場合：特定のデータを「上書き（updateDoc）」する
        await updateDoc(doc(db, 'activities', editData.id), submitData);
        alert('活動実績を修正しました！📝');
      } else {
        // 🌱 新規作成モードの場合：新しいデータとして「追加（addDoc）」する
        submitData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'activities'), submitData);
        alert('活動実績を保存しました！📸');
      }

      navigate('/dashboard');
      
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました。通信環境を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-10">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700" disabled={isSubmitting}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          <Sprout className="w-5 h-5 mr-2 text-green-600" />
          {editData ? '活動実績の修正' : '活動実績の入力'}
        </h1>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1"><Calendar className="w-4 h-4 mr-1 text-green-600" /> 日付</label>
              <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" required />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="flex items-center text-sm font-bold text-gray-700 mb-1"><Clock className="w-4 h-4 mr-1 text-green-600" /> 開始</label>
                <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" required />
              </div>
              <div className="flex-1">
                <label className="flex items-center text-sm font-bold text-gray-700 mb-1">終了</label>
                <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" required />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1"><MapPin className="w-4 h-4 mr-1 text-green-600" /> 活動場所</label>
              <select name="location" value={formData.location} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white" required>
                <option value="">選択してください</option>
                <option value="鎌田排水機場用地">鎌田排水機場用地</option>
                <option value="内郷地区水路">内郷地区水路</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1"><Sprout className="w-4 h-4 mr-1 text-green-600" /> 活動内容</label>
              <select name="activityType" value={formData.activityType} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white" required>
                <option value="">選択してください</option>
                <option value="共同活動（草刈り）">共同活動（草刈り）</option>
                <option value="泥上げ・清掃">泥上げ・清掃</option>
                <option value="農道補修">農道補修</option>
                <option value="その他">その他</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1"><Users className="w-4 h-4 mr-1 text-green-600" /> 参加人数 (人)</label>
              <input type="number" name="participants" min="1" value={formData.participants} onChange={handleChange} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" required />
            </div>
            
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <Camera className="w-4 h-4 mr-1 text-green-600" /> 現場写真
              </label>
              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200">
                  <img src={previewUrl} alt="プレビュー" className="w-full h-48 object-cover" />
                  <button type="button" onClick={handleRemoveImage} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-colors group">
                  <Camera size={32} className="mb-2 text-gray-400 group-hover:text-green-500" />
                  <span className="text-sm font-bold">タップして写真を撮影・選択</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>

            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">備考・特記事項</label>
              <textarea name="memo" value={formData.memo} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="機材の故障などがあれば記入..."></textarea>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className={`w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white transition-all ${isSubmitting ? 'bg-green-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
            <Save className="mr-2 h-6 w-6" />
            {isSubmitting ? '処理中...' : (editData ? '内容を更新する' : '実績を登録する')}
          </button>
        </form>
      </main>
    </div>
  );
};
