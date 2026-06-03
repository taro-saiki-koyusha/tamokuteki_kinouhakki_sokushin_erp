import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, MapPin, Clock, Calendar, Users, Sprout, X, ChevronDown, Check, Search, UserPlus, Tractor, Trash2, Edit, Loader2, Calculator, Package, Plus, CheckCircle, Copy, ListChecks, MessageSquare, Download, Link as LinkIcon, FileSpreadsheet, Printer, Hash } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, storage, auth } from '../firebase'; 
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';
import { ACTIVITY_ITEMS, LOCATION_OPTIONS, ORGANIZATION_NAME } from '../constants';

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
  return '-';
};

export const ActivityForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); 
  
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const [editData, setEditData] = useState(location.state?.editData || null);
  const [isViewMode, setIsViewMode] = useState(location.state?.isViewMode || false);
  const [isLoadingDirect, setIsLoadingDirect] = useState(false); 
  const [isExporting, setIsExporting] = useState(false); 
  
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
  const [existingUrls, setExistingUrls] = useState([]);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    status: '実績入力済', planType: '当初計画', isEssential: false, groupId: '',
    date: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '10:00',
    location: '', activityType: '', activityNumbers: [], memo: '', reportNo: '',
    budget: ''
  });

  const [participantDetails, setParticipantDetails] = useState([]);
  const [materialDetails, setMaterialDetails] = useState([]); 

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  useEffect(() => {
    if (id && !location.state?.editData) {
      setIsLoadingDirect(true);
      const fetchActivityDirect = async () => {
        try {
          const docRef = doc(db, 'activities', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setEditData({ id: docSnap.id, ...data });
            setIsViewMode(true);
            setFormData({
              status: data.status || '実績入力済', planType: data.planType || '当初計画',
              isEssential: data.isEssential || false, groupId: data.groupId || '',
              date: data.date || '', startTime: data.startTime || '08:00', endTime: data.endTime || '10:00',
              location: data.location || '', activityType: data.activityType || '',
              activityNumbers: data.activityNumbers || [], memo: data.memo || '',
              reportNo: data.reportNo || '', budget: data.budget || '' 
            });
            setParticipantDetails(data.participantDetails || []);
            setMaterialDetails(data.materialDetails || []); 
            setExistingUrls(data.imageUrls || (data.imageUrl ? [data.imageUrl] : []));
          } else {
            alert('指定された活動実績が見つかりません。');
            navigate('/dashboard');
          }
        } catch (error) { console.error(error); } finally { setIsLoadingDirect(false); }
      };
      fetchActivityDirect();
    } else if (location.state?.editData) {
      const d = location.state.editData;
      setFormData({
        status: d.status || '実績入力済', planType: d.planType || '当初計画', isEssential: d.isEssential || false, groupId: d.groupId || '',
        date: d.date, startTime: d.startTime, endTime: d.endTime, location: d.location, activityType: d.activityType,
        activityNumbers: d.activityNumbers || [], memo: d.memo || '', reportNo: d.reportNo || '', budget: d.budget || '' 
      });
      setParticipantDetails(d.participantDetails || []);
      setMaterialDetails(d.materialDetails || []); 
      setExistingUrls(d.imageUrls || (d.imageUrl ? [d.imageUrl] : []));
    }
  }, [id, location.state, navigate]);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (s) => setMembersList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMachines = onSnapshot(collection(db, 'machines'), (s) => setMachinesList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (s) => setMaterialsList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubGroups = onSnapshot(collection(db, 'groups'), (s) => setGroupsList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => setSystemUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserRole(data.role || 'reporter');
          setUserGroups(data.groupIds || []);
          setCanEditOwn(data.canEditOwn || false);
          setCanEditGroup(data.canEditGroup || false); 

          if (!id && !location.state?.editData && (data.groupIds || []).length > 0) {
            setFormData(prev => ({ ...prev, groupId: data.groupIds[0] }));
          }
        } else {
          setUserRole('reporter');
        }
      }
    });
    return () => { unsubAuth(); unsubGroups(); unsubMembers(); unsubMachines(); unsubMaterials(); unsubUsers(); };
  }, [id, location.state]);

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
    setParticipantDetails([...participantDetails, { participantName: '', isManualName: false, isAgri: true, wageId: '', workTime: baseHours, machineId: '', machineTime: 0 }]);
  };
  
  const duplicateParticipant = (index) => {
    const target = participantDetails[index];
    setParticipantDetails([...participantDetails, { ...target }]);
  };

  const updateParticipant = (index, field, value) => {
    const newList = [...participantDetails];
    newList[index][field] = value;
    
    if (field === 'machineId' && value !== '' && newList[index].machineTime === 0) {
      newList[index].machineTime = newList[index].workTime;
    }
    if (field === 'machineId' && value === '') {
      newList[index].machineTime = 0;
    }

    if (field === 'wageId' && value === 'zero') {
      newList[index].workTime = 0;
    }
    
    setParticipantDetails(newList);
  };
  
  const removeParticipant = (index) => setParticipantDetails(participantDetails.filter((_, i) => i !== index));

  const toggleRosterSelection = (userId) => {
    setSelectedRosterIds(prev => prev.includes(userId) ? prev.filter(x => x !== userId) : [...prev, userId]);
  };

  const applyRosterSelection = () => {
    const baseHours = calculateBaseHours();
    const newParticipants = selectedRosterIds.map(userId => {
      const user = systemUsers.find(u => u.id === userId); 
      return { participantName: user ? (user.displayName || '未設定') : '', isManualName: false, wageId: '', isAgri: true, workTime: baseHours, machineId: '', machineTime: 0 };
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
      if (wId && wId !== 'zero') {
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
      if (wId && wId !== 'zero') {
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

  const handleActivityNumberToggle = (activityId) => {
    setFormData(prev => {
      const isSelected = prev.activityNumbers.includes(activityId);
      if (isSelected) return { ...prev, activityNumbers: prev.activityNumbers.filter(num => num !== activityId) };
      if (prev.activityNumbers.length >= 6) return prev; 
      const newSelection = [...prev.activityNumbers, activityId];
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
      console.error("ダウンロード失敗:", error);
      window.open(url, '_blank');
    }
  };

  const handleCancelEdit = () => {
    if (!editData) return;
    setFormData({
      status: editData.status || '実績入力済', planType: editData.planType || '当初計画', isEssential: editData.isEssential || false,
      groupId: editData.groupId || '', date: editData.date || '', startTime: editData.startTime || '', endTime: editData.endTime || '',
      location: editData.location || '', activityType: editData.activityType || '', activityNumbers: editData.activityNumbers || [],
      memo: editData.memo || '', reportNo: editData.reportNo || '', budget: editData.budget || ''
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

  const handleCopyLink = () => {
    if (!editData?.id) return;
    const link = `${window.location.origin}/activity-form/${editData.id}`;
    navigator.clipboard.writeText(link).then(() => alert("リンクをコピーしました！")).catch(() => alert("コピー失敗"));
  };

  const handleExportSingleReport = async () => {
    if (!editData) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/様式1_活動報告書_農地維持支払.xlsx?t=${Date.now()}`);
      if (!response.ok) throw new Error('テンプレートが見つかりません');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);

      const [startH, startM] = editData.startTime.split(':').map(Number);
      const [endH, endM] = editData.endTime.split(':').map(Number);
      let duration = (endH + endM / 60) - (startH + startM / 60);
      if (duration < 0) duration += 24;

      const sheet1 = workbook.sheet('活動報告書') || workbook.sheets()[0];
      
      sheet1.cell('AH3').value(editData.reportNo || '');
      sheet1.cell('A7').value(editData.date);
      sheet1.cell('C7').value(editData.startTime);
      sheet1.cell('F7').value(editData.endTime);
      sheet1.cell('I7').value(duration);
      sheet1.cell('M7').value(Number(editData.participantsAgri || 0));
      sheet1.cell('O7').value(Number(editData.participantsNonAgri || 0));
      sheet1.cell('Q7').value(Number(editData.participants || 0));
      sheet1.cell('S7').value(editData.activityNumbers?.join(', '));
      sheet1.cell('AA7').value(editData.activityType || '');
      sheet1.cell('A8').value(editData.memo || '');

      const sheet2 = workbook.sheet('日当借上支払明細') || workbook.sheets()[1];
      sheet2.cell('AJ3').value(editData.date);

      if (editData.participantDetails && editData.participantDetails.length > 0) {
        editData.participantDetails.forEach((detail, index) => {
          const row = 6 + index;
          const wId = detail.wageId || detail.memberId;
          const wage = membersList.find(m => m.id === wId);
          const machine = machinesList.find(m => m.id === detail.machineId);

          let memberTotal = 0; let machineTotal = 0;

          if (detail.participantName || wage || wId === 'zero') {
            memberTotal = detail.workTime * (wage?.defaultWage || 0);
            
            const participantName = detail.participantName || wage?.name || '名称未設定';
            const matchedUser = systemUsers.find(u => (u.displayName || u.name) === participantName);
            const memberNo = matchedUser?.memberNo ? matchedUser.memberNo : '-';

            sheet2.cell(`A${row}`).value(participantName);
            sheet2.cell(`F${row}`).value(memberNo); 
            sheet2.cell(`G${row}`).value(detail.workTime);
            sheet2.cell(`J${row}`).value('時間');
            sheet2.cell(`L${row}`).value(wage?.defaultWage || 0);
            sheet2.cell(`O${row}`).value(memberTotal);
          }
          if (machine) {
            machineTotal = detail.machineTime * machine.defaultPrice;
            sheet2.cell(`S${row}`).value(machine.name);
            sheet2.cell(`X${row}`).value(detail.machineTime);
            sheet2.cell(`AA${row}`).value('時間');
            sheet2.cell(`AC${row}`).value(machine.defaultPrice);
            sheet2.cell(`AF${row}`).value(machineTotal);
          }
          sheet2.cell(`AJ${row}`).value(memberTotal + machineTotal);
        });
      }
      const blob = await workbook.outputAsync();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `活動報告書_${editData.date}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); alert('Excel作成エラーが発生しました。'); } finally { setIsExporting(false); }
  };

  const handleDirectPrint = () => {
    setTimeout(() => { window.print(); }, 150);
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
      
      let finalReportNo = formData.reportNo;
      if (!finalReportNo) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        finalReportNo = `${year}${month}${day}${hours}${minutes}${seconds}`;
      }

      const submitData = { 
        ...formData, 
        reportNo: finalReportNo, 
        budget: formData.budget ? Number(formData.budget) : 0, 
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
    
  const canExport = userRole === 'admin' || userRole === 'manager';
  const selectableGroups = (userRole === 'admin' || userRole === 'manager') ? groupsList : groupsList.filter(g => userGroups.includes(g.id));
  const totalCost = totalPersonnelCost + totalMachineCost + totalMaterialCost;

  const canResetReportNo = userRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12 overflow-x-hidden w-full print:bg-white print:pb-0">
      <style>{`
        @media print {
          @page { margin: 0; size: A4; }
          body { background: white !important; margin: 15mm !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {(isSubmitting || isLoadingDirect) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm no-print">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-blue-800 font-bold text-lg tracking-wider">
            {isLoadingDirect ? 'データを読み込んでいます...' : 'データを保存しています...'}
          </p>
        </div>
      )}

      {enlargedImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 no-print" 
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
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
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
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

      <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30 no-print">
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
          {editData && (
            <button type="button" onClick={handleCopyLink} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-purple-50 text-purple-600 rounded-lg font-bold hover:bg-purple-100 transition-colors text-sm md:text-base">
              <LinkIcon size={18} className="md:mr-1.5" /> <span className="hidden md:inline">リンクをコピー</span>
            </button>
          )}

          {editData && isViewMode && canExport && (
            <>
              <button type="button" onClick={handleExportSingleReport} disabled={isExporting} className={`flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold transition-colors text-sm md:text-base ${isExporting ? 'bg-blue-400 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                <FileSpreadsheet size={18} className="md:mr-1.5" /> <span className="hidden md:inline">{isExporting ? '生成中...' : 'Excel出力'}</span>
              </button>
              <button type="button" onClick={handleDirectPrint} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm md:text-base">
                <Printer size={18} className="md:mr-1.5" /> <span className="hidden md:inline">PDF出力</span>
              </button>
            </>
          )}

          {editData && isViewMode && canEditOrDelete && (
            <>
              <button type="button" onClick={() => setIsViewMode(false)} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm md:text-base"><Edit size={18} className="mr-1.5" /> <span className="hidden md:inline">編集</span></button>
              <button type="button" onClick={handleDelete} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors text-sm md:text-base"><Trash2 size={18} className="mr-1.5" /> <span className="hidden md:inline">削除</span></button>
            </>
          )}
          {editData && !isViewMode && (
            <button type="button" onClick={handleCancelEdit} disabled={isSubmitting} className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm md:text-base">キャンセル</button>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8 w-full max-w-md md:max-w-6xl mx-auto box-border no-print">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 h-full">
              <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Calendar className="w-5 h-5 mr-2 text-green-600" /> 1）実施日時・場所</h2>
              
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
              
              {editData ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">報告書NO (自動採番)</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      name="reportNo" 
                      value={formData.reportNo || '（未設定：更新時に自動採番されます）'} 
                      disabled 
                      className={`${inputClass} bg-gray-100 flex-1 ${formData.reportNo ? 'text-gray-600' : 'text-orange-500 font-bold text-xs'}`} 
                    />
                    {!isViewMode && formData.reportNo && canResetReportNo && (
                      <button 
                        type="button" 
                        onClick={() => setFormData({ ...formData, reportNo: '' })}
                        className="px-3 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 whitespace-nowrap transition-colors"
                      >
                        番号をリセット
                      </button>
                    )}
                  </div>
                  {!isViewMode && formData.reportNo && canResetReportNo && (
                    <p className="text-[10px] text-gray-500 mt-1.5 flex items-center">
                      ※重複時は「番号をリセット」を押して保存すると再採番されます。（管理者のみ表示）
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-500 font-bold flex items-center">
                  <CheckCircle size={16} className="mr-2 text-green-500" /> 報告書NOは登録時に自動で設定されます。
                </div>
              )}

              <div className="w-36 sm:w-44">
                <label className="block text-sm font-bold text-gray-700 mb-1">日付</label>
                <input type="date" name="date" value={formData.date} onChange={handleChange} disabled={isViewMode} className={inputClass} required />
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-[110px] sm:w-32 shrink-0">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1 pl-1">開始</label>
                  <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} disabled={isViewMode} className="w-full box-border border border-gray-300 rounded-lg p-2 text-center text-sm md:text-base focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-600 disabled:opacity-100" required />
                </div>
                
                <div className="shrink-0 pt-4 text-gray-400 font-bold text-sm">〜</div>
                
                <div className="w-[110px] sm:w-32 shrink-0">
                  <label className="block text-[11px] font-bold text-gray-500 mb-1 pl-1">終了</label>
                  <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} disabled={isViewMode} className="w-full box-border border border-gray-300 rounded-lg p-2 text-center text-sm md:text-base focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-600 disabled:opacity-100" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">活動場所</label>
                <input 
                  type="text" 
                  name="location" 
                  list="location-list"
                  value={formData.location} 
                  onChange={handleChange} 
                  disabled={isViewMode} 
                  className={inputClass} 
                  placeholder="例：鎌田地区農道" 
                  required 
                />
                <datalist id="location-list">
                  {LOCATION_OPTIONS.map(loc => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4 h-full">
              <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Sprout className="w-5 h-5 mr-2 text-green-600" /> 2）活動内容</h2>
              
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

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><Camera className="w-5 h-5 mr-2 text-green-600" /> 3）現場写真</h2>
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

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="font-bold text-gray-800 flex items-center"><Users className="w-5 h-5 mr-2 text-green-600" /> 4）参加者と使用機械</h2>
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

                // 🚀 スマート切替UIのための判定ロジック
                let isManual = detail.isManualName;
                if (isManual === undefined) {
                  // 既存データなどで「手入力フラグ」がない場合、リストに無い名前なら自動で手入力モードにする
                  isManual = !!(detail.participantName && !systemUsers.some(u => u.displayName === detail.participantName));
                }

                return (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-3 md:p-4 relative group mt-3">
                    
                    {!isViewMode && (
                      <div className="absolute -top-3.5 right-1 md:right-3 flex space-x-1 z-10">
                        <button type="button" onClick={() => duplicateParticipant(index)} className="bg-white text-blue-500 p-1.5 rounded-full border border-blue-100 shadow-sm transition-opacity hover:bg-blue-50" title="この行をコピー">
                          <Copy size={16} />
                        </button>
                        <button type="button" onClick={() => removeParticipant(index)} className="bg-white text-red-500 p-1.5 rounded-full border border-red-100 shadow-sm transition-opacity hover:bg-red-50" title="削除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2.5">
                      
                      <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full">
                        
                        <div className="flex gap-2 w-full md:w-auto">
                          <select
                            value={isAgri ? 'true' : 'false'}
                            onChange={(e) => updateParticipant(index, 'isAgri', e.target.value === 'true')}
                            disabled={isViewMode}
                            className={`w-20 md:w-24 shrink-0 box-border border border-gray-300 rounded-xl p-2 text-xs md:text-sm font-bold focus:ring-2 focus:ring-green-500 disabled:opacity-100 cursor-pointer ${isAgri ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}
                          >
                            <option value="true">農業者</option>
                            <option value="false">以外</option>
                          </select>

                          {/* 🚀 完全に作り直した「選択」と「手入力」のスマート切替UI */}
                          <div className="flex-1 md:w-48 shrink-0">
                            {!isManual ? (
                              <select
                                value={detail.participantName || ''}
                                onChange={(e) => {
                                  if (e.target.value === 'manual') {
                                    updateParticipant(index, 'isManualName', true);
                                    updateParticipant(index, 'participantName', '');
                                  } else {
                                    updateParticipant(index, 'participantName', e.target.value);
                                    updateParticipant(index, 'isManualName', false);
                                  }
                                }}
                                disabled={isViewMode}
                                className={`w-full box-border border border-gray-300 rounded-xl p-2 text-xs md:text-sm focus:ring-2 focus:ring-green-500 disabled:opacity-100 bg-white ${!detail.participantName ? 'text-gray-500' : 'text-gray-900 font-bold'} truncate`}
                              >
                                <option value="">👤 氏名を選択 (任意)　▼</option>
                                <optgroup label="--- システム登録ユーザー ---">
                                  {systemUsers.map(u => (
                                    <option key={u.id} value={u.displayName || '未設定'}>{u.displayName || '未設定'}</option>
                                  ))}
                                </optgroup>
                                <option value="manual">✏️ 直接手入力する...</option>
                              </select>
                            ) : (
                              <div className="relative w-full">
                                <input
                                  type="text"
                                  placeholder="氏名を手入力 (例: 山田)"
                                  value={detail.participantName || ''}
                                  onChange={(e) => updateParticipant(index, 'participantName', e.target.value)}
                                  disabled={isViewMode}
                                  className="w-full box-border border border-green-400 rounded-xl p-2 pr-8 text-xs md:text-sm focus:ring-2 focus:ring-green-500 bg-green-50 text-gray-900 font-bold"
                                  autoFocus
                                />
                                {!isViewMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateParticipant(index, 'isManualName', false);
                                      updateParticipant(index, 'participantName', '');
                                    }}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-full p-0.5 shadow-sm"
                                    title="リスト選択に戻る"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 w-full md:flex-1 items-center">
                          <select 
                            value={wId || ''} 
                            onChange={(e) => updateParticipant(index, 'wageId', e.target.value)} 
                            disabled={isViewMode} 
                            className={`flex-1 min-w-[6rem] box-border border border-gray-300 rounded-xl p-2 text-xs md:text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100 truncate`}
                          >
                            <option value="">💰 単価を選択</option>
                            <option value="zero">🆓 単価選択なし (0円)</option>
                            {membersList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>

                          <div className={`w-20 md:w-24 flex items-center border border-gray-300 rounded-xl px-2 box-border shrink-0 ${isViewMode || wId === 'zero' ? 'bg-gray-50' : 'bg-white'}`}>
                            <input 
                              type="number" 
                              step="0.5" 
                              min="0" 
                              value={detail.workTime} 
                              onChange={(e) => updateParticipant(index, 'workTime', parseFloat(e.target.value))} 
                              disabled={isViewMode || wId === 'zero'} 
                              className="w-full min-w-0 box-border py-2 text-xs md:text-sm text-center border-none focus:ring-0 disabled:bg-transparent disabled:text-gray-400 disabled:opacity-100" 
                            />
                            <span className="text-[10px] md:text-xs text-gray-400">h</span>
                          </div>

                          <div className="w-16 md:w-20 flex flex-col items-end justify-center leading-tight shrink-0">
                            <span className="text-[9px] md:text-[10px] text-gray-400 whitespace-nowrap">@{memberWage.toLocaleString()}円</span>
                            <span className="text-xs md:text-sm font-bold text-gray-700 whitespace-nowrap">¥{memberTotal.toLocaleString()}</span>
                          </div>
                        </div>

                      </div>

                      <div className="flex flex-wrap md:flex-nowrap gap-3 items-center pl-2 md:pl-3 border-l-2 border-green-200 ml-1">
                        <select value={detail.machineId} onChange={(e) => updateParticipant(index, 'machineId', e.target.value)} disabled={isViewMode} className="w-full md:flex-1 box-border border border-gray-300 rounded-xl p-2 text-xs md:text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100 truncate">
                          <option value="">🚜 使用機械なし</option>
                          {machinesList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>

                        {detail.machineId && (
                          <div className="flex gap-2 items-center justify-end w-full md:w-auto">
                            <div className={`w-20 md:w-24 flex items-center border border-green-200 rounded-xl px-2 box-border shrink-0 ${isViewMode ? 'bg-green-50' : 'bg-green-50'}`}>
                              <input type="number" step="0.5" min="0" value={detail.machineTime} onChange={(e) => updateParticipant(index, 'machineTime', parseFloat(e.target.value))} disabled={isViewMode} className="w-full min-w-0 box-border py-2 text-xs md:text-sm text-center bg-transparent border-none focus:ring-0 font-bold text-green-700 disabled:opacity-100" />
                              <span className="text-[10px] md:text-xs text-green-600">h</span>
                            </div>
                            <div className="w-16 md:w-20 flex flex-col items-end justify-center leading-tight shrink-0">
                              <span className="text-[9px] md:text-[10px] text-green-600/70 whitespace-nowrap">@{machinePrice.toLocaleString()}円</span>
                              <span className="text-xs md:text-sm font-bold text-green-700 whitespace-nowrap">¥{machineTotal.toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>

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
              <h2 className="font-bold text-gray-800 flex items-center"><Package className="w-5 h-5 mr-2 text-green-600" /> 5）使用資材</h2>
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
              {materialDetails.map((detail, index) => {
                const material = materialsList.find(m => m.id === detail.materialId);
                const matPrice = material ? (material.defaultPrice || 0) : 0;
                const matUnit = material ? (material.unit || '個') : '個';
                const matTotal = (detail.quantity || 0) * matPrice;

                return (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 relative group flex flex-col md:flex-row gap-3 md:items-center">
                    {!isViewMode && (
                      <button type="button" onClick={() => removeMaterial(index)} className="absolute -top-2 right-0 md:-right-2 bg-white text-red-500 p-1.5 rounded-full border border-red-100 shadow-sm transition-opacity z-10"><Trash2 size={16} /></button>
                    )}
                    
                    <div className="flex-1 w-full min-w-0 mt-1">
                      <select value={detail.materialId} onChange={(e) => updateMaterial(index, 'materialId', e.target.value)} disabled={isViewMode} className={`w-full min-w-0 box-border border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-white disabled:text-gray-600 disabled:opacity-100`}>
                        <option value="">📦 資材を選択</option>
                        {materialsList.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    
                    <div className="flex gap-2 items-center justify-end w-full md:w-auto ml-auto">
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

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="font-bold text-gray-800 flex items-center border-b pb-2 mb-4"><MessageSquare className="w-5 h-5 mr-2 text-green-600" /> 6）備考・特記事項</h2>
            <textarea name="memo" value={formData.memo} onChange={handleChange} disabled={isViewMode} rows="4" className={inputClass} placeholder="作業の様子や特記事項を入力..."></textarea>
          </div>

          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 flex flex-col space-y-3">
            <div className="flex items-center text-blue-800 font-bold mb-3 text-lg border-b border-blue-200 pb-2">
              <Calculator size={20} className="mr-2" /> 7）予算と費用の目安（合計）
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-blue-200 shadow-sm mb-2">
              <label className="text-sm font-bold text-gray-700">この活動の予算額 (任意)</label>
              <div className="flex items-center w-full sm:w-64">
                <span className="text-gray-500 mr-2 font-bold">¥</span>
                <input 
                  type="number" 
                  name="budget" 
                  value={formData.budget} 
                  onChange={handleChange} 
                  disabled={isViewMode} 
                  className="w-full box-border border border-gray-300 rounded-lg p-2.5 text-right focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-600 font-mono text-lg font-bold" 
                  placeholder="0" 
                  step="1000"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-sm text-gray-700 px-2">
              <span>人件費:</span>
              <span className="font-bold font-mono">¥{totalPersonnelCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-700 px-2">
              <span>機械等利用料:</span>
              <span className="font-bold font-mono">¥{totalMachineCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-gray-700 px-2">
              <span>資材費:</span>
              <span className="font-bold font-mono">¥{totalMaterialCost.toLocaleString()}</span>
            </div>
            <div className="border-t border-blue-200 pt-3 mt-1 flex justify-between items-center text-lg text-blue-900 font-bold px-2">
              <span>実績合計:</span>
              <span className="font-mono text-2xl">¥{totalCost.toLocaleString()}</span>
            </div>

            {formData.budget > 0 && (
              <div className={`flex justify-between items-center text-base font-bold px-4 py-3 rounded-xl mt-2 border ${Number(formData.budget) - totalCost < 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                <span>予算残額:</span>
                <span className="font-mono text-xl">¥{(Number(formData.budget) - totalCost).toLocaleString()}</span>
              </div>
            )}
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

      {/* 🚀 PDF出力（印刷）用の隠しレイアウト */}
      {editData && (() => {
        const printImages = existingUrls;
        const totalImages = printImages.length;
        const groupInfo = groupsList.find(g => g.id === editData.groupId);

        return (
          <div className="hidden print:block w-full text-black bg-white font-serif">
            <h1 className="text-2xl font-bold text-center border-b-4 border-black pb-2 mb-6">活動状況写真台帳</h1>
            <table className="w-full border-2 border-black border-collapse mb-6 text-sm">
              <tbody>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">報告書NO</th><td className="border border-black p-3" colSpan="3">{editData.reportNo || '（未設定）'}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">実施年月日</th><td className="border border-black p-3 w-1/4">{editData.date}</td><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">活動項目番号</th><td className="border border-black p-3 w-1/4">{editData.activityNumbers?.join(', ')}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">実施場所</th><td className="border border-black p-3" colSpan="3">{editData.location}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">活動内容</th><td className="border border-black p-3" colSpan="3">{editData.activityType}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">参加人数</th><td className="border border-black p-3" colSpan="3">計 {editData.participants} 名 （農業者：{editData.participantsAgri}名 ／ 農業者以外：{editData.participantsNonAgri}名）</td></tr>
              </tbody>
            </table>
            <div className="space-y-6">
              {printImages.map((img, idx) => (
                <div key={idx} className="break-inside-avoid"><div className="text-sm font-bold mb-1 text-left">{idx + 1}/{totalImages}枚目</div><div className="border border-gray-400 p-1"><img src={img} alt="" className="w-full h-auto max-h-[140mm] object-contain" /></div></div>
              ))}
            </div>
            <div className="mt-8 flex justify-between items-end border-t border-black pt-4">
              <div className="text-sm">組織名：{ORGANIZATION_NAME || '鎌田緑保護会'}</div>
              <div className="text-sm text-right">出力日：{new Date().toLocaleDateString('ja-JP')}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ActivityForm;