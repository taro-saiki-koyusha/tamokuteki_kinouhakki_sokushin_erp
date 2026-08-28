import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, CheckCircle, Plus, Settings, LogOut, Sprout, Users, UserCog, User, MessageSquare, Trash2, X, MapPin, BarChart2, Activity, Printer, FileSpreadsheet, LayoutList, Layers, AlertTriangle, LayoutGrid, List, ChevronUp, ChevronDown, Link, Wallet, Lock, Map, MoreVertical, Edit, Info, History, Loader2, Ticket, RefreshCw, Database, Download, UploadCloud, Archive, FileX, FileText, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc, updateDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth } from '../firebase';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { ORGANIZATION_NAME } from '../constants';

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

export const Dashboard = () => {
  const navigate = useNavigate();
  const storage = getStorage();
  
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [printActivity, setPrintActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [exportingId, setExportingId] = useState(null);
  
  const [generatingId, setGeneratingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [isBulkDeletingDocs, setIsBulkDeletingDocs] = useState(false);
  
  const [manualUploadActivity, setManualUploadActivity] = useState(null);
  const [uploadingDocType, setUploadingDocType] = useState(null);

  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    current: 0,
    total: 0,
    isComplete: false,
    hasError: false
  });

  const [membersList, setMembersList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [materialsList, setMaterialsList] = useState([]); 
  const [groupsList, setGroupsList] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]); 
  
  const [systemSettings, setSystemSettings] = useState({ 
    fiscalYearStartMonth: 4, 
    paymentDates: [],
    budgetAgriMaintain: 0,
    budgetResourceJoint: 0,
    budgetResourceLongLife: 0
  });

  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('dashboardDisplayMode') || 'group');
  const [viewStyle, setViewStyle] = useState(() => localStorage.getItem('dashboardViewStyle') || 'card');
  const [dateSortOrder, setDateSortOrder] = useState(() => localStorage.getItem('dashboardDateSortOrder') || 'desc');

  const [isTotalsExpanded, setIsTotalsExpanded] = useState(false);
  const [isMyRewardExpanded, setIsMyRewardExpanded] = useState(false);
  const [includeUnimplemented, setIncludeUnimplemented] = useState(false);

  const [selectedActivityIds, setSelectedActivityIds] = useState([]);

  useEffect(() => localStorage.setItem('dashboardDisplayMode', displayMode), [displayMode]);
  useEffect(() => localStorage.setItem('dashboardViewStyle', viewStyle), [viewStyle]);
  useEffect(() => localStorage.setItem('dashboardDateSortOrder', dateSortOrder), [dateSortOrder]);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');
  const [userGroupIds, setUserGroupIds] = useState([]);
  const [canEditOwn, setCanEditOwn] = useState(false);
  const [canEditGroup, setCanEditGroup] = useState(false);
  const [deletingActivityId, setDeletingActivityId] = useState(null);

  const [actionMenuActivity, setActionMenuActivity] = useState(null);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 10000);
    return () => clearTimeout(fallbackTimer);
  }, []);

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
      setGroupsList(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          name: data.name === '農）カマタ' ? '農事組合法人カマタ' : data.name
        };
      }));
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setSystemUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSystemSettings({
          fiscalYearStartMonth: data.fiscalYearStartMonth || 4,
          paymentDates: data.paymentDates || [],
          budgetAgriMaintain: data.budgetAgriMaintain || 0,
          budgetResourceJoint: data.budgetResourceJoint || 0,
          budgetResourceLongLife: data.budgetResourceLongLife || 0
        });
      }
    });

    let unsubscribeData = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const role = userDoc.exists() ? (userDoc.data().role || 'reporter') : 'reporter';
          const groupIds = userDoc.exists() ? (userDoc.data().groupIds || []) : [];
          const allowedEditOwn = userDoc.exists() ? (userDoc.data().canEditOwn || false) : false; 
          const allowedEditGroup = userDoc.exists() ? (userDoc.data().canEditGroup || false) : false;
          
          setUserRole(role);
          setUserGroupIds(groupIds);
          setCanEditOwn(allowedEditOwn); 
          setCanEditGroup(allowedEditGroup); 

          let q;
          if (role === 'admin' || role === 'manager') {
            q = query(collection(db, 'activities'));
          } else {
            if (groupIds.length === 0) {
              setActivities([]);
              setLoading(false);
              return;
            }
            q = query(collection(db, 'activities'), where('groupId', 'in', groupIds));
          }

          unsubscribeData = onSnapshot(q, (querySnapshot) => {
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActivities(data);
            setLoading(false);
          }, (error) => {
            console.error("Firestore onSnapshot Error:", error);
            setLoading(false);
          });

        } catch (error) {
          console.error("User fetch error:", error);
          setLoading(false);
        }
      } else {
        setActivities([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeGroups();
      unsubMembers();
      unsubMachines();
      unsubMaterials();
      unsubUsers();
      unsubSettings(); 
      if (unsubscribeData) unsubscribeData();
    };
  }, []);

  const globalSortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [activities, dateSortOrder]);

  const groupedActivities = useMemo(() => {
    const groups = {};
    globalSortedActivities.forEach(act => {
      const gid = act.groupId || 'unknown';
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(act);
    });
    return groups;
  }, [globalSortedActivities]);

  const toggleSelectActivity = (id, e) => {
    e?.stopPropagation();
    setSelectedActivityIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/'); } catch (error) { console.error(error); }
  };

  const handleDeleteClick = (id, e) => {
    e.stopPropagation(); 
    setDeletingActivityId(id);
    setActionMenuActivity(null); 
  };

  const executeDelete = async () => {
    if (!deletingActivityId) return;
    try {
      const targetAct = activities.find(a => a.id === deletingActivityId);
      await deleteDoc(doc(db, 'activities', deletingActivityId));
      
      if (targetAct) {
        const currentUserName = systemUsers.find(u => u.id === currentUser?.uid)?.name || currentUser?.displayName || '名称未設定';
        await addDoc(collection(db, 'audit_logs'), {
          action: 'DELETE',
          userName: currentUserName,
          userId: currentUser?.uid || 'unknown',
          target: '活動実績',
          details: `活動日: ${targetAct.date} の記録（${targetAct.activityType || '無題'}）を削除しました`,
          createdAt: serverTimestamp()
        });
      }

      setSelectedActivityIds(prev => prev.filter(id => id !== deletingActivityId));
      setDeletingActivityId(null);
    } catch (error) {
      console.error("削除エラー:", error);
      alert('削除に失敗しました。');
    }
  };

  const handleCopyLink = (activity, e) => {
    e?.stopPropagation(); 
    const link = `${window.location.origin}/activity-form/${activity.id}`;
    navigator.clipboard.writeText(link).then(() => {
      alert("この活動の専用リンクをコピーしました！\nメールやLINE等に貼り付けて共有できます。");
    }).catch(err => {
      console.error("コピー失敗:", err);
      alert("リンクのコピーに失敗しました。");
    });
    setActionMenuActivity(null);
  };

  const generateExcelBlob = async (activity) => {
    const response = await fetch(`/様式1_活動報告書_農地維持支払.xlsx?t=${Date.now()}`);
    if (!response.ok) throw new Error('テンプレートが見つかりません');
    const arrayBuffer = await response.arrayBuffer();
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
    const [startH, startM] = activity.startTime.split(':').map(Number);
    const [endH, endM] = activity.endTime.split(':').map(Number);
    let duration = (endH + endM / 60) - (startH + startM / 60);
    if (duration < 0) duration += 24;
    
    const sheet1 = workbook.sheet('活動報告書') || workbook.sheets()[0];
    sheet1.cell('AH3').value(activity.reportNo || ''); 
    sheet1.cell('A7').value(activity.date); 
    sheet1.cell('C7').value(activity.startTime); 
    sheet1.cell('F7').value(activity.endTime);   
    sheet1.cell('I7').value(duration); 
    sheet1.cell('M7').value(Number(activity.participantsAgri || 0)); 
    sheet1.cell('O7').value(Number(activity.participantsNonAgri || 0)); 
    sheet1.cell('Q7').value(Number(activity.participants || 0)); 
    sheet1.cell('S7').value(activity.activityNumbers?.join(', ')); 

    let paymentCategoryNum = '';
    if (activity.paymentCategory) {
      if (activity.paymentCategory.includes('1') || activity.paymentCategory.includes('１')) paymentCategoryNum = 1;
      else if (activity.paymentCategory.includes('2') || activity.paymentCategory.includes('２')) paymentCategoryNum = 2;
      else if (activity.paymentCategory.includes('3') || activity.paymentCategory.includes('３')) paymentCategoryNum = 3;
    }
    sheet1.cell(7, 25).value(paymentCategoryNum);

    sheet1.cell(7, 31).value(activity.activityType || '');          
    sheet1.cell('A8').value(activity.memo || '');
    
    const sheet2 = workbook.sheet('日当借上支払明細') || workbook.sheets()[1];
    sheet2.cell('AJ3').value(activity.date); 
    
    if (activity.participantDetails && activity.participantDetails.length > 0) {
      activity.participantDetails.forEach((detail, index) => {
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
    return await workbook.outputAsync();
  };

  const generatePDFBlob = async (activity) => {
    return new Promise((resolve, reject) => {
      setPrintActivity(activity); 
      
      const imagesToLoad = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
      const loadPromises = imagesToLoad.map(src => {
        return new Promise((res) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => res();
          img.onerror = () => res(); 
          img.src = src;
        });
      });

      Promise.race([
        Promise.all(loadPromises),
        new Promise(res => setTimeout(res, 3000))
      ]).then(() => {
        setTimeout(async () => {
          try {
            const element = document.getElementById(`pdf-report-${activity.id}`);
            if (!element) throw new Error("PDF描画用の要素が見つかりません");
            
            const canvas = await html2canvas(element, { 
              scale: 2, 
              useCORS: true, 
              logging: false,
              windowWidth: 794 
            });
            const imgData = canvas.toDataURL("image/jpeg", 0.9);
            
            const pdfWidth = 210; 
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            const pdf = new jsPDF("p", "mm", [pdfWidth, Math.max(297, pdfHeight)]);
            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
            
            setPrintActivity(null); 
            resolve(pdf.output("blob"));
          } catch (err) {
            setPrintActivity(null);
            reject(err);
          }
        }, 500); 
      });
    });
  };

  const handleGenerateDocuments = async (activity) => {
    setGeneratingId(activity.id);
    setProgressModal({
      isOpen: true,
      title: '提出書類を作成中',
      message: '書類データを生成しています...\n（写真の枚数により数秒かかります）',
      current: 0,
      total: 1,
      isComplete: false,
      hasError: false
    });

    try {
      const fileBaseName = activity.reportNo ? activity.reportNo : activity.id;
      
      const excelBlob = await generateExcelBlob(activity);
      const pdfBlob = await generatePDFBlob(activity);
      
      setProgressModal(prev => ({ ...prev, message: 'サーバへ保存しています...' }));
      await uploadBytes(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`), excelBlob);
      await uploadBytes(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`), pdfBlob);
      
      await updateDoc(doc(db, 'activities', activity.id), {
        isDocumentGenerated: true,
        documentBaseName: fileBaseName
      });

      setProgressModal(prev => ({
        ...prev,
        message: `報告書NO：${fileBaseName}\n提出書類の作成と保存が完了しました。`,
        current: 1,
        isComplete: true
      }));
    } catch (error) {
      console.error(error);
      setProgressModal(prev => ({ ...prev, message: '書類作成中にエラーが発生しました。', isComplete: true, hasError: true }));
    } finally {
      setGeneratingId(null);
    }
  };

  const handleManualUpload = async (activity, file, type) => {
    if (!file) return;
    setUploadingDocType(type);
    try {
      const fileBaseName = activity.documentBaseName || activity.reportNo || activity.id;
      const extension = type === 'excel' ? 'xlsx' : 'pdf';
      const fileRef = ref(storage, `reports/${fileBaseName}/${fileBaseName}.${extension}`);
      
      await uploadBytes(fileRef, file);
      
      await updateDoc(doc(db, 'activities', activity.id), {
        isDocumentGenerated: true,
        documentBaseName: fileBaseName
      });
      
      alert(`手動アップロードが完了しました。(${type === 'excel' ? 'Excel' : 'PDF'})`);
    } catch (error) {
      console.error(error);
      alert('アップロード中にエラーが発生しました。');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleIndividualDelete = async (activity, type) => {
    if (!window.confirm(`この活動の ${type === 'excel' ? 'Excel' : 'PDF'} ファイルのみを削除しますか？`)) return;
    
    setUploadingDocType(type);
    try {
      const fileBaseName = activity.documentBaseName || activity.reportNo || activity.id;
      const extension = type === 'excel' ? 'xlsx' : 'pdf';
      const fileRef = ref(storage, `reports/${fileBaseName}/${fileBaseName}.${extension}`);
      
      await deleteObject(fileRef);
      alert(`削除しました。(${type === 'excel' ? 'Excel' : 'PDF'})`);
    } catch (error) {
      console.error(error);
      alert('ファイルの削除に失敗しました（既に削除されている可能性があります）。');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDownloadDocuments = async (activity) => {
    setDownloadingId(activity.id);
    setProgressModal({
      isOpen: true,
      title: 'ダウンロード準備中',
      message: 'サーバからデータを取得しています...',
      current: 0,
      total: 1,
      isComplete: false,
      hasError: false
    });

    try {
      const fileBaseName = activity.documentBaseName || activity.reportNo || activity.id;
      const zip = new JSZip();
      let hasFile = false;
      
      setProgressModal(prev => ({ ...prev, message: 'ZIPファイルを作成中...' }));
      
      try {
        const excelUrl = await getDownloadURL(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`));
        const excelRes = await fetch(excelUrl);
        zip.file(`活動報告書_${fileBaseName}.xlsx`, await excelRes.blob());
        hasFile = true;
      } catch (e) {}

      try {
        const pdfUrl = await getDownloadURL(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`));
        const pdfRes = await fetch(pdfUrl);
        zip.file(`活動写真台帳_${fileBaseName}.pdf`, await pdfRes.blob());
        hasFile = true;
      } catch (e) {}
      
      if (!hasFile) {
        throw new Error("No files found");
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `提出書類_${fileBaseName}.zip`);

      setProgressModal(prev => ({
        ...prev,
        message: 'ダウンロードを開始しました。',
        current: 1,
        isComplete: true
      }));
    } catch (error) {
      console.error(error);
      setProgressModal(prev => ({ ...prev, message: 'ダウンロードに失敗しました。ファイルが存在しない可能性があります。', isComplete: true, hasError: true }));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteDocuments = async (activity) => {
    if (!window.confirm('サーバに保存されているこの活動の提出書類（PDF/Excel）を【両方とも】一括で削除しますか？\n※活動データ自体は削除されません。')) return;

    setDeletingDocId(activity.id);
    setProgressModal({
      isOpen: true,
      title: '書類データ削除中',
      message: 'サーバからデータを削除しています...',
      current: 0,
      total: 1,
      isComplete: false,
      hasError: false
    });

    try {
      const fileBaseName = activity.documentBaseName || activity.reportNo || activity.id;

      try { await deleteObject(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`)); } catch(e){}
      try { await deleteObject(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`)); } catch(e){}

      await updateDoc(doc(db, 'activities', activity.id), {
        isDocumentGenerated: false,
        documentBaseName: null
      });

      setProgressModal(prev => ({
        ...prev,
        message: '提出書類をサーバから完全に削除しました。',
        current: 1,
        isComplete: true
      }));
    } catch (error) {
      console.error(error);
      setProgressModal(prev => ({ ...prev, message: '書類の削除中にエラーが発生しました。', isComplete: true, hasError: true }));
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleBulkGenerate = async () => {
    const selectedActs = activities.filter(a => selectedActivityIds.includes(a.id));
    if (selectedActs.length === 0) return;
    setIsBulkGenerating(true);
    
    setProgressModal({
      isOpen: true,
      title: '一括書類作成中',
      message: '準備中...',
      current: 0,
      total: selectedActs.length,
      isComplete: false,
      hasError: false
    });

    let successCount = 0;
    
    for (let i = 0; i < selectedActs.length; i++) {
      const act = selectedActs[i];
      try {
        setGeneratingId(act.id);
        const fileBaseName = act.reportNo ? act.reportNo : act.id;
        
        setProgressModal(prev => ({ ...prev, message: `(${i + 1}/${selectedActs.length}) 「${act.activityType}」の書類を作成中...` }));
        const excelBlob = await generateExcelBlob(act);
        const pdfBlob = await generatePDFBlob(act);
        
        setProgressModal(prev => ({ ...prev, message: `(${i + 1}/${selectedActs.length}) 「${act.activityType}」をサーバに保存中...` }));
        await uploadBytes(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`), excelBlob);
        await uploadBytes(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`), pdfBlob);
        
        await updateDoc(doc(db, 'activities', act.id), { 
          isDocumentGenerated: true, 
          documentBaseName: fileBaseName 
        });
        successCount++;
        setProgressModal(prev => ({ ...prev, current: successCount }));
      } catch (e) {
        console.error(`Error generating docs for ${act.id}`, e);
      }
    }
    
    setGeneratingId(null);
    setIsBulkGenerating(false);
    setProgressModal(prev => ({
      ...prev,
      message: `${successCount} 件の活動書類を作成・保存しました。`,
      isComplete: true
    }));
    setSelectedActivityIds([]);
  };

  const handleBulkDownload = async () => {
    const selectedActs = activities.filter(a => selectedActivityIds.includes(a.id) && a.isDocumentGenerated);
    if (selectedActs.length === 0) {
      alert('ダウンロード可能な（作成済みの）書類が選択されていません。');
      return;
    }
    setIsBulkDownloading(true);

    setProgressModal({
      isOpen: true,
      title: '一括ダウンロード準備中',
      message: 'サーバからデータを取得しています...',
      current: 0,
      total: selectedActs.length,
      isComplete: false,
      hasError: false
    });

    try {
      const zip = new JSZip();
      let successCount = 0;

      for (let i = 0; i < selectedActs.length; i++) {
        const act = selectedActs[i];
        const fileBaseName = act.documentBaseName || act.reportNo || act.id;
        let hasFile = false;
        
        try {
          setProgressModal(prev => ({ ...prev, message: `(${i + 1}/${selectedActs.length}) 「${act.activityType}」を取得中...` }));
          const folder = zip.folder(fileBaseName);
          
          try {
            const excelUrl = await getDownloadURL(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`));
            const excelRes = await fetch(excelUrl);
            folder.file(`活動報告書_${fileBaseName}.xlsx`, await excelRes.blob());
            hasFile = true;
          } catch(e){}
          
          try {
            const pdfUrl = await getDownloadURL(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`));
            const pdfRes = await fetch(pdfUrl);
            folder.file(`活動写真台帳_${fileBaseName}.pdf`, await pdfRes.blob());
            hasFile = true;
          } catch(e){}

          if (hasFile) {
            successCount++;
          }
          setProgressModal(prev => ({ ...prev, current: i + 1 }));
        } catch (e) {
          console.error(`Error fetching ${fileBaseName}`, e);
        }
      }

      setProgressModal(prev => ({ ...prev, message: 'ZIPファイルを構築中...' }));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `一括ダウンロード_提出書類_${new Date().toISOString().split('T')[0]}.zip`);

      setProgressModal(prev => ({
        ...prev,
        message: `${successCount} 件の書類をダウンロードしました。`,
        isComplete: true
      }));
    } catch (error) {
      console.error(error);
      setProgressModal(prev => ({ ...prev, message: '一括ダウンロードに失敗しました。', isComplete: true, hasError: true }));
    } finally {
      setIsBulkDownloading(false);
      setSelectedActivityIds([]);
    }
  };

  const handleBulkDeleteDocuments = async () => {
    const selectedActs = activities.filter(a => selectedActivityIds.includes(a.id) && a.isDocumentGenerated);
    if (selectedActs.length === 0) {
      alert('削除可能な（作成済みの）書類が選択されていません。');
      return;
    }

    if (!window.confirm(`選択された ${selectedActs.length} 件の活動の提出書類をサーバから一括削除しますか？\n※活動データ自体は削除されません。`)) return;

    setIsBulkDeletingDocs(true);
    setProgressModal({
      isOpen: true,
      title: '一括書類削除中',
      message: 'サーバから削除しています...',
      current: 0,
      total: selectedActs.length,
      isComplete: false,
      hasError: false
    });

    let successCount = 0;

    for (let i = 0; i < selectedActs.length; i++) {
      const act = selectedActs[i];
      try {
        setProgressModal(prev => ({ ...prev, message: `(${i + 1}/${selectedActs.length}) 「${act.activityType}」の書類を削除中...` }));
        const fileBaseName = act.documentBaseName || act.reportNo || act.id;
        try { await deleteObject(ref(storage, `reports/${fileBaseName}/${fileBaseName}.xlsx`)); } catch(e){}
        try { await deleteObject(ref(storage, `reports/${fileBaseName}/${fileBaseName}.pdf`)); } catch(e){}

        await updateDoc(doc(db, 'activities', act.id), {
          isDocumentGenerated: false,
          documentBaseName: null
        });
        successCount++;
        setProgressModal(prev => ({ ...prev, current: successCount }));
      } catch (e) {
        console.error(`Error deleting docs for ${act.id}`, e);
      }
    }

    setIsBulkDeletingDocs(false);
    setProgressModal(prev => ({
      ...prev,
      message: `${successCount} 件の書類をサーバから削除しました。`,
      isComplete: true
    }));
    setSelectedActivityIds([]);
  };

  // =======================================================================

  const handleExportGroupReport = async (groupName, groupActs) => {
    setExportingId(`group-${groupName}`); 
    try {
      const workbook = await XlsxPopulate.fromBlankAsync();
      const sheet = workbook.sheet(0);
      sheet.name(groupName.substring(0, 31)); 

      const headers = ['日付', '活動内容', '状態', '計画区分', '支払区分', '報告書NO', '予算額', '実績額', '活動場所', '項目番号', '参加人数', '登録者'];
      headers.forEach((header, i) => {
        sheet.cell(1, i + 1).value(header);
        sheet.cell(1, i + 1).style("bold", true);
        sheet.cell(1, i + 1).style("fill", "F3F4F6"); 
      });

      groupActs.forEach((act, index) => {
        const row = index + 2;
        const budget = Number(act.budget) || 0;
        const actualCost = calculateActivityCost(act);
        const creatorName = systemUsers.find(u => u.id === act.createdBy)?.displayName || '-';
        const participants = `計 ${act.participants || 0} 名 (農:${act.participantsAgri || 0} / 非:${act.participantsNonAgri || 0})`;

        sheet.cell(row, 1).value(act.date || '');
        sheet.cell(row, 2).value(act.activityType || '');
        sheet.cell(row, 3).value(act.status || '実績入力済');
        sheet.cell(row, 4).value(act.planType || '当初計画');
        sheet.cell(row, 5).value(act.paymentCategory || '');
        sheet.cell(row, 6).value(act.reportNo || '');
        sheet.cell(row, 7).value(budget);
        sheet.cell(row, 8).value(actualCost);
        sheet.cell(row, 9).value(act.location || '');
        sheet.cell(row, 10).value(act.activityNumbers?.join(', ') || '');
        sheet.cell(row, 11).value(participants);
        sheet.cell(row, 12).value(creatorName);
      });

      sheet.column("A").width(12);
      sheet.column("B").width(30);
      sheet.column("E").width(25);
      sheet.column("I").width(20);

      const blob = await workbook.outputAsync();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `活動一覧_${groupName}_${today}.xlsx`; 
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) { 
      console.error(error); 
      alert('Excel作成エラーが発生しました。'); 
    } finally { 
      setExportingId(null); 
    }
  };

  const calculateActivityCost = (act) => {
    let pCost = 0; let mCost = 0; let matCost = 0;
    (act.participantDetails || []).forEach(detail => {
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
    (act.materialDetails || []).forEach(detail => {
      if (detail.materialId) {
        const mat = materialsList.find(m => m.id === detail.materialId);
        if (mat) matCost += (detail.quantity || 0) * (mat.defaultPrice || 0);
      }
    });
    return pCost + mCost + matCost;
  };

  const paymentCategoryTotals = useMemo(() => {
    const totals = {
      agriMaintain: { name: '１ 農地維持支払', budget: systemSettings.budgetAgriMaintain || 0, planned: 0, actual: 0 },
      resourceJoint: { name: '２ 資源向上支払（共同）', budget: systemSettings.budgetResourceJoint || 0, planned: 0, actual: 0 },
      resourceLongLife: { name: '３ 資源向上支払（長寿命化）', budget: systemSettings.budgetResourceLongLife || 0, planned: 0, actual: 0 },
      unassigned: { name: '未設定 / その他', budget: 0, planned: 0, actual: 0 }
    };

    activities.forEach(act => {
      const statusLabel = act.status || '実績入力済';
      const category = act.paymentCategory || '';
      const actBudget = Number(act.budget) || 0; 

      let targetKey = 'unassigned';
      if (category.includes('1') || category.includes('１')) targetKey = 'agriMaintain';
      else if (category.includes('2') || category.includes('２')) targetKey = 'resourceJoint';
      else if (category.includes('3') || category.includes('３')) targetKey = 'resourceLongLife';

      totals[targetKey].planned += actBudget;

      if (statusLabel !== '未実施') {
        totals[targetKey].actual += calculateActivityCost(act);
      }
    });

    return Object.values(totals);
  }, [activities, systemSettings, membersList, machinesList, materialsList]);

  const handleOpenMap = () => {
    const mapImageUrl = "/kamata_noudou.jpg"; 
    window.open(mapImageUrl, '_blank');
  };

  const roleLabel = userRole === 'admin' ? '管理者' : userRole === 'manager' ? '事務・役員' : '現場リーダー';

  const displayUserName = systemUsers.find(u => u.id === currentUser?.uid)?.name || 
                          systemUsers.find(u => u.id === currentUser?.uid)?.displayName || 
                          currentUser?.displayName || 
                          'ユーザー';

  const myRewards = useMemo(() => {
    let totalReward = 0;
    let totalHours = 0;
    const details = [];

    if (!displayUserName) return { totalReward, totalHours, details };

    const normalizeName = (name) => (name || '').replace(/[\s ]/g, '');
    const normalizedDisplayUserName = normalizeName(displayUserName);

    activities.forEach(act => {
      if (!includeUnimplemented && act.status === '未実施') return;

      (act.participantDetails || []).forEach(p => {
        const wId = p.wageId || p.memberId;
        const wage = membersList.find(m => m.id === wId);
        const pName = p.participantName || wage?.name;
        
        if (normalizeName(pName) === normalizedDisplayUserName && normalizedDisplayUserName !== '') {
          const hours = p.workTime || 0;
          const price = wage?.defaultWage || 0;
          const reward = hours * price;
          
          totalHours += hours;
          totalReward += reward;
          
          if (hours > 0 || reward > 0) {
            details.push({
              id: act.id,
              date: act.date,
              activityType: act.activityType,
              hours: hours,
              reward: reward,
              originalAct: act 
            });
          }
        }
      });
    });
    
    details.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { totalReward, totalHours, details };
  }, [activities, membersList, displayUserName, includeUnimplemented]);

  const getPermissions = (activity) => {
    const isCreator = activity.createdBy === currentUser?.uid;
    const isInSameGroup = userGroupIds.includes(activity.groupId);
    const canDeleteAct = userRole === 'admin' || userRole === 'manager' ||
                         (!activity.isLocked && userRole === 'reporter' && canEditOwn && isCreator) ||
                         (!activity.isLocked && userRole === 'reporter' && canEditGroup && isInSameGroup);
    return { canDeleteAct };
  };

  const ActivityCard = ({ activity }) => {
    const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
    const { canDeleteAct } = getPermissions(activity);
    const groupInfo = groupsList.find(g => g.id === activity.groupId);
    
    const statusLabel = activity.status || '実績入力済';
    const planTypeLabel = activity.planType || '当初計画'; 
    
    const budget = Number(activity.budget) || 0;
    const actualCost = calculateActivityCost(activity);
    const isChecked = selectedActivityIds.includes(activity.id);

    return (
      <div onClick={() => navigate(`/activity-form/${activity.id}`, { state: { editData: activity, isViewMode: true } })} className={`bg-white rounded-2xl shadow-sm border-l-4 border-green-500 p-4 cursor-pointer hover:shadow-md transition-all flex flex-col h-full relative group ${isChecked ? 'ring-2 ring-green-600 bg-green-50/20' : ''}`}>
        
        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="pt-0.5 pl-1" onClick={e => e.stopPropagation()}>
            <input 
              type="checkbox" 
              checked={isChecked} 
              onChange={(e) => toggleSelectActivity(activity.id, e)} 
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer shadow-sm" 
            />
          </div>

          <div className="flex items-center space-x-1.5 ml-auto">
            <button onClick={(e) => handleCopyLink(activity, e)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="リンクをコピー">
              <Link size={15} />
            </button>

            {canDeleteAct && (
              <button onClick={(e) => handleDeleteClick(activity.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="この実績を削除">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2 pl-6">
          <span className={`text-[10px] px-2 py-1 rounded-md font-bold border whitespace-nowrap ${
            planTypeLabel === '当初計画' ? 'bg-blue-50 text-blue-600 border-blue-100' :
            planTypeLabel === '期中追加' ? 'bg-orange-50 text-orange-600 border-orange-100' :
            'bg-red-50 text-red-600 border-red-100'
          }`}>
            {planTypeLabel}
          </span>
          <span className={`text-[10px] px-2 py-1 rounded-md font-bold border whitespace-nowrap ${statusLabel === '未実施' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
            {statusLabel}
          </span>

          {activity.isLocked && (
            <span className="text-[10px] px-2 py-1 rounded-md font-bold border border-gray-500 bg-gray-600 text-white whitespace-nowrap flex items-center shadow-sm">
              <Lock size={10} className="mr-1" /> 提出済
            </span>
          )}
        </div>
        
        <div className="flex flex-col items-start space-y-1 pl-6 mb-3">
          <h3 className="font-bold text-lg text-gray-900 leading-tight">{activity.activityType || '内容未入力'}</h3>
          {activity.isEssential && (
            <span className="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded font-bold">必須作業</span>
          )}
        </div>
        
        <div className="space-y-1.5 text-xs text-gray-600 mb-3 flex-grow">
          <div className="flex flex-wrap items-center gap-1">
            {groupInfo ? (
              <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md font-bold">{groupInfo.name}</span>
            ) : (
              <span className="bg-red-50 text-red-500 text-[10px] px-2 py-1 rounded-md font-bold border border-red-100">未登録</span>
            )}
            
            {activity.paymentCategory && (
              <span className="bg-teal-50 text-teal-700 text-[9px] px-2 py-1 rounded-md font-bold border border-teal-100 truncate max-w-[120px]">
                {activity.paymentCategory}
              </span>
            )}
          </div>
          {activity.reportNo && <div className="flex items-center text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-max mb-1 mt-1.5">NO: {activity.reportNo}</div>}
          <div className="flex items-center mt-1"><Calendar className="mr-2 h-4 w-4 shrink-0" />{activity.date}</div>
          {(activity.startTime || activity.endTime) && (
            <div className="flex items-center"><Clock className="mr-2 h-4 w-4 shrink-0" />{activity.startTime || '--:--'} 〜 {activity.endTime || '--:--'}</div>
          )}
          <div className="flex items-center"><MapPin className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{activity.location}</span></div>
        </div>

        {(budget > 0 || actualCost > 0) && (
          <div className="flex justify-between items-center mb-3 pt-2 border-t border-gray-100 border-dashed">
            <div className="text-[10px] text-gray-500">
              予算: <span className="font-bold text-gray-700">¥{budget.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-gray-500">
              実績: <span className="font-bold text-blue-600">¥{actualCost.toLocaleString()}</span>
            </div>
          </div>
        )}

        {images.length > 0 && (
          <div className="relative rounded-lg overflow-hidden h-32 bg-gray-50 border border-gray-100 mb-3">
            <img src={images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
          {userRole === 'admin' && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleGenerateDocuments(activity); }} 
              disabled={generatingId === activity.id} 
              className={`flex-1 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${generatingId === activity.id ? 'bg-green-400 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
            >
              {generatingId === activity.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileSpreadsheet size={14} className="mr-1" />}
              {generatingId === activity.id ? '作成中...' : '自動作成'}
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); handleDownloadDocuments(activity); }} 
            disabled={!activity.isDocumentGenerated || downloadingId === activity.id} 
            className={`flex-1 border py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${!activity.isDocumentGenerated ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
          >
            {downloadingId === activity.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Archive size={14} className="mr-1" />}
            {downloadingId === activity.id ? 'DL中...' : 'DL'}
          </button>
          {userRole === 'admin' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setManualUploadActivity(activity); }} 
              className={`flex-1 border py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100`}
            >
              <UploadCloud size={14} className="mr-1" /> 手動
            </button>
          )}
          {userRole === 'admin' && activity.isDocumentGenerated && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteDocuments(activity); }} 
              disabled={deletingDocId === activity.id} 
              className={`w-10 border py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${deletingDocId === activity.id ? 'bg-orange-100 text-orange-400 border-orange-200 cursor-not-allowed' : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'}`}
              title="書類削除"
            >
              {deletingDocId === activity.id ? <Loader2 size={14} className="animate-spin" /> : <FileX size={14} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const ActivityTableRow = ({ act }) => {
    const groupInfo = groupsList.find(g => g.id === act.groupId);
    const { canDeleteAct } = getPermissions(act);
    const hasImage = (act.imageUrls && act.imageUrls.length > 0) || act.imageUrl;
    
    const statusLabel = act.status || '実績入力済';
    const planTypeLabel = act.planType || '当初計画';
    const creatorName = systemUsers.find(u => u.id === act.createdBy)?.displayName || '-';

    const budget = Number(act.budget) || 0;
    const actualCost = calculateActivityCost(act);
    const isChecked = selectedActivityIds.includes(act.id);

    const baseBgClass = isChecked ? 'bg-[#ebf7ee]' : 'bg-white';
    const hoverBgClass = isChecked ? '' : (act.isLocked ? 'group-hover/row:bg-gray-50' : 'group-hover/row:bg-green-50');

    return (
      <tr 
        onClick={() => navigate(`/activity-form/${act.id}`, { state: { editData: act, isViewMode: true } })}
        className={`border-b border-gray-100 cursor-pointer transition-colors group/row active:bg-gray-200 ${isChecked ? 'bg-[#ebf7ee] font-medium' : (act.isLocked ? 'bg-white hover:bg-gray-50' : 'bg-white hover:bg-green-50')}`}
      >
        <td className={`p-3 text-center whitespace-nowrap sticky left-0 z-10 border-r border-gray-100 ${baseBgClass} ${hoverBgClass}`} onClick={e => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isChecked} 
            onChange={(e) => toggleSelectActivity(act.id, e)} 
            className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" 
          />
        </td>
        <td className={`p-3 text-sm text-gray-700 whitespace-nowrap sticky left-12 z-10 border-r border-gray-100 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)] ${baseBgClass} ${hoverBgClass}`}>{act.date}</td>
        
        <td className="p-3 text-sm font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{act.activityType}</td>
        
        <td className="p-3 text-xs text-center text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">{creatorName}</td>

        <td className="p-3 text-center whitespace-nowrap">
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2 py-1 rounded-full text-[9px] font-bold border whitespace-nowrap ${statusLabel === '未実施' ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-green-50 text-green-600 border-green-100'}`}>
              {statusLabel}
            </span>
            {act.isLocked && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-600 text-white flex items-center whitespace-nowrap shadow-sm border border-gray-500 shrink-0" title="提出済みのためロックされています">
                <Lock size={8} className="mr-1" /> 提出済
              </span>
            )}
          </div>
        </td>

        <td className="p-3 text-center whitespace-nowrap">
          <div className="flex flex-col items-center space-y-1">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap ${
              planTypeLabel === '当初計画' ? 'bg-blue-50 text-blue-600 border-blue-100' :
              planTypeLabel === '期中追加' ? 'bg-orange-50 text-orange-600 border-orange-100' :
              'bg-red-50 text-red-600 border-red-100'
            }`}>
              {planTypeLabel}
            </span>
            {act.isEssential && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-yellow-50 text-yellow-700 border-yellow-200">
                必須作業
              </span>
            )}
          </div>
        </td>

        <td className="p-3 text-[10px] text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis font-bold">
          {act.paymentCategory || '-'}
        </td>

        <td className="p-3 text-sm font-bold text-blue-600 whitespace-nowrap">{act.reportNo || '-'}</td>
        
        <td className="p-3 text-sm font-bold text-gray-700 whitespace-nowrap text-right">
          {budget > 0 ? `¥${budget.toLocaleString()}` : '-'}
        </td>
        <td className={`p-3 text-sm font-bold whitespace-nowrap text-right ${actualCost > budget && budget > 0 ? 'text-red-600' : 'text-blue-700'}`}>
          {actualCost > 0 ? `¥${actualCost.toLocaleString()}` : '-'}
        </td>

        <td className="p-3 text-xs whitespace-nowrap overflow-hidden text-ellipsis">{groupInfo ? groupInfo.name : <span className="text-red-500">未登録</span>}</td>
        <td className="p-3 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">{act.location}</td>
        <td className="p-3 text-xs font-bold text-green-600 whitespace-nowrap">{act.activityNumbers?.join(', ')}</td>
        
        <td className="p-3 text-center whitespace-nowrap">
          {hasImage ? <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold">あり</span> : <span className="text-gray-300 text-[10px]">-</span>}
        </td>

        <td className={`w-0 px-2 py-2 text-center whitespace-nowrap sticky right-0 bg-white transition-colors shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10 border-l border-gray-100 hidden md:table-cell ${act.isLocked ? 'group-hover/row:bg-gray-50/80' : 'group-hover/row:bg-green-50'}`} onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5 justify-center items-center w-max mx-auto">
            <button onClick={(e) => handleCopyLink(act, e)} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="リンクをコピー">
              <Link size={14} />
            </button>

            {userRole === 'admin' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleGenerateDocuments(act); }} 
                disabled={generatingId === act.id} 
                className={`px-2 py-1.5 rounded-lg font-bold text-[9px] flex items-center transition-colors ${generatingId === act.id ? 'bg-green-400 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`} 
                title="提出書類を自動作成・保存"
              >
                {generatingId === act.id ? <Loader2 size={12} className="mr-1 animate-spin" /> : <FileSpreadsheet size={12} className="mr-1" />}
                作成
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownloadDocuments(act); }} 
              disabled={!act.isDocumentGenerated || downloadingId === act.id} 
              className={`px-2 py-1.5 border rounded-lg font-bold text-[9px] flex items-center transition-colors ${!act.isDocumentGenerated ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'}`} 
              title={act.isDocumentGenerated ? "提出書類DL(ZIP)" : "書類未作成"}
            >
              {downloadingId === act.id ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Archive size={12} className="mr-1" />}
              DL
            </button>

            {userRole === 'admin' && (
              <button 
                onClick={(e) => { e.stopPropagation(); setManualUploadActivity(act); }} 
                className={`px-2 py-1.5 border rounded-lg font-bold text-[9px] flex items-center transition-colors bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50`} 
                title="手動で書類を登録・個別削除"
              >
                <UploadCloud size={12} className="mr-1" />
                手動
              </button>
            )}
            
            {userRole === 'admin' && act.isDocumentGenerated && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleDeleteDocuments(act); }} 
                disabled={deletingDocId === act.id} 
                className={`px-2 py-1.5 border rounded-lg font-bold text-[9px] flex items-center transition-colors ${deletingDocId === act.id ? 'bg-orange-50 text-orange-400 border-orange-200' : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'}`} 
                title="提出書類を一括削除"
              >
                {deletingDocId === act.id ? <Loader2 size={12} className="mr-1 animate-spin" /> : <FileX size={12} className="mr-1" />}
                削除
              </button>
            )}

            {canDeleteAct && (
              <button onClick={(e) => handleDeleteClick(act.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="活動記録の削除">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
        <td className="w-0 px-2 py-2 text-center whitespace-nowrap sticky right-0 bg-white md:hidden border-l border-gray-100" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={(e) => { e.stopPropagation(); setActionMenuActivity(act); }} 
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        </td>
      </tr>
    );
  };

  const ActivityTable = ({ activitiesToRender }) => {
    const toggleDateSort = () => {
      setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    const tableActivityIds = useMemo(() => activitiesToRender.map(a => a.id), [activitiesToRender]);
    const isAllTableSelected = tableActivityIds.length > 0 && tableActivityIds.every(id => selectedActivityIds.includes(id));

    const handleSelectAll = (e) => {
      if (e.target.checked) {
        setSelectedActivityIds(prev => [...new Set([...prev, ...tableActivityIds])]);
      } else {
        setSelectedActivityIds(prev => prev.filter(id => !tableActivityIds.includes(id)));
      }
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="md:hidden bg-blue-50/80 px-3 py-2 text-[10px] text-blue-600 flex items-center font-bold border-b border-blue-100">
            <Info className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            <span>各行の右端の<span className="bg-blue-100 px-1 rounded mx-0.5 font-black">︙</span>を押すとメニューが表示されます</span>
          </div>
        )}

        <div className="overflow-x-auto relative custom-scrollbar pb-2">
          <table className="w-full text-left border-collapse min-w-[1450px] table-fixed select-none">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                <th className="p-3 w-12 text-center whitespace-nowrap sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                  <input 
                    type="checkbox" 
                    checked={isAllTableSelected} 
                    onChange={handleSelectAll} 
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" 
                  />
                </th>
                <th onClick={toggleDateSort} className="p-3 font-bold w-32 cursor-pointer hover:bg-gray-200 transition-colors group whitespace-nowrap sticky left-12 z-20 bg-gray-50 border-r border-gray-200 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.05)]" title="日付で並び替え">
                  <div className="flex items-center text-blue-700">
                    日付
                    {dateSortOrder === 'desc' ? <ChevronDown size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" /> : <ChevronUp size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" />}
                  </div>
                </th>
                
                <th className="p-3 font-bold w-full whitespace-nowrap">活動内容</th>
                
                <th className="p-3 font-bold w-24 text-center whitespace-nowrap">登録者</th>

                <th className="p-3 font-bold w-20 text-center whitespace-nowrap">状態</th>
                <th className="p-3 font-bold w-24 text-center whitespace-nowrap">区分</th>
                <th className="p-3 font-bold w-32 whitespace-nowrap">支払区分</th>
                <th className="p-3 font-bold w-24 whitespace-nowrap">報告書NO</th>
                <th className="p-3 font-bold w-28 text-right whitespace-nowrap">予算額</th>
                <th className="p-3 font-bold w-28 text-right whitespace-nowrap">実績額</th>
                <th className="p-3 font-bold w-36 whitespace-nowrap">グループ</th>
                <th className="p-3 font-bold w-40 whitespace-nowrap">活動場所</th>
                <th className="p-3 font-bold w-20 whitespace-nowrap">項目番号</th>
                
                <th className="p-3 font-bold w-12 text-center whitespace-nowrap">写真</th>
                
                <th className="w-0 px-3 py-3 font-bold text-center whitespace-nowrap sticky right-0 bg-gray-100 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10 border-l border-gray-200 hidden md:table-cell">
                  操作
                </th>
                <th className="w-0 px-3 py-3 font-bold text-center whitespace-nowrap sticky right-0 bg-gray-100 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10 border-l border-gray-200 md:hidden">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {activitiesToRender.map(act => (
                <ActivityTableRow key={act.id} act={act} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-28 md:pb-16 relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 8px;
          border: 3px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      <header className="bg-white shadow-sm px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center sticky top-0 z-30 no-print">
        <div className="flex items-center w-full md:w-auto mb-3 md:mb-0">
          <Sprout className="w-8 h-8 mr-2 text-green-600 shrink-0" />
          <h1 className="text-lg font-bold text-gray-800 whitespace-nowrap">多面システム（鎌田）</h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <button onClick={() => setActiveTab('home')} className={`flex items-center font-bold py-2 border-b-2 transition-colors ${activeTab === 'home' ? 'text-green-600 border-green-600' : 'text-gray-500 border-transparent hover:text-green-600'}`}>
            <Calendar size={18} className="mr-1.5"/> 活動一覧
          </button>
          
          {(userRole === 'admin' || userRole === 'manager') && (
            <>
              <button onClick={() => navigate('/applications')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600">
                <FileCheck size={18} className="mr-1"/> 作業明細管理
              </button>

              <button onClick={() => navigate('/groups')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600">
                <Users size={18} className="mr-1"/> グループ管理
              </button>
              <button onClick={() => navigate('/costs')} className="flex items-center text-sm font-bold text-gray-500 hover:text-green-600">
                <Wallet size={18} className="mr-1"/> 作業費管理
              </button>
            </>
          )}

          {userRole === 'admin' && (
            <>
              <button onClick={() => navigate('/users')} className="flex items-center text-sm font-bold text-gray-500 hover:text-purple-600">
                <UserCog size={18} className="mr-1"/> ユーザー管理
              </button>
              <button onClick={() => navigate('/masters')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600">
                <Settings size={18} className="mr-1"/> マスタ管理
              </button>
              <button onClick={() => navigate('/ticket-management')} className="flex items-center text-sm font-bold text-gray-500 hover:text-indigo-600">
                <Ticket size={18} className="mr-1"/> チケット管理
              </button>
              <button onClick={() => navigate('/backup')} className="flex items-center text-sm font-bold text-gray-500 hover:text-red-600">
                <Database size={18} className="mr-1"/> Backup
              </button>
              <button onClick={() => navigate('/audit-logs')} className="flex items-center text-sm font-bold text-gray-500 hover:text-orange-600">
                <History size={18} className="mr-1"/> 操作履歴
              </button>
            </>
          )}

          <button onClick={() => navigate('/profile')} className="flex items-center text-sm font-bold text-gray-500 hover:text-green-600">
            <User size={18} className="mr-1"/> アカウント設定
          </button>

          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <button onClick={handleLogout} className="flex items-center text-sm font-bold text-gray-500 hover:text-red-600">
            <LogOut size={18} className="mr-1"/> ログアウト
          </button>
        </div>

        <div className="md:hidden flex items-center w-full overflow-x-auto space-x-3 pb-1">
           {(userRole === 'admin' || userRole === 'manager') && (
            <>
              <button onClick={() => navigate('/applications')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors" title="作業明細管理"><FileCheck size={20} /></button>

              <button onClick={() => navigate('/groups')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Users size={20} /></button>
              <button onClick={() => navigate('/costs')} className="p-2 text-gray-500 hover:text-green-600 transition-colors"><Wallet size={20} /></button>
            </>
          )}

          {userRole === 'admin' && (
            <>
              <button onClick={() => navigate('/users')} className="p-2 text-gray-500 hover:text-purple-600 transition-colors"><UserCog size={20} /></button>
              <button onClick={() => navigate('/masters')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Settings size={20} /></button>
              <button onClick={() => navigate('/ticket-management')} className="p-2 text-gray-500 hover:text-indigo-600 transition-colors" title="チケット管理"><Ticket size={20} /></button>
              <button onClick={() => navigate('/backup')} className="p-2 text-gray-500 hover:text-red-600 transition-colors" title="Backup"><Database size={20} /></button>
              <button onClick={() => navigate('/audit-logs')} className="p-2 text-gray-500 hover:text-orange-600 transition-colors" title="操作履歴"><History size={20} /></button>
            </>
          )}
          
          <button onClick={() => navigate('/profile')} className="p-2 text-gray-500 hover:text-green-600 transition-colors">
            <User size={20} />
          </button>

          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto no-print">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-gray-600 text-sm">こんにちは、</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center">
              {displayUserName} さん
              <span className="ml-2 text-[10px] bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-bold">権限: {roleLabel}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => window.location.reload()} className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all" title="最新の情報に更新">
              <RefreshCw size={16} className="mr-1.5 text-gray-500" /> 更新
            </button>
            
            <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
              <button onClick={() => setViewStyle('card')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStyle === 'card' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <LayoutGrid size={14} className="mr-1.5" /> 特大
              </button>
              <button onClick={() => setViewStyle('table')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStyle === 'table' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <List size={14} className="mr-1.5" /> 詳細
              </button>
            </div>

            {(userRole === 'admin' || userRole === 'manager') && (
              <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
                <button onClick={() => setDisplayMode('list')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${displayMode === 'list' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <LayoutList size={14} className="mr-1.5" /> 日付順
                </button>
                <button onClick={() => setDisplayMode('group')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${displayMode === 'group' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Layers size={14} className="mr-1.5" /> グループ別
                </button>
              </div>
            )}

            <button onClick={handleOpenMap} className="flex items-center bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-900 active:scale-95 transition-all">
              <Map size={18} className="mr-1.5" /> エリアマップ
            </button>
            
            <button onClick={() => navigate('/bulk-activity')} className="flex items-center bg-blue-100 text-blue-700 border border-blue-200 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-200 active:scale-95 transition-all">
              <LayoutList size={18} className="mr-1.5" /> 一括登録
            </button>

            <button onClick={() => navigate('/activity-form')} className="flex items-center bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-green-700 active:scale-95 transition-all">
              <Plus size={18} className="mr-1.5" /> 新規報告
            </button>
          </div>
        </div>

        {activities.length > 0 && (
          <div className="mb-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <button 
                onClick={() => setIsMyRewardExpanded(!isMyRewardExpanded)}
                className="flex-1 flex items-center cursor-pointer hover:opacity-70 transition-opacity text-left"
              >
                <h3 className="font-extrabold text-gray-800 text-base flex items-center">
                  <User size={18} className="text-purple-600 mr-2" />
                  あなたの作業実績・報酬額 <span className="hidden sm:inline ml-1">{includeUnimplemented ? '' : '(作業完了分)'}</span>
                </h3>
              </button>
              <div className="flex items-center gap-3">
                <label className="flex items-center text-xs font-bold text-gray-600 cursor-pointer bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={includeUnimplemented}
                    onChange={(e) => setIncludeUnimplemented(e.target.checked)}
                    className="mr-1.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  未実施を含む
                </label>
                <button 
                  onClick={() => setIsMyRewardExpanded(!isMyRewardExpanded)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                >
                  {isMyRewardExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
            </div>
            
            {isMyRewardExpanded && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex-1 flex justify-between items-center shadow-sm">
                    <span className="text-sm font-bold text-purple-900">累計作業時間</span>
                    <span className="text-2xl font-mono font-black text-purple-700">{myRewards.totalHours} h</span>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex-1 flex justify-between items-center shadow-sm">
                    <span className="text-sm font-bold text-blue-900">累計報酬額</span>
                    <span className="text-2xl font-mono font-black text-blue-700">¥{myRewards.totalReward.toLocaleString()}</span>
                  </div>
                </div>
                {myRewards.details.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl bg-white shadow-inner">
                    <table className="w-full text-left text-sm select-none">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                        <tr>
                          <th className="p-2.5 font-bold text-gray-600 whitespace-nowrap">日付</th>
                          <th className="p-2.5 font-bold text-gray-600 w-full">活動内容</th>
                          <th className="p-2.5 font-bold text-gray-600 text-right whitespace-nowrap">時間</th>
                          <th className="p-2.5 font-bold text-gray-600 text-right whitespace-nowrap">報酬額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myRewards.details.map((item, i) => (
                          <tr 
                            key={`${item.id}-${i}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/activity-form/${item.id}`, { state: { editData: item.originalAct, isViewMode: true } });
                            }}
                            className="border-b border-gray-100 hover:bg-green-50 active:bg-green-100 transition-colors cursor-pointer"
                          >
                            <td className="p-2.5 whitespace-nowrap text-gray-600">{item.date}</td>
                            <td className="p-2.5 font-bold text-gray-800">{item.activityType}</td>
                            <td className="p-2.5 text-right font-mono text-gray-600">{item.hours}h</td>
                            <td className="p-2.5 text-right font-mono font-bold text-blue-600">¥{item.reward.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl border border-gray-200">作業実績はありません</p>
                )}
              </div>
            )}
          </div>
        )}

        {activities.length > 0 && (
          <div className="mb-8 bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in duration-300">
            <button 
              onClick={() => setIsTotalsExpanded(!isTotalsExpanded)}
              className="w-full flex items-center justify-between border-b border-gray-100 pb-2 cursor-pointer hover:opacity-70 transition-opacity"
            >
              <h3 className="font-extrabold text-gray-800 text-base flex items-center">
                <BarChart2 size={18} className="text-blue-600 mr-2" />
                支払区分別の集計状況
              </h3>
              {isTotalsExpanded ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
            </button>
            
            {isTotalsExpanded && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 animate-in slide-in-from-top-2 duration-200">
                {paymentCategoryTotals.map((cat, idx) => {
                  const isOverBudget = cat.actual > cat.budget && cat.budget > 0;
                  const remaining = cat.budget - cat.actual;
                  if (cat.budget === 0 && cat.actual === 0 && cat.planned === 0 && cat.name.includes('未設定')) return null;

                  return (
                    <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-black text-gray-600 truncate mb-2" title={cat.name}>
                          {cat.name}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>予算枠額:</span>
                            <span className="font-bold font-mono">¥{cat.budget.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>活動予算 (計画値):</span>
                            <span className="font-bold font-mono text-purple-600">¥{cat.planned.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-500">
                            <span>消化実績:</span>
                            <span className={`font-black font-mono ${isOverBudget ? 'text-red-600' : 'text-blue-700'}`}>
                              ¥{cat.actual.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {cat.budget > 0 && (
                        <div className={`mt-3 pt-2 border-t border-gray-200 border-dashed flex justify-between text-xs font-bold ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          <span>予算枠残額:</span>
                          <span className="font-mono">¥{remaining.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 font-bold">
            表示できる実績がありません
          </div>
        ) : (
          <>
            {displayMode === 'list' && (
              <div className="animate-in fade-in duration-500">
                {viewStyle === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {globalSortedActivities.map(act => <ActivityCard key={act.id} activity={act} />)}
                  </div>
                ) : (
                  <ActivityTable activitiesToRender={globalSortedActivities} />
                )}
              </div>
            )}

            {displayMode === 'group' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {groupsList.map(group => {
                  const acts = groupedActivities[group.id] || [];
                  if (acts.length === 0) return null;

                  const groupTotalBudget = acts.reduce((sum, act) => sum + (Number(act.budget) || 0), 0);
                  const groupTotalActual = acts.reduce((sum, act) => sum + calculateActivityCost(act), 0);
                  const balance = groupTotalBudget - groupTotalActual;

                  return (
                    <div key={group.id} className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-gray-300 pb-3">
                        <div className="flex items-center flex-wrap gap-y-2">
                          <div className="flex items-center">
                            <div className="h-6 w-1.5 bg-blue-600 rounded-full mr-3"></div>
                            <h3 className="text-xl font-extrabold text-gray-800">{group.name}</h3>
                            <span className="ml-3 bg-blue-50 text-blue-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
                              {acts.length} 件の記録
                            </span>
                          </div>
                          {(userRole === 'admin' || userRole === 'manager') && acts.length > 0 && (
                            <button 
                              onClick={() => handleExportGroupReport(group.name, acts)}
                              disabled={exportingId === `group-${group.name}`}
                              className="ml-3 flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                            >
                              {exportingId === `group-${group.name}` ? (
                                <Loader2 size={14} className="mr-1.5 text-blue-600 animate-spin" />
                              ) : (
                                <FileSpreadsheet size={14} className="mr-1.5 text-green-600" />
                              )}
                              一覧をExcel出力
                            </button>
                          )}
                        </div>
                        
                        {(groupTotalBudget > 0 || groupTotalActual > 0) && (
                          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm w-max self-start sm:self-auto">
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">予算合計</div>
                              <div className="text-sm font-bold text-gray-800">¥{groupTotalBudget.toLocaleString()}</div>
                            </div>
                            <div className="text-gray-300 font-light">|</div>
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">実績合計</div>
                              <div className="text-sm font-bold text-blue-600">¥{groupTotalActual.toLocaleString()}</div>
                            </div>
                            <div className="text-gray-300 font-light">|</div>
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">予算残額</div>
                              <div className={`text-base font-extrabold ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ¥{balance.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {viewStyle === 'card' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {acts.map(act => <ActivityCard key={act.id} activity={act} />)}
                        </div>
                      ) : (
                        <ActivityTable activitiesToRender={acts} />
                      )}
                    </div>
                  );
                })}

                {(() => {
                  const unregisteredActs = Object.keys(groupedActivities)
                    .filter(gid => !groupsList.some(g => g.id === gid))
                    .flatMap(gid => groupedActivities[gid])
                    .sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      return dateSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                    });

                  if (unregisteredActs.length === 0) return null;

                  const groupTotalBudget = unregisteredActs.reduce((sum, act) => sum + (Number(act.budget) || 0), 0);
                  const groupTotalActual = unregisteredActs.reduce((sum, act) => sum + calculateActivityCost(act), 0);
                  const balance = groupTotalBudget - groupTotalActual;

                  return (
                    <div key="unregistered" className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-gray-300 pb-3">
                        <div className="flex items-center flex-wrap gap-y-2">
                          <div className="flex items-center">
                            <div className="h-6 w-1.5 bg-gray-400 rounded-full mr-3"></div>
                            <h3 className="text-xl font-extrabold text-gray-500">グループ未登録・不明</h3>
                            <span className="ml-3 bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-gray-200">
                              {unregisteredActs.length} 件の記録
                            </span>
                          </div>
                          {(userRole === 'admin' || userRole === 'manager') && unregisteredActs.length > 0 && (
                            <button 
                              onClick={() => handleExportGroupReport('グループ未登録', unregisteredActs)}
                              disabled={exportingId === `group-グループ未登録`}
                              className="ml-3 flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 opacity-80"
                            >
                              {exportingId === `group-グループ未登録` ? (
                                <Loader2 size={14} className="mr-1.5 text-blue-600 animate-spin" />
                              ) : (
                                <FileSpreadsheet size={14} className="mr-1.5 text-green-600" />
                              )}
                              一覧をExcel出力
                            </button>
                          )}
                        </div>
                        
                        {(groupTotalBudget > 0 || groupTotalActual > 0) && (
                          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm w-max self-start sm:self-auto opacity-80">
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">予算合計</div>
                              <div className="text-sm font-bold text-gray-800">¥{groupTotalBudget.toLocaleString()}</div>
                            </div>
                            <div className="text-gray-300 font-light">|</div>
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">実績合計</div>
                              <div className="text-sm font-bold text-blue-600">¥{groupTotalActual.toLocaleString()}</div>
                            </div>
                            <div className="text-gray-300 font-light">|</div>
                            <div className="text-right">
                              <div className="text-[9px] text-gray-500 font-bold">予算残額</div>
                              <div className={`text-base font-extrabold ${balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ¥{balance.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="opacity-80">
                        {viewStyle === 'card' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {unregisteredActs.map(act => <ActivityCard key={act.id} activity={act} />)}
                          </div>
                        ) : (
                          <ActivityTable activitiesToRender={unregisteredActs} />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </main>

      {selectedActivityIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[150] bg-gray-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md border border-gray-700 animate-in slide-in-from-bottom-6 duration-200 no-print">
          <div className="flex items-center font-bold text-sm whitespace-nowrap">
            <CheckCircle className="text-green-400 mr-2 w-5 h-5" />
            <span>{selectedActivityIds.length}</span> 件を選択中
          </div>
          <div className="h-4 w-px bg-gray-700"></div>
          <div className="flex items-center gap-2">
            
            {userRole === 'admin' && (
              <>
                <button 
                  onClick={handleBulkGenerate} 
                  disabled={isBulkGenerating}
                  className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center transition-all shadow active:scale-95 disabled:opacity-50"
                >
                  {isBulkGenerating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <UploadCloud size={14} className="mr-1.5" />}
                  {isBulkGenerating ? '作成中...' : '一括書類作成'}
                </button>
                <button 
                  onClick={handleBulkDeleteDocuments}
                  disabled={isBulkDeletingDocs}
                  className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl flex items-center transition-all shadow active:scale-95 disabled:opacity-50"
                >
                  {isBulkDeletingDocs ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <FileX size={14} className="mr-1.5" />}
                  {isBulkDeletingDocs ? '削除中...' : '一括書類削除'}
                </button>
              </>
            )}

            <button 
              onClick={handleBulkDownload}
              disabled={isBulkDownloading}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center transition-all shadow active:scale-95 disabled:opacity-50"
            >
              {isBulkDownloading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Archive size={14} className="mr-1.5" />}
              {isBulkDownloading ? 'DL中...' : '一括DL(ZIP)'}
            </button>
              
            <button 
              onClick={() => setSelectedActivityIds([])}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-bold text-xs rounded-xl transition-all ml-1"
            >
              解除
            </button>
          </div>
        </div>
      )}

      {actionMenuActivity && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActionMenuActivity(null)}>
          <div 
            className="bg-white w-full sm:w-[400px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <div>
                <div className="text-xs text-gray-500 font-bold mb-1">{actionMenuActivity.date}</div>
                <h3 className="font-bold text-gray-900 text-lg truncate w-64">{actionMenuActivity.activityType || '無題の活動'}</h3>
              </div>
              <button onClick={() => setActionMenuActivity(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  navigate(`/activity-form/${actionMenuActivity.id}`, { state: { editData: actionMenuActivity, isViewMode: false } });
                  setActionMenuActivity(null);
                }} 
                className="w-full flex items-center p-3 rounded-xl hover:bg-blue-50 text-blue-700 transition-colors border border-transparent hover:border-blue-100 group"
              >
                <div className="bg-blue-100 p-2 rounded-lg mr-3 group-hover:bg-blue-200 transition-colors"><Edit size={20} /></div>
                <span className="font-bold">この活動を編集する</span>
              </button>
              
              {userRole === 'admin' && (
                <>
                  <button 
                    onClick={() => { handleGenerateDocuments(actionMenuActivity); setActionMenuActivity(null); }} 
                    className="w-full flex items-center p-3 rounded-xl hover:bg-green-50 text-green-700 transition-colors border border-transparent hover:border-green-100 group"
                  >
                    <div className="bg-green-100 p-2 rounded-lg mr-3 group-hover:bg-green-200 transition-colors"><FileSpreadsheet size={20} /></div>
                    <span className="font-bold">提出書類を作成 (サーバ保存)</span>
                  </button>
                  <button 
                    onClick={() => { setManualUploadActivity(actionMenuActivity); setActionMenuActivity(null); }} 
                    className="w-full flex items-center p-3 rounded-xl hover:bg-indigo-50 text-indigo-700 transition-colors border border-transparent hover:border-indigo-100 group"
                  >
                    <div className="bg-indigo-100 p-2 rounded-lg mr-3 group-hover:bg-indigo-200 transition-colors"><UploadCloud size={20} /></div>
                    <span className="font-bold">書類の個別登録・削除 (手動管理)</span>
                  </button>
                  {actionMenuActivity.isDocumentGenerated && (
                    <button 
                      onClick={() => { handleDeleteDocuments(actionMenuActivity); setActionMenuActivity(null); }} 
                      className="w-full flex items-center p-3 rounded-xl hover:bg-orange-50 text-orange-600 transition-colors border border-transparent hover:border-orange-100 group"
                    >
                      <div className="bg-orange-100 p-2 rounded-lg mr-3 group-hover:bg-orange-200 transition-colors"><FileX size={20} /></div>
                      <span className="font-bold">サーバ上の提出書類を一括削除</span>
                    </button>
                  )}
                </>
              )}
                
              <button 
                onClick={() => { handleDownloadDocuments(actionMenuActivity); setActionMenuActivity(null); }} 
                disabled={!actionMenuActivity.isDocumentGenerated}
                className={`w-full flex items-center p-3 rounded-xl transition-colors border border-transparent group ${!actionMenuActivity.isDocumentGenerated ? 'opacity-50 cursor-not-allowed text-gray-500' : 'hover:bg-blue-50 text-blue-700 hover:border-blue-100'}`}
              >
                <div className={`p-2 rounded-lg mr-3 transition-colors ${!actionMenuActivity.isDocumentGenerated ? 'bg-gray-100' : 'bg-blue-100 group-hover:bg-blue-200'}`}><Archive size={20} /></div>
                <span className="font-bold">提出書類をダウンロード (ZIP)</span>
              </button>

              <button 
                onClick={(e) => handleCopyLink(actionMenuActivity, e)} 
                className="w-full flex items-center p-3 rounded-xl hover:bg-purple-50 text-purple-700 transition-colors border border-transparent hover:border-purple-100 group"
              >
                <div className="bg-purple-100 p-2 rounded-lg mr-3 group-hover:bg-purple-200 transition-colors"><Link size={20} /></div>
                <span className="font-bold">共有リンクをコピーする</span>
              </button>
              
              {getPermissions(actionMenuActivity).canDeleteAct && (
                <button 
                  onClick={(e) => handleDeleteClick(actionMenuActivity.id, e)} 
                  className="w-full flex items-center p-3 rounded-xl hover:bg-red-50 text-red-600 transition-colors border border-transparent hover:border-red-100 group mt-2 pt-4 border-t border-gray-100"
                >
                  <div className="bg-red-100 p-2 rounded-lg mr-3 group-hover:bg-red-200 transition-colors"><Trash2 size={20} /></div>
                  <span className="font-bold">この活動を削除する</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deletingActivityId && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingActivityId(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">活動記録の削除</h3>
              <p className="text-sm text-gray-600">
                本当にこの活動記録を削除しますか？<br/>
                <span className="text-red-500 font-bold">※この操作は元に戻せません。</span>
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex space-x-3">
              <button onClick={() => setDeletingActivityId(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button onClick={executeDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center">
                <Trash2 size={18} className="mr-1.5" /> 削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 書類の個別手動アップロード・削除モーダル */}
      {manualUploadActivity && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setManualUploadActivity(null)}>
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <UploadCloud className="text-indigo-600 mr-2" size={20} />
                個別アップロード・削除
              </h3>
              <button onClick={() => setManualUploadActivity(null)} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 space-y-6">
              <p className="text-sm text-gray-600 font-medium">
                自動作成された書類を手元で修正して上書きアップロードしたり、不要なファイルだけを削除することができます。
              </p>

              {/* Excelエリア */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <h4 className="font-bold text-green-800 text-sm mb-3 flex items-center"><FileSpreadsheet size={16} className="mr-1.5"/> Excel (活動報告書)</h4>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex items-center justify-center bg-white border border-green-200 text-green-700 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingDocType !== null ? 'opacity-50' : 'hover:bg-green-100'}`}>
                    {uploadingDocType === 'excel' ? <Loader2 size={14} className="animate-spin mr-1" /> : <UploadCloud size={14} className="mr-1" />}
                    アップロード
                    <input 
                      type="file" 
                      accept=".xlsx" 
                      className="hidden" 
                      disabled={uploadingDocType !== null}
                      onChange={(e) => {
                        handleManualUpload(manualUploadActivity, e.target.files[0], 'excel');
                        e.target.value = ''; 
                      }} 
                    />
                  </label>
                  <button 
                    onClick={() => handleIndividualDelete(manualUploadActivity, 'excel')} 
                    disabled={uploadingDocType !== null} 
                    className="px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center disabled:opacity-50"
                  >
                    <Trash2 size={14} className="mr-1" /> 削除
                  </button>
                </div>
              </div>

              {/* PDFエリア */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <h4 className="font-bold text-red-800 text-sm mb-3 flex items-center"><FileText size={16} className="mr-1.5"/> PDF (写真台帳)</h4>
                <div className="flex items-center gap-2">
                  <label className={`flex-1 flex items-center justify-center bg-white border border-red-200 text-red-700 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingDocType !== null ? 'opacity-50' : 'hover:bg-red-100'}`}>
                    {uploadingDocType === 'pdf' ? <Loader2 size={14} className="animate-spin mr-1" /> : <UploadCloud size={14} className="mr-1" />}
                    アップロード
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      disabled={uploadingDocType !== null}
                      onChange={(e) => {
                        handleManualUpload(manualUploadActivity, e.target.files[0], 'pdf');
                        e.target.value = ''; 
                      }} 
                    />
                  </label>
                  <button 
                    onClick={() => handleIndividualDelete(manualUploadActivity, 'pdf')} 
                    disabled={uploadingDocType !== null} 
                    className="px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors flex items-center disabled:opacity-50"
                  >
                    <Trash2 size={14} className="mr-1" /> 削除
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🚀 進捗・完了モーダル */}
      {progressModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center mb-4">
                {progressModal.isComplete ? (
                  progressModal.hasError ? (
                    <AlertTriangle className="text-red-500 mr-2 w-6 h-6" />
                  ) : (
                    <CheckCircle className="text-green-500 mr-2 w-6 h-6" />
                  )
                ) : (
                  <Loader2 className="text-blue-500 mr-2 w-6 h-6 animate-spin" />
                )}
                <h3 className="text-lg font-bold text-gray-900">{progressModal.title}</h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed">{progressModal.message}</p>
              
              {/* プログレスバー */}
              {!progressModal.isComplete && progressModal.total > 0 && (
                <div className="mb-2">
                  <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                    <span>進捗状況</span>
                    <span>{Math.round((progressModal.current / progressModal.total) * 100)}% ({progressModal.current}/{progressModal.total})</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.round((progressModal.current / progressModal.total) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {progressModal.isComplete && (
                <div className="flex justify-center mt-6">
                  <button 
                    onClick={() => setProgressModal({ isOpen: false, title: '', message: '', current: 0, total: 0, isComplete: false, hasError: false })}
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors w-full"
                  >
                    閉じる
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🚀 PDF生成用の隠し領域 */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', zIndex: -1000, pointerEvents: 'none' }}>
        {printActivity && (
          <div id={`pdf-report-${printActivity.id}`} style={{ width: '794px', padding: '40px', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'serif', boxSizing: 'border-box' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', borderBottom: '4px solid #000000', paddingBottom: '8px', margin: '0 0 24px 0' }}>
              活動状況写真台帳
            </h1>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000000', marginBottom: '24px', fontSize: '14px' }}>
              <tbody>
                <tr>
                  <th style={{ border: '1px solid #000000', padding: '10px 14px', width: '25%', textAlign: 'left', backgroundColor: '#f3f4f6' }}>報告書NO</th>
                  <td style={{ border: '1px solid #000000', padding: '10px 14px' }}>{printActivity.reportNo || '（未設定）'}</td>
                </tr>
                <tr>
                  <th style={{ border: '1px solid #000000', padding: '10px 14px', width: '25%', textAlign: 'left', backgroundColor: '#f3f4f6' }}>実施年月日</th>
                  <td style={{ border: '1px solid #000000', padding: '10px 14px' }}>{printActivity.date}</td>
                </tr>
                <tr>
                  <th style={{ border: '1px solid #000000', padding: '10px 14px', textAlign: 'left', backgroundColor: '#f3f4f6' }}>活動内容</th>
                  <td style={{ border: '1px solid #000000', padding: '10px 14px' }}>{printActivity.activityType}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {(printActivity.imageUrls || (printActivity.imageUrl ? [printActivity.imageUrl] : [])).map((img, idx, arr) => (
                <div key={idx} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>{idx + 1}/{arr.length}枚目</div>
                  <div style={{ border: '1px solid #9ca3af', padding: '4px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                    <img 
                      src={img} 
                      crossOrigin="anonymous" 
                      alt="" 
                      style={{ maxWidth: '100%', maxHeight: '500px', width: 'auto', height: 'auto', display: 'inline-block', objectFit: 'contain' }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '32px', borderTop: '1px solid #000000', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '14px' }}>組織名：{ORGANIZATION_NAME || '鎌田緑保護会'}</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;