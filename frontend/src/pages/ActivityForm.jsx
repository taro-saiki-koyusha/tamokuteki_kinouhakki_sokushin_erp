import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout, X, ChevronDown, Check, Search, UserPlus, Tractor, Trash2, Edit } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase'; 

// =========================================================================
// 機械マスターと活動項目マスター
// =========================================================================
const MACHINES = [
  { id: "1", name: "刈払機（肩掛け）", defaultPrice: 900 },
  { id: "2", name: "刈払機（自走式）", defaultPrice: 1500 },
  { id: "3", name: "軽トラック", defaultPrice: 1000 },
  { id: "4", name: "バックホー", defaultPrice: 3000 },
  { id: "5", name: "チェンソー", defaultPrice: 1000 },
];

const ACTIVITY_ITEMS = [
  { id: "1", name: "点検" }, { id: "2", name: "年度活動計画の策定" }, { id: "3", name: "事務・組織運営等に関する研修、機械の安全使用に関する研修" },
  { id: "4", name: "遊休農地発生防止のための保全管理" }, { id: "5", name: "畦畔・法面・防風林の草刈り" }, { id: "6", name: "鳥獣害防護柵等の保守管理" },
  { id: "7", name: "水路の草刈り" }, { id: "8", name: "水路の泥上げ" }, { id: "9", name: "水路附帯施設の保守管理" },
  { id: "10", name: "農道の草刈り" }, { id: "11", name: "農道側溝の泥上げ" }, { id: "12", name: "路面の維持" },
  { id: "13", name: "ため池の草刈り" }, { id: "14", name: "ため池の泥上げ" }, { id: "15", name: "ため池附帯施設の保守管理" },
  { id: "16", name: "異常気象時の対応" }, { id: "17", name: "農業者の検討会の開催" }, { id: "18", name: "農業者に対する意向調査、現地調査" },
  { id: "19", name: "不在村地主との連絡体制の整備等" }, { id: "20", name: "集落外住民や地域住民との意見交換等" }, { id: "21", name: "地域住民等に対する意向調査等" },
  { id: "22", name: "有識者等による研修会、検討会の開催" }, { id: "23", name: "その他" }, { id: "24", name: "農用地の機能診断" },
  { id: "25", name: "水路の機能診断" }, { id: "26", name: "農道の機能診断" }, { id: "27", name: "ため池の機能診断" },
  { id: "28", name: "年度活動計画の策定" }, { id: "29", name: "機能診断・補修技術等に関する研修" }, { id: "30", name: "農用地の軽微な補修等" },
  { id: "31", name: "水路の軽微な補修等" }, { id: "32", name: "農道の軽微な補修等" }, { id: "33", name: "ため池の軽微な補修等" },
  { id: "34", name: "生物多様性保全計画の策定" }, { id: "35", name: "水質保全計画、農地保全計画の策定" }, { id: "36", name: "景観形成計画、生活環境保全計画の策定" },
  { id: "37", name: "水田貯留計画、地下水かん養計画の策定" }, { id: "38", name: "資源循環計画の策定" }, { id: "39", name: "生物の生息状況の把握（生態系保全）" },
  { id: "40", name: "外来種の駆除（生態系保全）" }, { id: "41", name: "その他（生態系保全）" }, { id: "42", name: "水質モニタリングの実施・記録管理（水質保全）" },
  { id: "43", name: "畑からの土砂流出対策（水質保全）" }, { id: "44", name: "その他（水質保全）" }, { id: "45", name: "植栽等の景観形成活動（景観形成・生活環境保全）" },
  { id: "46", name: "施設等の定期的な巡回点検・清掃（景観形成・生活環境保全）" }, { id: "47", name: "その他（景観形成・生活環境保全）" }, { id: "48", name: "水田の貯留機能向上活動（水田貯留機能増進・地下水かん養）" },
  { id: "49", name: "地下水かん養活動、水源かん養林の保全（水田貯留機能増進・地下水かん養）" }, { id: "50", name: "地域資源の活用・資源循環活動（資源循環）" }, { id: "51", name: "啓発・普及活動" },
  { id: "52", name: "遊休農地の有効活用" }, { id: "53", name: "鳥獣被害防止対策及び環境改善活動の強化" }, { id: "54", name: "地域住民による直営施工" },
  { id: "55", name: "防災・減災力の強化" }, { id: "56", name: "農村環境保全活動の幅広い展開" }, { id: "57", name: "やすらぎ・福祉及び教育機能の活用" },
  { id: "58", name: "農村文化の伝承を通じた農村コミュニティの強化" }, { id: "58-2", name: "広域活動組織における活動支援班による活動の実施" }, { id: "58-3", name: "水管理を通じた環境負荷低減活動の強化" },
  { id: "59", name: "都道府県、市町村が特に認める活動" }, { id: "60", name: "広報活動・農村関係人口の拡大" }, { id: "61", name: "水路の補修" },
  { id: "62", name: "水路の更新等" }, { id: "63", name: "農道の補修" }, { id: "64", name: "農道の更新等" },
  { id: "65", name: "ため池の補修" }, { id: "66", name: "ため池（附帯施設）の更新等" }, { id: "100", name: "融雪剤の散布" },
  { id: "101", name: "除排雪" }, { id: "102", name: "農用地の溝切り" }, { id: "103", name: "融雪剤の散布" },
  { id: "104", name: "除排雪" }, { id: "105", name: "積雪被害防止" }, { id: "106", name: "配水操作" },
  { id: "107", name: "融雪剤の散布" }, { id: "108", name: "除排雪" }, { id: "109", name: "農地に係る施設の補修・更新等" },
  { id: "110", name: "排水桝等の補修・更新等" }, { id: "200", name: "事務処理" }, { id: "300", name: "会議" }
];

export const ActivityForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData;
  
  const [isViewMode, setIsViewMode] = useState(location.state?.isViewMode || false);
  const [membersList, setMembersList] = useState([]);

  useEffect(() => {
    fetch('/members.json')
      .then(res => res.json())
      .then(data => setMembersList(data))
      .catch(err => console.error("メンバー情報の読み込みに失敗しました:", err));
  }, []);

  const [formData, setFormData] = useState(
    editData ? {
      date: editData.date,
      startTime: editData.startTime,
      endTime: editData.endTime,
      location: editData.location,
      activityType: editData.activityType,
      activityNumbers: editData.activityNumbers || [], 
      memo: editData.memo || '',
      reportNo: editData.reportNo || ''
    } : {
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '10:00',
      location: '',
      activityType: '',
      activityNumbers: [],
      memo: '',
      reportNo: ''
    }
  );

  const [participantDetails, setParticipantDetails] = useState(editData?.participantDetails || []);

  const calculateBaseHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    let hours = (endH + endM / 60) - (startH + startM / 60);
    return hours > 0 ? hours : 0;
  };

  const addParticipant = () => {
    const baseHours = calculateBaseHours();
    setParticipantDetails([...participantDetails, { memberId: '', workTime: baseHours, machineId: '', machineTime: 0 }]);
  };

  const updateParticipant = (index, field, value) => {
    const newList = [...participantDetails];
    newList[index][field] = value;
    if (field === 'machineId' && value !== '' && newList[index].machineTime === 0) newList[index].machineTime = newList[index].workTime;
    if (field === 'machineId' && value === '') newList[index].machineTime = 0;
    setParticipantDetails(newList);
  };

  const removeParticipant = (index) => {
    setParticipantDetails(participantDetails.filter((_, i) => i !== index));
  };

  const summary = participantDetails.reduce((acc, p) => {
    if (!p.memberId) return acc;
    const member = membersList.find(m => m.id === p.memberId);
    if (member) { if (member.isAgri) acc.agri += 1; else acc.nonAgri += 1; }
    return acc;
  }, { agri: 0, nonAgri: 0 });
  const totalParticipants = summary.agri + summary.nonAgri;

  const [existingUrls, setExistingUrls] = useState(editData?.imageUrls || (editData?.imageUrl ? [editData.imageUrl] : []));
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleActivityNumberToggle = (id) => {
    setFormData(prev => {
      const isSelected = prev.activityNumbers.includes(id);
      if (isSelected) {
        return { ...prev, activityNumbers: prev.activityNumbers.filter(num => num !== id) };
      } else {
        if (prev.activityNumbers.length >= 6) return prev; 
        const newSelection = [...prev.activityNumbers, id];
        newSelection.sort((a, b) => ACTIVITY_ITEMS.findIndex(item => item.id === a) - ACTIVITY_ITEMS.findIndex(item => item.id === b));
        return { ...prev, activityNumbers: newSelection };
      }
    });
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setNewImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setNewPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  const removeExistingUrl = (index) => setExistingUrls(prev => prev.filter((_, i) => i !== index));
  const removeNewImage = (index) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    setNewPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleCancelEdit = () => {
    if (!editData) return;
    
    setFormData({
      date: editData.date,
      startTime: editData.startTime,
      endTime: editData.endTime,
      location: editData.location,
      activityType: editData.activityType,
      activityNumbers: editData.activityNumbers || [],
      memo: editData.memo || '',
      reportNo: editData.reportNo || ''
    });
    setParticipantDetails(editData.participantDetails || []);
    setExistingUrls(editData.imageUrls || (editData.imageUrl ? [editData.imageUrl] : []));
    setNewImageFiles([]);
    setNewPreviewUrls([]);
    
    setIsViewMode(true);
  };

  const handleDelete = async () => {
    if (window.confirm('本当にこの実績を削除しますか？')) {
      try {
        await deleteDoc(doc(db, 'activities', editData.id));
        alert('削除しました。');
        navigate('/dashboard');
      } catch (error) {
        console.error(error);
        alert('削除エラー');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.activityNumbers.length === 0) { alert('活動項目番号を選択してください。'); return; }
    if (participantDetails.length === 0 || !participantDetails.some(p => p.memberId)) { alert('参加者を選択してください。'); return; }

    setIsSubmitting(true);
    try {
      let finalImageUrls = [...existingUrls];
      if (newImageFiles.length > 0) {
        const uploadPromises = newImageFiles.map(async (file) => {
          const fileName = `photos/${Date.now()}_${file.name}`;
          const imageRef = ref(storage, fileName);
          await uploadBytes(imageRef, file);
          return await getDownloadURL(imageRef);
        });
        const newlyUploadedUrls = await Promise.all(uploadPromises);
        finalImageUrls = [...finalImageUrls, ...newlyUploadedUrls];
      }
      const validParticipants = participantDetails.filter(p => p.memberId !== '');
      const submitData = { ...formData, participantDetails: validParticipants, participantsAgri: summary.agri, participantsNonAgri: summary.nonAgri, participants: totalParticipants, imageUrls: finalImageUrls, updatedAt: serverTimestamp() };

      if (editData) { await updateDoc(doc(db, 'activities', editData.id), submitData); alert('修正しました！'); }
      else { submitData.createdAt = serverTimestamp(); await addDoc(collection(db, 'activities'), submitData); alert('保存しました！'); }
      navigate('/dashboard');
    } catch (error) { console.error(error); alert('保存エラー'); } finally { setIsSubmitting(false); }
  };

  const filteredItems = ACTIVITY_ITEMS.filter(item => item.name.includes(searchTerm) || item.id.includes(searchTerm));

  const inputClass = "w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-600 disabled:opacity-100";

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700" disabled={isSubmitting}>
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
            <Sprout className="w-6 h-6 mr-2 text-green-600" />
            {editData ? (isViewMode ? '活動実績の詳細' : '活動実績の修正') : '活動実績の入力'}
          </h1>
        </div>
        
        <div className="flex space-x-2 md:space-x-3">
          {editData && isViewMode && (
            <>
              <button type="button" onClick={() => setIsViewMode(false)} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm md:text-base">
                <Edit size={18} className="mr-1.5" /> 編集
              </button>
              <button type="button" onClick={handleDelete} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors text-sm md:text-base">
                <Trash2 size={18} className="mr-1.5" /> 削除
              </button>
            </>
          )}
          {editData && !isViewMode && (
            <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm md:text-base">
              キャンセル
            </button>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-md md:max-w-6xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4">
                  <Calendar className="w-5 h-5 mr-2 text-green-600" /> 実施日時・場所
                </h2>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">報告書NO (文字列入力可)</label>
                  <input type="text" name="reportNo" value={formData.reportNo} onChange={handleChange} disabled={isViewMode} className={inputClass} placeholder="例：2026-001、第1号など" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">日付</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} disabled={isViewMode} className={inputClass} required />
                </div>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">開始</label>
                    <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} disabled={isViewMode} className={inputClass} required />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">終了</label>
                    <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} disabled={isViewMode} className={inputClass} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">活動場所</label>
                  <select name="location" value={formData.location} onChange={handleChange} disabled={isViewMode} className={inputClass} required>
                    <option value="">選択してください</option>
                    <option value="鎌田排水機場用地">鎌田排水機場用地</option>
                    <option value="内郷地区水路">内郷地区水路</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4">
                  <Sprout className="w-5 h-5 mr-2 text-green-600" /> 活動内容
                </h2>
                <div className="relative">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Excel活動項目番号 (最大6つ)</label>
                  <button type="button" onClick={() => !isViewMode && setIsDropdownOpen(!isDropdownOpen)} className={`w-full text-left bg-white border border-gray-300 rounded-xl p-3 flex justify-between items-center ${isViewMode ? 'bg-gray-100 cursor-not-allowed opacity-100' : 'focus:ring-2 focus:ring-green-500'}`}>
                    <span className={`block truncate pr-2 ${formData.activityNumbers.length === 0 ? 'text-gray-500' : (isViewMode ? 'text-gray-600 font-bold' : 'text-gray-900 font-bold')}`}>
                      {formData.activityNumbers.length > 0 ? formData.activityNumbers.join(', ') + ' 番を選択中' : '検索・選択'}
                    </span>
                    <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                  </button>
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden">
                        <div className="p-2 border-b bg-gray-50 flex items-center"><Search size={16} className="text-gray-400 mr-2 ml-1" /><input type="text" placeholder="キーワード検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full py-1.5 bg-transparent border-none focus:ring-0 text-sm" /></div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                          {filteredItems.map(item => {
                            const isSelected = formData.activityNumbers.includes(item.id);
                            const isDisabled = !isSelected && formData.activityNumbers.length >= 6;
                            return (
                              <label key={item.id} className={`flex items-start p-2.5 rounded-lg cursor-pointer ${isSelected ? 'bg-green-50 text-green-800 font-bold' : isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                                <div className="flex-1 pr-2"><div className="flex items-baseline"><span className={`w-8 text-xs font-bold flex-shrink-0 ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>{item.id}.</span><span className="text-sm">{item.name}</span></div></div>
                                <input type="checkbox" className="hidden" checked={isSelected} disabled={isDisabled} onChange={() => handleActivityNumberToggle(item.id)} />
                                {isSelected && <Check size={16} className="text-green-600 mt-0.5" />}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">具体的な活動内容（手入力）</label>
                  <input type="text" name="activityType" value={formData.activityType} onChange={handleChange} disabled={isViewMode} className={inputClass} placeholder="例：内郷地区の草刈り" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h2 className="font-bold text-gray-800 flex items-center"><Users className="w-5 h-5 mr-2 text-green-600" /> 参加者と使用機械</h2>
                  <div className="flex space-x-2 text-xs font-bold">
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">農業者: {summary.agri}</span>
                    <span className="bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-100">以外: {summary.nonAgri}</span>
                  </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {participantDetails.map((detail, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 relative group">
                      {/* 🚀 修正ポイント: hoverなどの制御を外し、編集モード中は常に表示させる */}
                      {!isViewMode && (
                        <button type="button" onClick={() => removeParticipant(index)} className="absolute -top-2 -right-2 bg-white text-red-500 p-1.5 rounded-full border border-red-100 shadow-sm transition-opacity"><Trash2 size={16} /></button>
                      )}
                      
                      <div className="flex items-center space-x-3 mb-3">
                        <select value={detail.memberId} onChange={(e) => updateParticipant(index, 'memberId', e.target.value)} disabled={isViewMode} className={`flex-1 border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100`} required>
                          <option value="">👤 氏名を選択</option>
                          {membersList.map(m => <option key={m.id} value={m.id}>{m.name} {m.isAgri ? '' : '(非)'}</option>)}
                        </select>
                        <div className={`w-28 flex items-center border border-gray-300 rounded-xl px-2 ${isViewMode ? 'bg-white' : 'bg-white'}`}>
                          <input type="number" step="0.5" min="0" value={detail.workTime} onChange={(e) => updateParticipant(index, 'workTime', parseFloat(e.target.value))} disabled={isViewMode} className="w-full py-2.5 text-sm text-center border-none focus:ring-0 disabled:bg-transparent disabled:text-gray-600 disabled:opacity-100" required />
                          <span className="text-xs text-gray-400">h</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 pl-3 border-l-2 border-green-200">
                        <select value={detail.machineId} onChange={(e) => updateParticipant(index, 'machineId', e.target.value)} disabled={isViewMode} className="flex-1 border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100">
                          <option value="">🚜 使用機械なし</option>
                          {MACHINES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {detail.machineId && (
                          <div className={`w-28 flex items-center border border-green-200 rounded-xl px-2 ${isViewMode ? 'bg-green-50' : 'bg-green-50'}`}>
                            <input type="number" step="0.5" min="0" value={detail.machineTime} onChange={(e) => updateParticipant(index, 'machineTime', parseFloat(e.target.value))} disabled={isViewMode} className="w-full py-2.5 text-sm text-center bg-transparent border-none focus:ring-0 font-bold text-green-700 disabled:opacity-100" />
                            <span className="text-xs text-green-600">h</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {!isViewMode && (
                    <button type="button" onClick={addParticipant} className="w-full py-4 border-2 border-dashed border-green-200 text-green-600 rounded-2xl font-bold flex justify-center items-center hover:bg-green-50 hover:border-green-400 transition-all"><UserPlus size={20} className="mr-2" /> 参加者を追加</button>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Camera className="w-5 h-5 mr-2 text-green-600" /> 現場写真</h2>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {existingUrls.map((url, i) => (
                    <div key={`ex-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {!isViewMode && (
                        <button type="button" onClick={() => removeExistingUrl(i)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  {newPreviewUrls.map((url, i) => (
                    <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-green-400">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {!isViewMode && (
                        <button type="button" onClick={() => removeNewImage(i)} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  
                  {!isViewMode && (
                    <label className="aspect-square border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-green-50 hover:border-green-400 cursor-pointer transition-all"><Camera size={24} /><span className="text-[10px] mt-1 font-bold">追加</span><input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" /></label>
                  )}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><MessageSquare className="w-5 h-5 mr-2 text-green-600" /> 備考・特記事項</h2>
                <textarea name="memo" value={formData.memo} onChange={handleChange} disabled={isViewMode} rows="4" className={inputClass} placeholder="作業の様子や特記事項を入力..."></textarea>
              </div>
            </div>
          </div>

          {!isViewMode && (
            <div className="max-w-md mx-auto pt-4 flex space-x-3">
              {editData && (
                <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="w-1/3 py-4 rounded-2xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-all">
                  キャンセル
                </button>
              )}
              <button type="submit" disabled={isSubmitting} className={`${editData ? 'w-2/3' : 'w-full'} flex items-center justify-center py-4 px-6 rounded-2xl shadow-lg text-lg font-bold text-white transition-all ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-95'}`}>
                <Save className="mr-2 h-6 w-6" />
                {isSubmitting ? '保存中...' : (editData ? '内容を更新する' : '活動実績を登録する')}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};

const MessageSquare = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);
