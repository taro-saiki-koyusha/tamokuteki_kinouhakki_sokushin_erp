import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout, X, ChevronDown, Check, Search, UserPlus, Tractor, Trash2, Edit, Loader2, Calculator, Package, Plus, CheckCircle, Copy, ListChecks, MessageSquare, Download } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, storage, auth } from '../firebase'; 

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

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  if (typeof timestamp.toDate === 'function') {
    const d = timestamp.toDate();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (timestamp.seconds) {
    const d = new Date(timestamp.seconds * 1000);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const d = new Date(timestamp);
  if (!isNaN(d)) {
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return '-';
};

export const ActivityForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData;
  
  const [isViewMode, setIsViewMode] = useState(location.state?.isViewMode || false);
  
  const [membersList, setMembersList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [materialsList, setMaterialsList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');
  const [userGroups, setUserGroups] = useState([]);
  const [canEditOwn, setCanEditOwn] = useState(false);
  const [canEditGroup, setCanEditGroup] = useState(false);

  const [enlargedImage, setEnlargedImage] = useState(null);

  const [formData, setFormData] = useState(
    editData ? {
      status: editData.status || '実績入力済',
      planType: editData.planType || '当初計画',
      isEssential: editData.isEssential || false, // 🚀 補助金必須フラグを追加
      groupId: editData.groupId || '',
      date: editData.date || new Date().toISOString().split('T')[0],
      startTime: editData.startTime || '08:00',
      endTime: editData.endTime || '10:00',
      location: editData.location || '',
      activityType: editData.activityType || '',
      activityNumbers: editData.activityNumbers || [], 
      memo: editData.memo || '',
      reportNo: editData.reportNo || ''
    } : {
      status: '実績入力済',
      planType: '当初計画',
      isEssential: false, // 🚀
      groupId: '',
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

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
      setMachinesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snapshot) => {
      setMaterialsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroupsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSystemUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserRole(data.role || 'reporter');
          setUserGroups(data.groupIds || []);
          setCanEditOwn(data.canEditOwn || false);
          setCanEditGroup(data.canEditGroup || false); 

          if (!editData && (data.groupIds || []).length > 0) {
            setFormData(prev => ({ ...prev, groupId: data.groupIds[0] }));
          }
        } else {
          setUserRole('reporter');
        }
      }
    });
    return () => {
      unsubscribeAuth(); unsubscribeGroups(); unsubMembers(); unsubMachines(); unsubMaterials(); unsubUsers();
    };
  }, [editData]);

  const [participantDetails, setParticipantDetails] = useState(editData?.participantDetails || []);
  const [materialDetails, setMaterialDetails] = useState(editData?.materialDetails || []); 

  const [successModal, setSuccessModal] = useState({ show: false, message: '' });
  
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedRosterIds, setSelectedRosterIds] = useState([]);

  const calculateBaseHours = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    let hours = (endH + endM / 60) - (startH + startM / 60);
    return hours > 0 ? hours : 0;
  };

  const addParticipant = () => {
    const baseHours = calculateBaseHours();
    setParticipantDetails([...participantDetails, { participantName: '', isAgri: true, wageId: '', workTime: baseHours, machineId: '', machineTime: 0 }]);
  };
  
  const duplicateParticipant = (index) => {
    const target = participantDetails[index];
    setParticipantDetails([...participantDetails, { ...target }]);
  };

  const updateParticipant = (index, field, value) => {
    const newList = [...participantDetails];
    newList[index][field] = value;
    if (field === 'machineId' && value !== '' && newList[index].machineTime === 0) newList[index].machineTime = newList[index].workTime;
    if (field === 'machineId' && value === '') newList[index].machineTime = 0;
    
    if (field === 'wageId' && value !== '') {
      const wage = membersList.find(m => m.id === value);
      if (wage && wage.isAgri !== undefined) {
        newList[index].isAgri = wage.isAgri;
      }
    }
    
    setParticipantDetails(newList);
  };
  const removeParticipant = (index) => setParticipantDetails(participantDetails.filter((_, i) => i !== index));

  const toggleRosterSelection = (id) => {
    setSelectedRosterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const applyRosterSelection = () => {
    const baseHours = calculateBaseHours();
    const newParticipants = selectedRosterIds.map(id => {
      const user = systemUsers.find(u => u.id === id); 
      return {
        participantName: user ? (user.displayName || '未設定') : '', 
        wageId: '', 
        isAgri: true, 
        workTime: baseHours,
        machineId: '',
        machineTime: 0
      };
    });
    setParticipantDetails([...participantDetails, ...newParticipants]);
    setShowRosterModal(false);
    setSelectedRosterIds([]);
  };

  const addMaterial = () => setMaterialDetails([...materialDetails, { materialId: '', quantity: 1 }]);
  const updateMaterial = (index, field, value) => {
    const newList = [...materialDetails];
    newList[index][field] = value;
    setMaterialDetails(newList);
  };
  const removeMaterial = (index) => setMaterialDetails(materialDetails.filter((_, i) => i !== index));

  const summary = participantDetails.reduce((acc, p) => {
    let isAgri = p.isAgri;
    if (isAgri === undefined) {
      const wId = p.wageId || p.memberId;
      if (wId) {
        const wage = membersList.find(m => m.id === wId);
        isAgri = wage ? wage.isAgri : true;
      } else {
        isAgri = true;
      }
    }
    if (isAgri) acc.agri += 1; else acc.nonAgri += 1;
    return acc;
  }, { agri: 0, nonAgri: 0 });
  const totalParticipants = summary.agri + summary.nonAgri;

  const { totalPersonnelCost, totalMachineCost, totalMaterialCost } = useMemo(() => {
    let pCost = 0; let mCost = 0; let matCost = 0;
    participantDetails.forEach(detail => {
      const wId = detail.wageId || detail.memberId;
      if (wId) {
        const wage = membersList.find(m => m.id === wId);
        if (wage) pCost += (detail.workTime || 0) * (wage.defaultWage || 0);
      }
      if (detail.machineId) {
        const machine = machinesList.find(m => m.id === detail.machineId);
        if (machine) mCost += (detail.machineTime || 0) * (machine.defaultPrice || 0);
      }
    });
    materialDetails.forEach(detail => {
      if (detail.materialId) {
        const mat = materialsList.find(m => m.id === detail.materialId);
        if (mat) matCost += (detail.quantity || 0) * (mat.defaultPrice || 0);
      }
    });
    return { totalPersonnelCost: pCost, totalMachineCost: mCost, totalMaterialCost: matCost };
  }, [participantDetails, materialDetails, membersList, machinesList, materialsList]);

  const [existingUrls, setExistingUrls] = useState(editData?.imageUrls || (editData?.imageUrl ? [editData.imageUrl] : []));
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleActivityNumberToggle = (id) => {
    setFormData(prev => {
      const isSelected = prev.activityNumbers.includes(id);
      if (isSelected) return { ...prev, activityNumbers: prev.activityNumbers.filter(num => num !== id) };
      if (prev.activityNumbers.length >= 6) return prev; 
      const newSelection = [...prev.activityNumbers, id];
      newSelection.sort((a, b) => ACTIVITY_ITEMS.findIndex(item => item.id === a) - ACTIVITY_ITEMS.findIndex(item => item.id === b));
      return { ...prev, activityNumbers: newSelection };
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

  const handleDownloadImage = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `photo_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("画像のダウンロードに失敗しました:", error);
      window.open(url, '_blank');
    }
  };

  const handleCancelEdit = () => {
    if (!editData) return;
    setFormData({
      status: editData.status || '実績入力済',
      planType: editData.planType || '当初計画',
      isEssential: editData.isEssential || false, // 🚀
      groupId: editData.groupId || '', date: editData.date || '', startTime: editData.startTime || '', endTime: editData.endTime || '',
      location: editData.location || '', activityType: editData.activityType || '', activityNumbers: editData.activityNumbers || [],
      memo: editData.memo || '', reportNo: editData.reportNo || ''
    });
    setParticipantDetails(editData.participantDetails || []);
    setMaterialDetails(editData.materialDetails || []); 
    setExistingUrls(editData.imageUrls || (editData.imageUrl ? [editData.imageUrl] : []));
    setNewImageFiles([]); setNewPreviewUrls([]); setIsViewMode(true);
  };

  const handleDelete = async () => {
    if (window.confirm('本当にこの実績を削除しますか？')) {
      try { await deleteDoc(doc(db, 'activities', editData.id)); navigate('/dashboard'); } 
      catch (error) { console.error(error); alert('削除エラー'); }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.groupId) { alert('対象グループを選択してください。'); return; }

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
      
      const validParticipants = participantDetails
        .filter(p => (p.wageId || p.memberId || p.participantName))
        .map(p => ({
          ...p,
          isAgri: p.isAgri !== undefined ? p.isAgri : (membersList.find(m => m.id === (p.wageId || p.memberId))?.isAgri ?? true)
        }));
        
      const validMaterials = materialDetails.filter(m => m.materialId !== ''); 
      
      const submitData = { 
        ...formData, 
        participantDetails: validParticipants, 
        materialDetails: validMaterials, 
        participantsAgri: summary.agri, 
        participantsNonAgri: summary.nonAgri, 
        participants: totalParticipants, 
        imageUrls: finalImageUrls, 
        updatedAt: serverTimestamp() 
      };

      if (editData) { 
        submitData.updatedBy = currentUser?.uid; 
        await updateDoc(doc(db, 'activities', editData.id), submitData); 
        setSuccessModal({ show: true, message: '活動実績を修正しました。' });
      } 
      else { 
        submitData.createdAt = serverTimestamp(); 
        submitData.createdBy = currentUser?.uid; 
        await addDoc(collection(db, 'activities'), submitData); 
        setSuccessModal({ show: true, message: '新しい活動実績を登録しました。' });
      }
    } catch (error) { 
      console.error(error); 
      alert('保存エラーが発生しました。'); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const filteredItems = ACTIVITY_ITEMS.filter(item => item.name.includes(searchTerm) || item.id.includes(searchTerm));
  const inputClass = "w-full min-w-0 box-border border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-600 disabled:opacity-100";
  
  const isCreator = editData?.createdBy === currentUser?.uid;
  const isInSameGroup = userGroups.includes(editData?.groupId);
  const canEditOrDelete = userRole === 'admin' || userRole === 'manager' || 
    (userRole === 'reporter' && canEditOwn && isCreator) || 
    (userRole === 'reporter' && canEditGroup && isInSameGroup);
    
  const selectableGroups = (userRole === 'admin' || userRole === 'manager') ? groupsList : groupsList.filter(g => userGroups.includes(g.id));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12 overflow-x-hidden w-full">
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-blue-800 font-bold text-lg tracking-wider">データを保存しています...</p>
        </div>
      )}

      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setEnlargedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white hover:text-gray-300 p-2 z-50 bg-black/50 rounded-full transition-colors"
            onClick={() => setEnlargedImage(null)}
          >
            <X size={28} />
          </button>
          
          <img 
            src={enlargedImage} 
            alt="Enlarged" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
            onClick={(e) => e.stopPropagation()} 
          />
          
          <div className="absolute bottom-8 flex space-x-4">
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownloadImage(enlargedImage); }} 
              className="flex items-center px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-md transition-all active:scale-95 font-bold shadow-lg border border-white/30"
            >
              <Download size={20} className="mr-2" />
              ダウンロード
            </button>
          </div>
        </div>
      )}

      {successModal.show && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">保存完了</h3>
              <p className="text-sm text-gray-600">{successModal.message}</p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
              <button
                onClick={() => {
                  setSuccessModal({ show: false, message: '' });
                  navigate('/dashboard'); 
                }}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                ダッシュボードへ戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {showRosterModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-600" />
                登録ユーザーから一括追加
              </h2>
              <button type="button" onClick={() => setShowRosterModal(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {systemUsers.map(u => (
                  <label key={u.id} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${selectedRosterIds.includes(u.id) ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedRosterIds.includes(u.id)} onChange={() => toggleRosterSelection(u.id)} className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                    <span className="ml-3 font-bold text-gray-800">{u.displayName || '未設定'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <span className="text-sm font-bold text-purple-700">{selectedRosterIds.length} 名を選択中</span>
              <button type="button" onClick={applyRosterSelection} disabled={selectedRosterIds.length === 0} className="px-6 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700" disabled={isSubmitting}>
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
            <Sprout className="w-6 h-6 mr-2 text-green-600" />
            {editData ? (isViewMode ? '活動実績の詳細' : '活動実績の修正') : '活動実績の入力（計画追加）'}
          </h1>
        </div>
        
        <div className="flex space-x-2 md:space-x-3">
          {editData && isViewMode && canEditOrDelete && (
            <>
              <button type="button" onClick={() => setIsViewMode(false)} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm md:text-base"><Edit size={18} className="mr-1.5" /> 編集</button>
              <button type="button" onClick={handleDelete} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors text-sm md:text-base"><Trash2 size={18} className="mr-1.5" /> 削除</button>
            </>
          )}
          {editData && !isViewMode && (
            <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm md:text-base">キャンセル</button>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 w-full max-w-md md:max-w-6xl mx-auto box-border">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Calendar className="w-5 h-5 mr-2 text-green-600" /> 実施日時・場所</h2>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-bold text-gray-700 mb-1">ステータス</label>
                    <select name="status" value={formData.status} onChange={handleChange} disabled={isViewMode} className={`w-full min-w-0 box-border border rounded-xl p-3 font-bold focus:ring-2 focus:ring-green-500 disabled:opacity-100 ${formData.status === '未実施' ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-green-50 text-green-700 border-green-300'}`}>
                      <option value="未実施">未実施（計画用）</option>
                      <option value="実績入力済">実績入力済（完了）</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-bold text-gray-700 mb-1">計画区分</label>
                    <select name="planType" value={formData.planType} onChange={handleChange} disabled={isViewMode} className="w-full min-w-0 box-border border border-gray-300 rounded-xl p-3 font-bold focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:opacity-100 bg-white text-gray-800">
                      <option value="当初計画">当初計画</option>
                      <option value="期中追加">期中追加</option>
                      <option value="突発・緊急">突発・緊急</option>
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                  <label className="block text-sm font-bold text-blue-900 mb-1">対象グループ <span className="text-red-500">*</span></label>
                  <select name="groupId" value={formData.groupId} onChange={handleChange} disabled={isViewMode} className={`${inputClass} border-blue-200 focus:ring-blue-500`} required>
                    <option value="">グループを選択してください</option>
                    {selectableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">報告書NO (文字列入力可)</label><input type="text" name="reportNo" value={formData.reportNo} onChange={handleChange} disabled={isViewMode} className={inputClass} placeholder="例：2026-001、第1号など" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">日付</label><input type="date" name="date" value={formData.date} onChange={handleChange} disabled={isViewMode} className={inputClass} required /></div>
                
                <div className="flex space-x-3 sm:space-x-4">
                  <div className="flex-1 min-w-0"><label className="block text-sm font-bold text-gray-700 mb-1">開始</label><input type="time" name="startTime" value={formData.startTime} onChange={handleChange} disabled={isViewMode} className={inputClass} required /></div>
                  <div className="flex-1 min-w-0"><label className="block text-sm font-bold text-gray-700 mb-1">終了</label><input type="time" name="endTime" value={formData.endTime} onChange={handleChange} disabled={isViewMode} className={inputClass} required /></div>
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
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Sprout className="w-5 h-5 mr-2 text-green-600" /> 活動内容</h2>
                
                {/* 🚀 必須フラグのチェックボックス */}
                <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      name="isEssential"
                      checked={formData.isEssential} 
                      onChange={(e) => setFormData({...formData, isEssential: e.target.checked})}
                      disabled={isViewMode}
                      className="w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 disabled:opacity-50" 
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-yellow-900">この活動を「補助金必須作業」として設定する</span>
                      <span className="text-[10px] text-yellow-700 mt-0.5">補助金申請の要件となる重要な活動の場合はチェックを入れてください。</span>
                    </div>
                  </label>
                </div>

                <div className="relative">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Excel活動項目番号 (最大6つ)</label>
                  <button type="button" onClick={() => !isViewMode && setIsDropdownOpen(!isDropdownOpen)} className={`w-full min-w-0 box-border text-left bg-white border border-gray-300 rounded-xl p-3 flex justify-between items-center ${isViewMode ? 'bg-gray-100 cursor-not-allowed opacity-100' : 'focus:ring-2 focus:ring-green-500'}`}>
                    <span className={`block truncate pr-2 ${formData.activityNumbers.length === 0 ? 'text-gray-500' : (isViewMode ? 'text-gray-600 font-bold' : 'text-gray-900 font-bold')}`}>
                      {formData.activityNumbers.length > 0 ? formData.activityNumbers.join(', ') + ' 番を選択中' : '検索・選択（任意）'}
                    </span>
                    <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                  </button>
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                      <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 shadow-2xl rounded-xl overflow-hidden">
                        <div className="p-2 border-b bg-gray-50 flex items-center"><Search size={16} className="text-gray-400 mr-2 ml-1" /><input type="text" placeholder="キーワード検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full min-w-0 box-border py-1.5 bg-transparent border-none focus:ring-0 text-sm" /></div>
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

                <div className="space-y-4 max-h-[600px] overflow-y-auto overflow-x-hidden pr-1">
                  {participantDetails.map((detail, index) => {
                    const wId = detail.wageId || detail.memberId;
                    const wage = membersList.find(m => m.id === wId);
                    const memberWage = wage ? (wage.defaultWage || 0) : 0;
                    const memberTotal = (detail.workTime || 0) * memberWage;

                    const machine = machinesList.find(m => m.id === detail.machineId);
                    const machinePrice = machine ? (machine.defaultPrice || 0) : 0;
                    const machineTotal = (detail.machineTime || 0) * machinePrice;
                    
                    let isAgri = detail.isAgri;
                    if (isAgri === undefined) {
                      isAgri = wage ? wage.isAgri : true;
                    }

                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 relative group">
                        
                        {!isViewMode && (
                          <div className="absolute -top-3 right-0 sm:-right-2 flex space-x-1 z-10">
                            <button type="button" onClick={() => duplicateParticipant(index)} className="bg-white text-blue-500 p-1.5 rounded-full border border-blue-100 shadow-sm transition-opacity hover:bg-blue-50" title="この行をコピー">
                              <Copy size={16} />
                            </button>
                            <button type="button" onClick={() => removeParticipant(index)} className="bg-white text-red-500 p-1.5 rounded-full border border-red-100 shadow-sm transition-opacity hover:bg-red-50" title="削除">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 mb-3 mt-1">
                          <div className="flex flex-1 w-full sm:w-auto gap-1.5 sm:gap-2 items-center min-w-0">
                            <select
                              value={isAgri ? 'true' : 'false'}
                              onChange={(e) => updateParticipant(index, 'isAgri', e.target.value === 'true')}
                              disabled={isViewMode}
                              className={`w-[4.5rem] sm:w-[5.5rem] shrink-0 box-border border border-gray-300 rounded-xl p-1.5 sm:p-2.5 text-[10px] sm:text-xs font-bold focus:ring-2 focus:ring-green-500 disabled:opacity-100 cursor-pointer ${isAgri ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}
                            >
                              <option value="true">農業者</option>
                              <option value="false">以外</option>
                            </select>

                            <input 
                              type="text" 
                              list="system-users-list"
                              placeholder="👤 氏名（任意）" 
                              value={detail.participantName || ''} 
                              onChange={(e) => updateParticipant(index, 'participantName', e.target.value)} 
                              disabled={isViewMode} 
                              className={`flex-1 w-full min-w-0 box-border border border-gray-300 rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100`} 
                            />
                            <select 
                              value={wId || ''} 
                              onChange={(e) => updateParticipant(index, 'wageId', e.target.value)} 
                              disabled={isViewMode} 
                              className={`flex-1 w-full min-w-0 box-border border border-gray-300 rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100`}
                            >
                              <option value="">💰 単価を選択</option>
                              {membersList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                          <div className="flex gap-2 items-center justify-end shrink-0 w-full sm:w-auto ml-auto">
                            <div className={`w-20 md:w-24 flex items-center border border-gray-300 rounded-xl px-2 box-border ${isViewMode ? 'bg-white' : 'bg-white'}`}>
                              <input type="number" step="0.5" min="0" value={detail.workTime} onChange={(e) => updateParticipant(index, 'workTime', parseFloat(e.target.value))} disabled={isViewMode} className="w-full min-w-0 box-border py-2.5 text-sm text-center border-none focus:ring-0 disabled:bg-transparent disabled:text-gray-600 disabled:opacity-100" />
                              <span className="text-xs text-gray-400">h</span>
                            </div>
                            <div className="w-16 md:w-20 flex flex-col items-end justify-center leading-tight">
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">@{memberWage.toLocaleString()}円</span>
                              <span className="text-sm font-bold text-gray-700 whitespace-nowrap">¥{memberTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 pl-3 border-l-2 border-green-200">
                          <div className="flex flex-1 w-full sm:w-auto min-w-0">
                            <select value={detail.machineId} onChange={(e) => updateParticipant(index, 'machineId', e.target.value)} disabled={isViewMode} className="w-full min-w-0 box-border border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100">
                              <option value="">🚜 使用機械なし</option>
                              {machinesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                          </div>
                          {detail.machineId && (
                            <div className="flex gap-2 items-center justify-end shrink-0 w-full sm:w-auto ml-auto">
                              <div className={`w-20 md:w-24 flex items-center border border-green-200 rounded-xl px-2 shrink-0 box-border ${isViewMode ? 'bg-green-50' : 'bg-green-50'}`}>
                                <input type="number" step="0.5" min="0" value={detail.machineTime} onChange={(e) => updateParticipant(index, 'machineTime', parseFloat(e.target.value))} disabled={isViewMode} className="w-full min-w-0 box-border py-2.5 text-sm text-center bg-transparent border-none focus:ring-0 font-bold text-green-700 disabled:opacity-100" />
                                <span className="text-xs text-green-600">h</span>
                              </div>
                              <div className="w-16 md:w-20 flex flex-col items-end justify-center leading-tight">
                                <span className="text-[10px] text-green-600/70 whitespace-nowrap">@{machinePrice.toLocaleString()}円</span>
                                <span className="text-sm font-bold text-green-700 whitespace-nowrap">¥{machineTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {!isViewMode && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <button type="button" onClick={addParticipant} className="flex-1 py-3 box-border border-2 border-dashed border-green-200 text-green-600 rounded-2xl font-bold flex justify-center items-center hover:bg-green-50 hover:border-green-400 transition-all">
                        <UserPlus size={18} className="mr-2" /> 1枠追加
                      </button>
                      <button type="button" onClick={() => setShowRosterModal(true)} className="flex-1 py-3 box-border border-2 border-dashed border-purple-200 text-purple-600 rounded-2xl font-bold flex justify-center items-center hover:bg-purple-50 hover:border-purple-400 transition-all">
                        <Users size={18} className="mr-2" /> 登録ユーザーから一括追加
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <h2 className="font-bold text-gray-800 flex items-center"><Package className="w-5 h-5 mr-2 text-green-600" /> 使用資材</h2>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
                  {materialDetails.map((detail, index) => {
                    const material = materialsList.find(m => m.id === detail.materialId);
                    const matPrice = material ? (material.defaultPrice || 0) : 0;
                    const matUnit = material ? (material.unit || '個') : '個';
                    const matTotal = (detail.quantity || 0) * matPrice;

                    return (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 relative group flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
                        {!isViewMode && (
                          <button type="button" onClick={() => removeMaterial(index)} className="absolute -top-2 right-0 sm:-right-2 bg-white text-red-500 p-1.5 rounded-full border border-red-100 shadow-sm transition-opacity z-10"><Trash2 size={16} /></button>
                        )}
                        
                        <div className="flex-1 w-full sm:w-auto min-w-0 mt-1">
                          <select value={detail.materialId} onChange={(e) => updateMaterial(index, 'materialId', e.target.value)} disabled={isViewMode} className={`w-full min-w-0 box-border border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100`}>
                            <option value="">📦 資材を選択</option>
                            {materialsList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </div>
                        
                        <div className="flex gap-2 items-center justify-end shrink-0 w-full sm:w-auto ml-auto">
                          <div className={`w-24 md:w-28 flex items-center border border-gray-300 rounded-xl px-2 box-border ${isViewMode ? 'bg-white' : 'bg-white'}`}>
                            <input type="number" step="1" min="0" value={detail.quantity} onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value))} disabled={isViewMode} className="w-full min-w-0 box-border py-2.5 text-sm text-center border-none focus:ring-0 disabled:bg-transparent disabled:text-gray-600 disabled:opacity-100" />
                            <span className="text-xs text-gray-400 whitespace-nowrap">{matUnit}</span>
                          </div>
                          <div className="w-16 md:w-20 flex flex-col items-end justify-center leading-tight">
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">@{matPrice.toLocaleString()}円</span>
                            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">¥{matTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {!isViewMode && (
                    <button type="button" onClick={addMaterial} className="w-full py-3 box-border border-2 border-dashed border-gray-300 text-gray-600 rounded-xl font-bold flex justify-center items-center hover:bg-gray-100 transition-all"><Plus size={18} className="mr-2" /> 資材を追加</button>
                  )}
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex flex-col space-y-2">
                <div className="flex items-center text-blue-800 font-bold mb-1">
                  <Calculator size={16} className="mr-1.5" /> 費用の目安（合計）
                </div>
                <div className="flex justify-between items-center text-sm text-gray-700">
                  <span>人件費:</span>
                  <span className="font-bold font-mono">¥{totalPersonnelCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-700">
                  <span>機械等利用料:</span>
                  <span className="font-bold font-mono">¥{totalMachineCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-700">
                  <span>資材費:</span>
                  <span className="font-bold font-mono">¥{totalMaterialCost.toLocaleString()}</span>
                </div>
                <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between items-center text-base text-blue-900 font-bold">
                  <span>合計:</span>
                  <span className="font-mono text-lg">¥{(totalPersonnelCost + totalMachineCost + totalMaterialCost).toLocaleString()}</span>
                </div>
              </div>

            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Camera className="w-5 h-5 mr-2 text-green-600" /> 現場写真</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {existingUrls.map((url, i) => (
                    <div 
                      key={`ex-${i}`} 
                      className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 cursor-pointer group"
                      onClick={() => setEnlargedImage(url)}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      {!isViewMode && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeExistingUrl(i); }} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full z-10 hover:bg-red-500 transition-colors"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                  {newPreviewUrls.map((url, i) => (
                    <div 
                      key={`new-${i}`} 
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-green-400 cursor-pointer group"
                      onClick={() => setEnlargedImage(url)}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      {!isViewMode && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeNewImage(i); }} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full z-10 hover:bg-red-500 transition-colors"><X size={12} /></button>
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

          {editData && (
            <div className="bg-gray-100/70 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 border border-gray-200 mt-8">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-500">登録:</span> 
                <span>{systemUsers.find(u => u.id === editData.createdBy)?.displayName || '不明'}</span>
                <span className="text-gray-400 font-mono">({formatTimestamp(editData.createdAt)})</span>
              </div>
              {editData.updatedBy && (
                <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                  <span className="font-bold text-gray-500">最終更新:</span> 
                  <span>{systemUsers.find(u => u.id === editData.updatedBy)?.displayName || '不明'}</span>
                  <span className="text-gray-400 font-mono">({formatTimestamp(editData.updatedAt)})</span>
                </div>
              )}
            </div>
          )}

          {!isViewMode && (
            <div className="max-w-md mx-auto pt-4 flex space-x-3">
              {editData && (
                <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="w-1/3 py-4 rounded-2xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 transition-all">
                  キャンセル
                </button>
              )}
              <button type="submit" disabled={isSubmitting} className={`${editData ? 'w-2/3' : 'w-full'} flex items-center justify-center py-4 px-6 rounded-2xl shadow-lg text-lg font-bold text-white transition-all ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-95'}`}>
                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Save className="mr-2 h-6 w-6" />}
                {isSubmitting ? '保存中...' : (editData ? '内容を更新する' : '活動実績を登録する')}
              </button>
            </div>
          )}
        </form>

        <datalist id="system-users-list">
          {systemUsers.map(u => (
            <option key={u.id} value={u.displayName || '名前未設定'} />
          ))}
        </datalist>

      </main>
    </div>
  );
};

export default ActivityForm;