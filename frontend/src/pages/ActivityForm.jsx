import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout, X } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; 

export const ActivityForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData;

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
  
  // 👇 複数画像のための状態管理
  // 1. すでに保存されている画像のURLリスト（過去データのimageUrlにも対応）
  const [existingUrls, setExistingUrls] = useState(
    editData?.imageUrls || (editData?.imageUrl ? [editData.imageUrl] : [])
  );
  // 2. 新しく追加で選択された画像ファイル本体のリスト
  const [newImageFiles, setNewImageFiles] = useState([]);
  // 3. 新しく追加された画像のプレビュー用URLリスト
  const [newPreviewUrls, setNewPreviewUrls] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // 📸 写真が選択された時の処理（複数選択対応）
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files); // 選択された複数のファイルを配列にする
    if (files.length > 0) {
      setNewImageFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setNewPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  // 既存の画像を削除する
  const removeExistingUrl = (index) => {
    setExistingUrls(prev => prev.filter((_, i) => i !== index));
  };

  // 新しく選んだ画像を削除する
  const removeNewImage = (index) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    setNewPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let finalImageUrls = [...existingUrls]; // 最終的に保存する画像のリスト

      // 新しい画像があれば、すべてStorageにアップロードする
      if (newImageFiles.length > 0) {
        // Promise.all を使って複数枚の画像を同時にアップロード
        const uploadPromises = newImageFiles.map(async (file) => {
          const fileName = `photos/${Date.now()}_${file.name}`;
          const imageRef = ref(storage, fileName);
          await uploadBytes(imageRef, file);
          return await getDownloadURL(imageRef);
        });
        
        // すべてのアップロードが終わるのを待ってURLを取得
        const newlyUploadedUrls = await Promise.all(uploadPromises);
        finalImageUrls = [...finalImageUrls, ...newlyUploadedUrls]; // 既存のURLと合体
      }

      const submitData = {
        ...formData,
        participants: Number(formData.participants),
        imageUrls: finalImageUrls, // 👈 複数のURLを配列として保存
        updatedAt: serverTimestamp()
      };

      if (editData) {
        await updateDoc(doc(db, 'activities', editData.id), submitData);
        alert('活動実績を修正しました！📝');
      } else {
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
            
            {/* 📸 写真アップロード機能（グリッド表示対応） */}
            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <Camera className="w-4 h-4 mr-1 text-green-600" /> 現場写真（複数可）
              </label>
              
              <div className="grid grid-cols-3 gap-2">
                {/* 既存の画像プレビュー */}
                {existingUrls.map((url, i) => (
                  <div key={`exist-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt="既存の写真" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeExistingUrl(i)} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black/80">
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* 新規の画像プレビュー */}
                {newPreviewUrls.map((url, i) => (
                  <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-green-300 shadow-[0_0_0_2px_rgba(74,222,128,0.2)]">
                    <img src={url} alt="新規追加の写真" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeNewImage(i)} className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black/80">
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* 追加ボタン */}
                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-green-50 hover:border-green-500 hover:text-green-600 cursor-pointer transition-colors group">
                  <Camera size={24} className="mb-1" />
                  <span className="text-[10px] font-bold">写真を追加</span>
                  {/* multiple属性で複数選択を可能に */}
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-bold text-gray-700 mb-1">備考・特記事項</label>
              <textarea name="memo" value={formData.memo} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="機材の故障などがあれば記入..."></textarea>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className={`w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white transition-all ${isSubmitting ? 'bg-green-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}>
            <Save className="mr-2 h-6 w-6" />
            {isSubmitting ? 'アップロード中...' : (editData ? '内容を更新する' : '実績を登録する')}
          </button>
        </form>
      </main>
    </div>
  );
};