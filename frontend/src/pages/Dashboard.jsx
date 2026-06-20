import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Plus, Settings, LogOut, Sprout, Users, UserCog, User, MessageSquare, Trash2, X, MapPin, BarChart2, Activity, Printer, FileSpreadsheet, LayoutList, Layers, AlertTriangle, LayoutGrid, List, ChevronUp, ChevronDown, Link, Wallet, Lock, Map, MoreVertical, Edit, Info, History, Loader2 } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

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
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [printActivity, setPrintActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [exportingId, setExportingId] = useState(null);
  
  const [printingId, setPrintingId] = useState(null);
  
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
      setGroupsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleExportSingleReport = async (activity) => {
    if (!activity) return;
    setExportingId(activity.id); 
    setActionMenuActivity(null); 
    try {
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
      const blob = await workbook.outputAsync();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `活動報告書_${activity.reportNo ? activity.reportNo + '_' : ''}${activity.date}.xlsx`; 
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); alert('Excel作成エラー'); } finally { setExportingId(null); }
  };

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

  const handleDirectPrint = (activity) => {
    setPrintingId(activity.id);
    setPrintActivity(activity);
    setActionMenuActivity(null); 
    
    const reportNoStr = activity?.reportNo ? `${activity.reportNo}_` : '';
    const dateStr = activity?.date || '';
    
    setTimeout(() => { 
      const originalTitle = document.title;
      document.title = `活動報告書_${reportNoStr}${dateStr}`;
      window.print(); 
      document.title = originalTitle;
      
      setTimeout(() => {
        setPrintActivity(null);
        setPrintingId(null);
      }, 3000);
    }, 500);
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

    activities.forEach(act => {
      if (act.status === '未実施') return;

      (act.participantDetails || []).forEach(p => {
        const wId = p.wageId || p.memberId;
        const wage = membersList.find(m => m.id === wId);
        const pName = p.participantName || wage?.name;
        
        if (pName === displayUserName) {
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
  }, [activities, membersList, displayUserName]);

  const getPermissions = (activity) => {
    const isCreator = activity.createdBy === currentUser?.uid;
    const isInSameGroup = userGroupIds.includes(activity.groupId);
    const canExport = userRole === 'admin' || userRole === 'manager';
    const canDeleteAct = userRole === 'admin' || userRole === 'manager' ||
                         (!activity.isLocked && userRole === 'reporter' && canEditOwn && isCreator) ||
                         (!activity.isLocked && userRole === 'reporter' && canEditGroup && isInSameGroup);
    return { canExport, canDeleteAct };
  };

  const ActivityCard = ({ activity }) => {
    const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
    const isThisExporting = exportingId === activity.id;
    const isThisPrinting = printingId === activity.id;
    const { canExport, canDeleteAct } = getPermissions(activity);
    const groupInfo = groupsList.find(g => g.id === activity.groupId);
    
    const statusLabel = activity.status || '実績入力済';
    const planTypeLabel = activity.planType || '当初計画'; 
    
    const budget = Number(activity.budget) || 0;
    const actualCost = calculateActivityCost(activity);

    return (
      <div onClick={() => navigate(`/activity-form/${activity.id}`, { state: { editData: activity, isViewMode: true } })} className="bg-white rounded-2xl shadow-sm border-l-4 border-green-500 p-4 cursor-pointer hover:shadow-md transition-all flex flex-col h-full relative group">
        <div className="absolute top-3 right-3 flex items-center space-x-1.5 z-10">
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
          
          <button onClick={(e) => handleCopyLink(activity, e)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors" title="リンクをコピー">
            <Link size={15} />
          </button>

          {canDeleteAct && (
            <button onClick={(e) => handleDeleteClick(activity.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="この実績を削除">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-start space-y-1 mt-1">
          <h3 className="font-bold text-lg text-gray-900 leading-tight pr-40">{activity.activityType || '内容未入力'}</h3>
          {activity.isEssential && (
            <span className="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded font-bold">必須作業</span>
          )}
        </div>
        
        <div className="space-y-1.5 text-xs text-gray-600 mb-3 mt-3 flex-grow">
          <div className="flex items-center">
            {groupInfo ? (
              <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md font-bold mb-1">{groupInfo.name}</span>
            ) : (
              <span className="bg-red-50 text-red-500 text-[10px] px-2 py-1 rounded-md font-bold border border-red-100 mb-1">未登録</span>
            )}
            
            {activity.paymentCategory && (
              <span className="ml-1 bg-teal-50 text-teal-700 text-[9px] px-2 py-1 rounded-md font-bold border border-teal-100 truncate max-w-[120px]">
                {activity.paymentCategory}
              </span>
            )}
          </div>
          {activity.reportNo && <div className="flex items-center text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-max mb-1">NO: {activity.reportNo}</div>}
          <div className="flex items-center"><Calendar className="mr-2 h-4 w-4" />{activity.date}</div>
          <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" />{activity.location}</div>
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
        {canExport && (
          <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleExportSingleReport(activity); }} disabled={isThisExporting} className={`flex-1 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${isThisExporting ? 'bg-blue-400 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              <FileSpreadsheet size={14} className="mr-1" />{isThisExporting ? '生成中...' : 'Excel'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDirectPrint(activity); }} disabled={isThisPrinting} className={`flex-1 border py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${isThisPrinting ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
              {isThisPrinting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Printer size={14} className="mr-1" />}
              {isThisPrinting ? '準備中...' : 'PDF'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const ActivityTableRow = ({ act }) => {
    const groupInfo = groupsList.find(g => g.id === act.groupId);
    const isThisExporting = exportingId === act.id;
    const { canExport, canDeleteAct } = getPermissions(act);
    const hasImage = (act.imageUrls && act.imageUrls.length > 0) || act.imageUrl;
    
    const statusLabel = act.status || '実績入力済';
    const planTypeLabel = act.planType || '当初計画';
    const creatorName = systemUsers.find(u => u.id === act.createdBy)?.displayName || '-';

    const budget = Number(act.budget) || 0;
    const actualCost = calculateActivityCost(act);

    return (
      <tr 
        onClick={() => navigate(`/activity-form/${act.id}`, { state: { editData: act, isViewMode: true } })}
        className={`border-b border-gray-100 cursor-pointer transition-colors group/row active:bg-gray-200 ${act.isLocked ? 'hover:bg-gray-50/80' : 'hover:bg-green-50'}`}
      >
        <td className="p-3 text-sm text-gray-700 whitespace-nowrap">{act.date}</td>
        
        <td className="p-3 text-sm font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{act.activityType}</td>
        
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
        <td className="p-3 text-xs text-center text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis">{creatorName}</td>
        
        <td className="p-3 text-center whitespace-nowrap">
          {hasImage ? <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold">あり</span> : <span className="text-gray-300 text-[10px]">-</span>}
        </td>

        <td className={`w-0 px-2 py-2 text-center whitespace-nowrap sticky right-0 bg-white transition-colors shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10 border-l border-gray-100 ${act.isLocked ? 'group-hover/row:bg-gray-50/80' : 'group-hover/row:bg-green-50'}`} onClick={(e) => e.stopPropagation()}>
          <div className="hidden md:flex gap-1.5 justify-center items-center w-max mx-auto">
            <button onClick={(e) => handleCopyLink(act, e)} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="リンクをコピー">
              <Link size={14} />
            </button>

            {canExport && (
              <>
                <button onClick={(e) => handleExportSingleReport(act)} disabled={isThisExporting} className={`px-2 py-1.5 rounded-lg font-bold text-[9px] flex items-center transition-colors ${isThisExporting ? 'bg-blue-400 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`} title="Excel出力">
                  <FileSpreadsheet size={12} className="mr-1" />Excel
                </button>
                <button onClick={(e) => handleDirectPrint(act)} className="px-2 py-1.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-bold text-[9px] flex items-center hover:bg-gray-50 transition-colors" title="PDF出力">
                  <Printer size={12} className="mr-1" />PDF
                </button>
              </>
            )}

            {canDeleteAct && (
              <button onClick={(e) => handleDeleteClick(act.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="削除">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="md:hidden flex justify-center items-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setActionMenuActivity(act); }} 
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const ActivityTable = ({ activitiesToRender }) => {
    const toggleDateSort = () => {
      setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative">
        {(userRole === 'admin' || userRole === 'manager') && (
          <div className="md:hidden bg-blue-50/80 px-3 py-2 text-[10px] text-blue-600 flex items-center font-bold border-b border-blue-100">
            <Info className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            <span>各行の右端の<span className="bg-blue-100 px-1 rounded mx-0.5 font-black">︙</span>を押すとメニューが表示されます</span>
          </div>
        )}

        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse min-w-[1450px] table-fixed select-none">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                <th onClick={toggleDateSort} className="p-3 font-bold w-32 cursor-pointer hover:bg-gray-200 transition-colors group whitespace-nowrap" title="日付で並び替え">
                  <div className="flex items-center text-blue-700">
                    日付
                    {dateSortOrder === 'desc' ? <ChevronDown size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" /> : <ChevronUp size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" />}
                  </div>
                </th>
                
                <th className="p-3 font-bold w-full whitespace-nowrap">活動内容</th>
                
                <th className="p-3 font-bold w-20 text-center whitespace-nowrap">状態</th>
                <th className="p-3 font-bold w-24 text-center whitespace-nowrap">区分</th>
                <th className="p-3 font-bold w-32 whitespace-nowrap">支払区分</th>
                <th className="p-3 font-bold w-24 whitespace-nowrap">報告書NO</th>
                <th className="p-3 font-bold w-28 text-right whitespace-nowrap">予算額</th>
                <th className="p-3 font-bold w-28 text-right whitespace-nowrap">実績額</th>
                <th className="p-3 font-bold w-36 whitespace-nowrap">グループ</th>
                <th className="p-3 font-bold w-40 whitespace-nowrap">活動場所</th>
                <th className="p-3 font-bold w-20 whitespace-nowrap">項目番号</th>
                <th className="p-3 font-bold w-24 text-center whitespace-nowrap">登録者</th>
                <th className="p-3 font-bold w-12 text-center whitespace-nowrap">写真</th>
                
                <th className="w-0 px-3 py-3 font-bold text-center whitespace-nowrap sticky right-0 bg-gray-100 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] z-10 border-l border-gray-200">
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
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-8 print:bg-white print:pb-0 relative">
      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 15mm; size: A4; }
          .no-print { display: none !important; }
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
              <button onClick={() => navigate('/groups')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Users size={20} /></button>
              <button onClick={() => navigate('/costs')} className="p-2 text-gray-500 hover:text-green-600 transition-colors"><Wallet size={20} /></button>
            </>
          )}

          {userRole === 'admin' && (
            <>
              <button onClick={() => navigate('/users')} className="p-2 text-gray-500 hover:text-purple-600 transition-colors"><UserCog size={20} /></button>
              <button onClick={() => navigate('/masters')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Settings size={20} /></button>
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
            <button 
              onClick={() => setIsMyRewardExpanded(!isMyRewardExpanded)}
              className="w-full flex items-center justify-between border-b border-gray-100 pb-2 cursor-pointer hover:opacity-70 transition-opacity"
            >
              <h3 className="font-extrabold text-gray-800 text-base flex items-center">
                <User size={18} className="text-purple-600 mr-2" />
                あなたの作業実績・報酬額 (作業完了分)
              </h3>
              {isMyRewardExpanded ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
            </button>
            
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

      {/* ボトムシート（スマホでのメニュー用） */}
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
              
              {getPermissions(actionMenuActivity).canExport && (
                <>
                  <button 
                    onClick={() => handleExportSingleReport(actionMenuActivity)} 
                    className="w-full flex items-center p-3 rounded-xl hover:bg-green-50 text-green-700 transition-colors border border-transparent hover:border-green-100 group"
                  >
                    <div className="bg-green-100 p-2 rounded-lg mr-3 group-hover:bg-green-200 transition-colors"><FileSpreadsheet size={20} /></div>
                    <span className="font-bold">Excelで出力する (活動報告書)</span>
                  </button>
                  
                  <button 
                    onClick={() => handleDirectPrint(actionMenuActivity)} 
                    className="w-full flex items-center p-3 rounded-xl hover:bg-gray-50 text-gray-800 transition-colors border border-transparent hover:border-gray-200 group"
                  >
                    <div className="bg-gray-200 p-2 rounded-lg mr-3 group-hover:bg-gray-300 transition-colors"><Printer size={20} /></div>
                    <span className="font-bold">PDFで出力・印刷する</span>
                  </button>
                </>
              )}

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

      {printActivity && (() => {
        const printImages = printActivity.imageUrls || (printActivity.imageUrl ? [printActivity.imageUrl] : []);
        const totalImages = printImages.length;
        const groupInfo = groupsList.find(g => g.id === printActivity.groupId);

        return (
          <div className="hidden print:block w-full text-black bg-white font-serif">
            <h1 className="text-2xl font-bold text-center border-b-4 border-black pb-2 mb-6">活動状況写真台帳</h1>
            <table className="w-full border-2 border-black border-collapse mb-6 text-sm">
              <tbody>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">報告書NO</th><td className="border border-black p-3" colSpan="3">{printActivity.reportNo || '（未設定）'}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">実施年月日</th><td className="border border-black p-3 w-1/4">{printActivity.date}</td><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">活動項目番号</th><td className="border border-black p-3 w-1/4">{printActivity.activityNumbers?.join(', ')}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">実施場所</th><td className="border border-black p-3" colSpan="3">{printActivity.location}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">活動内容</th><td className="border border-black p-3" colSpan="3">{printActivity.activityType}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">支払区分</th><td className="border border-black p-3" colSpan="3">{printActivity.paymentCategory}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">参加人数</th><td className="border border-black p-3" colSpan="3">計 {printActivity.participants} 名 （農業者：{printActivity.participantsAgri}名 ／ 農業者以外：{printActivity.participantsNonAgri}名）</td></tr>
              </tbody>
            </table>
            <div className="space-y-6">
              {printImages.map((img, idx) => (
                <div key={idx} className="break-inside-avoid">
                  <div className="text-sm font-bold mb-1 text-left">{idx + 1}/{totalImages}枚目</div>
                  <div className="border border-gray-400 p-1">
                    <img src={img} alt="" decoding="async" className="w-full h-auto max-h-[140mm] object-contain" />
                  </div>
                </div>
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

export default Dashboard;